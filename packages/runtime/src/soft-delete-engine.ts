import {
  buildDeleteMany,
  buildFindMany,
  buildSelectIds,
  buildUpdateMany,
  getDeletedAtField,
  isSoftDeleteModel,
  type DeleteArgs,
  type DeleteManyArgs,
  type ModelMeta,
  type ScalarValue,
  type SoftDeletePolicy,
  type SqlDialect,
  type WhereInput,
} from "@zed-orm/query-builder";
import { ZedError, ZedErrorCode } from "@zed-orm/shared";
import type { QueryExecutor } from "./index.js";

type Row = Record<string, unknown>;

/** Error thrown when relational soft-delete rules block an operation. */
export class SoftDeleteError extends ZedError {
  constructor(message: string, options?: ErrorOptions) {
    super(ZedErrorCode.SOFT_DELETE, message, options);
    this.name = "SoftDeleteError";
  }
}

interface IncomingRelation {
  readonly childModel: string;
  readonly childMeta: ModelMeta;
  readonly fkField: string;
  readonly parentRefField: string;
  readonly onSoftDelete: SoftDeletePolicy;
}

interface DeleteWorkItem {
  readonly modelName: string;
  readonly meta: ModelMeta;
  readonly parentRefField: string;
  readonly parentIds: readonly unknown[];
}

function getIncomingRelations(
  parentModel: string,
  modelMetas: Readonly<Record<string, ModelMeta>>,
): readonly IncomingRelation[] {
  const incoming: IncomingRelation[] = [];

  for (const childMeta of Object.values(modelMetas)) {
    for (const relation of childMeta.relations.values()) {
      if (relation.relatedModel !== parentModel) {
        continue;
      }
      if (relation.kind === "manyToMany") {
        continue;
      }
      if (relation.localFkFields.length === 0) {
        continue;
      }

      incoming.push({
        childModel: childMeta.modelName,
        childMeta,
        fkField: relation.localFkFields[0]!,
        parentRefField: relation.foreignKeyFields[0]!,
        onSoftDelete: relation.onSoftDelete ?? "Restrict",
      });
    }
  }

  return incoming;
}

function hasRelationalPolicies(
  meta: ModelMeta,
  modelMetas: Readonly<Record<string, ModelMeta>>,
): boolean {
  if (!isSoftDeleteModel(meta)) {
    return false;
  }
  return getIncomingRelations(meta.modelName, modelMetas).some(
    (relation) => relation.onSoftDelete !== "Ignore",
  );
}

async function selectActiveIds(
  driver: QueryExecutor,
  meta: ModelMeta,
  where: DeleteManyArgs["where"],
  dialect: SqlDialect,
): Promise<readonly Row[]> {
  const statement = buildSelectIds(meta, where, dialect);
  const result = await driver.query<Row>(statement.sql, [...statement.params]);
  return result.rows;
}

async function assertRestrictRelations(
  driver: QueryExecutor,
  parentMeta: ModelMeta,
  parentIds: readonly unknown[],
  modelMetas: Readonly<Record<string, ModelMeta>>,
  dialect: SqlDialect,
): Promise<void> {
  for (const relation of getIncomingRelations(
    parentMeta.modelName,
    modelMetas,
  )) {
    if (relation.onSoftDelete !== "Restrict" || parentIds.length === 0) {
      continue;
    }

    const where: WhereInput = {
      [relation.fkField]: { in: parentIds as ScalarValue[] },
      ...(isSoftDeleteModel(relation.childMeta)
        ? { [getDeletedAtField(relation.childMeta)]: null }
        : {}),
    };

    const statement = buildFindMany(
      relation.childMeta,
      { where, take: 1 },
      dialect,
    );
    const result = await driver.query(statement.sql, [...statement.params]);
    if (result.rowCount > 0) {
      throw new SoftDeleteError(
        `Cannot soft-delete '${parentMeta.modelName}' because related '${relation.childModel}' rows exist (onSoftDelete: Restrict).`,
      );
    }
  }
}

async function nullifyRelations(
  driver: QueryExecutor,
  parentMeta: ModelMeta,
  parentIds: readonly unknown[],
  modelMetas: Readonly<Record<string, ModelMeta>>,
  dialect: SqlDialect,
): Promise<void> {
  for (const relation of getIncomingRelations(
    parentMeta.modelName,
    modelMetas,
  )) {
    if (relation.onSoftDelete !== "Nullify" || parentIds.length === 0) {
      continue;
    }

    const statement = buildUpdateMany(
      relation.childMeta,
      {
        where: { [relation.fkField]: { in: parentIds as ScalarValue[] } },
        data: { [relation.fkField]: null },
      },
      dialect,
    );
    await driver.query(statement.sql, [...statement.params]);
  }
}

async function collectCascadeWork(
  driver: QueryExecutor,
  modelMetas: Readonly<Record<string, ModelMeta>>,
  parentMeta: ModelMeta,
  parentIds: readonly unknown[],
  dialect: SqlDialect,
  visited: Set<string>,
  queue: DeleteWorkItem[],
): Promise<void> {
  for (const relation of getIncomingRelations(
    parentMeta.modelName,
    modelMetas,
  )) {
    if (relation.onSoftDelete !== "Cascade" || parentIds.length === 0) {
      continue;
    }

    const childIds = await selectActiveIds(
      driver,
      relation.childMeta,
      { [relation.fkField]: { in: parentIds as ScalarValue[] } },
      dialect,
    );

    if (childIds.length === 0) {
      continue;
    }

    const childParentIds = childIds.map(
      (row) => row[relation.childMeta.idFields[0]!],
    );
    const visitKey = `${relation.childModel}:${childParentIds.map(String).sort().join(",")}`;
    if (visited.has(visitKey)) {
      continue;
    }
    visited.add(visitKey);

    await collectCascadeWork(
      driver,
      modelMetas,
      relation.childMeta,
      childParentIds,
      dialect,
      visited,
      queue,
    );

    queue.push({
      modelName: relation.childModel,
      meta: relation.childMeta,
      parentRefField: relation.childMeta.idFields[0]!,
      parentIds: childParentIds,
    });
  }
}

async function applyCascadeDeletes(
  driver: QueryExecutor,
  queue: readonly DeleteWorkItem[],
  dialect: SqlDialect,
  deletedAt: Date,
): Promise<void> {
  for (const item of queue) {
    const statement = buildDeleteMany(
      item.meta,
      {
        where: {
          [item.parentRefField]: { in: [...item.parentIds] as ScalarValue[] },
        },
        deletedAt,
      },
      dialect,
    );
    await driver.query(statement.sql, [...statement.params]);
  }
}

/** Apply relational soft-delete policies before deleting parent rows. */
export async function applyRelationalSoftDelete(
  driver: QueryExecutor,
  parentMeta: ModelMeta,
  parentIds: readonly unknown[],
  modelMetas: Readonly<Record<string, ModelMeta>>,
  dialect: SqlDialect,
  deletedAt: Date,
): Promise<void> {
  if (!isSoftDeleteModel(parentMeta) || parentIds.length === 0) {
    return;
  }

  await assertRestrictRelations(
    driver,
    parentMeta,
    parentIds,
    modelMetas,
    dialect,
  );
  await nullifyRelations(
    driver,
    parentMeta,
    parentIds,
    modelMetas,
    dialect,
  );

  const visited = new Set<string>();
  const cascadeQueue: DeleteWorkItem[] = [];
  await collectCascadeWork(
    driver,
    modelMetas,
    parentMeta,
    parentIds,
    dialect,
    visited,
    cascadeQueue,
  );
  await applyCascadeDeletes(driver, cascadeQueue, dialect, deletedAt);
}

export function needsRelationalSoftDelete(
  meta: ModelMeta,
  modelMetas: Readonly<Record<string, ModelMeta>>,
): boolean {
  return hasRelationalPolicies(meta, modelMetas);
}

export async function resolveDeleteParentIds(
  driver: QueryExecutor,
  meta: ModelMeta,
  where: DeleteArgs["where"] | DeleteManyArgs["where"],
  dialect: SqlDialect,
): Promise<readonly Row[]> {
  return selectActiveIds(driver, meta, where, dialect);
}
