import {
  buildFindMany,
  getDeletedAtField,
  isSoftDeleteModel,
  type IncludeInput,
  type ModelMeta,
  type RelationLoadArgs,
  type RelationMeta,
  type ScalarValue,
  type SqlDialect,
} from "@zed-orm/query-builder";
import type { QueryExecutor } from "./index.js";

type Row = Record<string, unknown>;

function normalizeIncludeEntry(
  value: boolean | RelationLoadArgs | undefined,
): RelationLoadArgs | undefined {
  if (value === undefined || value === false) {
    return undefined;
  }
  if (value === true) {
    return {};
  }
  return value;
}

function groupChildRows(
  rows: readonly Row[],
  relation: RelationMeta,
): Map<unknown, Row[]> {
  const grouped = new Map<unknown, Row[]>();
  const childFk = relation.localFkFields[0]!;

  for (const row of rows) {
    const key = row[childFk];
    if (key === null || key === undefined) {
      continue;
    }
    const bucket = grouped.get(key);
    if (bucket === undefined) {
      grouped.set(key, [row]);
    } else {
      bucket.push(row);
    }
  }

  return grouped;
}

async function loadManyToOneBatch(
  driver: QueryExecutor,
  modelMetas: Readonly<Record<string, ModelMeta>>,
  relation: RelationMeta,
  parentRows: readonly Row[],
  dialect: SqlDialect,
  nested?: RelationLoadArgs,
): Promise<Map<unknown, Row>> {
  const keys = [
    ...new Set(
      parentRows
        .map((row) => row[relation.localFkFields[0]!])
        .filter((value) => value !== null && value !== undefined),
    ),
  ];

  if (keys.length === 0) {
    return new Map();
  }

  const relatedMeta = modelMetas[relation.relatedModel];
  if (relatedMeta === undefined) {
    throw new Error(`Unknown related model '${relation.relatedModel}'.`);
  }

  const statement = buildFindMany(
    relatedMeta,
    {
      where: {
        [relation.foreignKeyFields[0]!]: { in: keys as ScalarValue[] },
      },
      ...(nested?.select !== undefined ? { select: nested.select } : {}),
    },
    dialect,
  );

  const result = await driver.query<Row>(statement.sql, [...statement.params]);
  const byKey = new Map<unknown, Row>();
  for (const row of result.rows) {
    byKey.set(row[relation.foreignKeyFields[0]!], row);
  }

  if (nested?.include !== undefined) {
    await attachIncludes(
      driver,
      modelMetas,
      relatedMeta,
      result.rows,
      nested.include,
      dialect,
    );
  }

  return byKey;
}

async function loadOneToManyBatch(
  driver: QueryExecutor,
  modelMetas: Readonly<Record<string, ModelMeta>>,
  relation: RelationMeta,
  parentRows: readonly Row[],
  parentMeta: ModelMeta,
  dialect: SqlDialect,
  nested?: RelationLoadArgs,
): Promise<Map<unknown, Row[]>> {
  const parentKeyField = parentMeta.idFields[0]!;
  const keys = parentRows
    .map((row) => row[parentKeyField])
    .filter((value) => value !== null && value !== undefined);

  if (keys.length === 0) {
    return new Map();
  }

  const relatedMeta = modelMetas[relation.relatedModel];
  if (relatedMeta === undefined) {
    throw new Error(`Unknown related model '${relation.relatedModel}'.`);
  }

  const childFk = relation.localFkFields[0]!;
  const statement = buildFindMany(
    relatedMeta,
    {
      where: { [childFk]: { in: keys as ScalarValue[] } },
      ...(nested?.select !== undefined ? { select: nested.select } : {}),
    },
    dialect,
  );

  const result = await driver.query<Row>(statement.sql, [...statement.params]);
  const grouped = groupChildRows(result.rows, relation);

  if (nested?.include !== undefined) {
    await attachIncludes(
      driver,
      modelMetas,
      relatedMeta,
      result.rows,
      nested.include,
      dialect,
    );
  }

  return grouped;
}

async function loadManyToManyBatch(
  driver: QueryExecutor,
  modelMetas: Readonly<Record<string, ModelMeta>>,
  relation: RelationMeta,
  parentRows: readonly Row[],
  parentMeta: ModelMeta,
  dialect: SqlDialect,
  nested?: RelationLoadArgs,
): Promise<Map<unknown, Row[]>> {
  const join = relation.joinTable;
  if (join === undefined) {
    throw new Error(
      `manyToMany relation '${relation.fieldName}' is missing join table metadata.`,
    );
  }

  const parentKeyField = parentMeta.idFields[0]!;
  const keys = parentRows
    .map((row) => row[parentKeyField])
    .filter((value) => value !== null && value !== undefined);

  if (keys.length === 0) {
    return new Map();
  }

  const relatedMeta = modelMetas[relation.relatedModel];
  if (relatedMeta === undefined) {
    throw new Error(`Unknown related model '${relation.relatedModel}'.`);
  }

  const relatedIdField = relatedMeta.idFields[0]!;
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
  const relatedTable = `"${relation.relatedModel}"`;
  const joinTable = `"${join.tableName}"`;

  const activeFilter = isSoftDeleteModel(relatedMeta)
    ? ` AND r."${getDeletedAtField(relatedMeta)}" IS NULL`
    : "";

  const sql = [
    `SELECT j."${join.localColumn}" AS "_parent_id", r.*`,
    `FROM ${joinTable} j`,
    `JOIN ${relatedTable} r ON r."${relatedIdField}" = j."${join.foreignColumn}"`,
    `WHERE j."${join.localColumn}" IN (${placeholders})${activeFilter}`,
  ].join(" ");

  const result = await driver.query<Row>(sql, [...keys]);
  const grouped = new Map<unknown, Row[]>();

  for (const row of result.rows) {
    const parentId = row["_parent_id"];
    const child = { ...row };
    delete child["_parent_id"];
    if (nested?.select !== undefined) {
      const selected: Row = {};
      for (const [field, enabled] of Object.entries(nested.select)) {
        if (enabled) {
          selected[field] = child[field];
        }
      }
      const bucket = grouped.get(parentId);
      if (bucket === undefined) {
        grouped.set(parentId, [selected]);
      } else {
        bucket.push(selected);
      }
      continue;
    }

    const bucket = grouped.get(parentId);
    if (bucket === undefined) {
      grouped.set(parentId, [child]);
    } else {
      bucket.push(child);
    }
  }

  if (nested?.include !== undefined) {
    const childRows = [...grouped.values()].flat();
    await attachIncludes(
      driver,
      modelMetas,
      relatedMeta,
      childRows,
      nested.include,
      dialect,
    );
  }

  return grouped;
}

async function loadRelationBatch(
  driver: QueryExecutor,
  modelMetas: Readonly<Record<string, ModelMeta>>,
  parentMeta: ModelMeta,
  relation: RelationMeta,
  parentRows: readonly Row[],
  dialect: SqlDialect,
  nested?: RelationLoadArgs,
): Promise<void> {
  if (parentRows.length === 0) {
    return;
  }

  switch (relation.kind) {
    case "manyToOne":
    case "oneToOne": {
      const relatedByKey = await loadManyToOneBatch(
        driver,
        modelMetas,
        relation,
        parentRows,
        dialect,
        nested,
      );
      for (const row of parentRows) {
        const fk = row[relation.localFkFields[0]!];
        row[relation.fieldName] = relatedByKey.get(fk) ?? null;
      }
      return;
    }
    case "oneToMany": {
      const childrenByParent = await loadOneToManyBatch(
        driver,
        modelMetas,
        relation,
        parentRows,
        parentMeta,
        dialect,
        nested,
      );
      const parentKeyField = parentMeta.idFields[0]!;
      for (const row of parentRows) {
        row[relation.fieldName] =
          childrenByParent.get(row[parentKeyField]) ?? [];
      }
      return;
    }
    case "manyToMany": {
      const childrenByParent = await loadManyToManyBatch(
        driver,
        modelMetas,
        relation,
        parentRows,
        parentMeta,
        dialect,
        nested,
      );
      const parentKeyField = parentMeta.idFields[0]!;
      for (const row of parentRows) {
        row[relation.fieldName] =
          childrenByParent.get(row[parentKeyField]) ?? [];
      }
    }
  }
}

/** Attach included relations to result rows using batched queries. */
export async function attachIncludes(
  driver: QueryExecutor,
  modelMetas: Readonly<Record<string, ModelMeta>>,
  meta: ModelMeta,
  rows: readonly Row[],
  include: IncludeInput,
  dialect: SqlDialect = "postgresql",
): Promise<void> {
  const mutableRows = rows as Row[];

  for (const [fieldName, includeValue] of Object.entries(include)) {
    const nested = normalizeIncludeEntry(includeValue);
    if (nested === undefined) {
      continue;
    }

    const relation = meta.relations.get(fieldName);
    if (relation === undefined) {
      throw new Error(
        `Unknown include field '${meta.modelName}.${fieldName}'.`,
      );
    }

    await loadRelationBatch(
      driver,
      modelMetas,
      meta,
      relation,
      mutableRows,
      dialect,
      nested,
    );
  }
}
