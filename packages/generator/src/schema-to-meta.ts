import { SCALAR_TYPE_NAMES } from "@zed-orm/ast";
import type { RelationMeta } from "@zed-orm/query-builder";
import type { ValidatedField, ValidatedModel, ValidatedSchema } from "@zed-orm/schema";
import type {
  GeneratorFieldMeta,
  GeneratorModelMeta,
  GeneratorRelationMeta,
  GeneratorScalarKind,
} from "./meta-types.js";
import { modelToRelations } from "./schema-to-relations.js";

const SCALAR_SET = new Set<string>(SCALAR_TYPE_NAMES);

function toScalarKind(typeName: string): GeneratorScalarKind | undefined {
  if (!SCALAR_SET.has(typeName)) {
    return undefined;
  }
  return typeName as GeneratorScalarKind;
}

function toFieldMeta(field: ValidatedField): GeneratorFieldMeta {
  const base = {
    name: field.name,
    columnName: field.name,
    isRelation: field.isRelation || field.typeKind === "model",
    isId: field.isId,
    isUnique: field.isUnique,
    isList: field.isList,
    ...(field.isUpdatedAt ? { isUpdatedAt: true } : {}),
  };

  if (field.typeKind === "scalar") {
    const scalarKind = toScalarKind(field.typeName);
    return scalarKind === undefined
      ? base
      : { ...base, scalarKind };
  }

  if (field.typeKind === "enum") {
    return { ...base, enumName: field.typeName };
  }

  return base;
}

function toRelationMeta(relation: RelationMeta): GeneratorRelationMeta {
  const base: GeneratorRelationMeta = {
    fieldName: relation.fieldName,
    relatedModel: relation.relatedModel,
    kind: relation.kind,
    localFkFields: [...relation.localFkFields],
    foreignKeyFields: [...relation.foreignKeyFields],
  };

  const withPolicy =
    relation.onSoftDelete !== undefined
      ? { ...base, onSoftDelete: relation.onSoftDelete }
      : base;

  if (relation.reverseFieldName !== undefined) {
    return { ...withPolicy, reverseFieldName: relation.reverseFieldName };
  }

  if (relation.joinTable !== undefined) {
    return {
      ...withPolicy,
      joinTable: {
        tableName: relation.joinTable.tableName,
        localColumn: relation.joinTable.localColumn,
        foreignColumn: relation.joinTable.foreignColumn,
      },
    };
  }

  return withPolicy;
}

/** Convert a validated model into query metadata for generation. */
export function modelToMeta(
  schema: ValidatedSchema,
  model: ValidatedModel,
): GeneratorModelMeta {
  const fields = new Map<string, GeneratorFieldMeta>();
  for (const field of model.fields.values()) {
    fields.set(field.name, toFieldMeta(field));
  }

  const relations = new Map<string, GeneratorRelationMeta>();
  for (const [name, relation] of modelToRelations(schema, model)) {
    relations.set(name, toRelationMeta(relation));
  }

  return {
    modelName: model.name,
    tableName: model.name,
    fields,
    idFields: [...model.idFields],
    relations,
    ...(model.softDelete
      ? {
          softDelete: true,
          deletedAtField: model.deletedAtField ?? "deletedAt",
        }
      : {}),
  };
}

/** Convert a validated schema into model metadata (sorted by model name). */
export function schemaToModelMetas(
  schema: ValidatedSchema,
): readonly GeneratorModelMeta[] {
  return [...schema.models.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((model) => modelToMeta(schema, model));
}
