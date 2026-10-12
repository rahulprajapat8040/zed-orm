import type { ValidatedField, ValidatedModel, ValidatedSchema } from "@zed-orm/schema";

export interface JoinTableSpec {
  readonly tableName: string;
  readonly columnA: string;
  readonly columnB: string;
  readonly modelA: string;
  readonly modelB: string;
}

function implicitJoinTableName(modelA: string, modelB: string): string {
  const [first, second] = [modelA, modelB].sort((left, right) =>
    left.localeCompare(right),
  );
  return `_${first}To${second}`;
}

function findReverseRelationField(
  schema: ValidatedSchema,
  modelName: string,
  relatedModel: string,
): ValidatedField | undefined {
  const related = schema.models.get(relatedModel);
  if (related === undefined) {
    return undefined;
  }

  return [...related.fields.values()].find(
    (field) => field.typeKind === "model" && field.typeName === modelName,
  );
}

function isManyToMany(
  schema: ValidatedSchema,
  model: ValidatedModel,
  field: ValidatedField,
): boolean {
  if (field.typeKind !== "model" || !field.isList) {
    return false;
  }

  const reverse = findReverseRelationField(schema, model.name, field.typeName);
  return reverse !== undefined && reverse.isList;
}

/** Discover implicit many-to-many join tables from a validated schema. */
export function discoverJoinTables(schema: ValidatedSchema): readonly JoinTableSpec[] {
  const seen = new Set<string>();
  const joinTables: JoinTableSpec[] = [];

  for (const model of schema.models.values()) {
    for (const field of model.fields.values()) {
      if (!isManyToMany(schema, model, field)) {
        continue;
      }

      const tableName = implicitJoinTableName(model.name, field.typeName);
      if (seen.has(tableName)) {
        continue;
      }
      seen.add(tableName);

      const sortedModels = [model.name, field.typeName].sort((left, right) =>
        left.localeCompare(right),
      );

      joinTables.push({
        tableName,
        columnA: "A",
        columnB: "B",
        modelA: sortedModels[0]!,
        modelB: sortedModels[1]!,
      });
    }
  }

  return joinTables.sort((left, right) =>
    left.tableName.localeCompare(right.tableName),
  );
}
