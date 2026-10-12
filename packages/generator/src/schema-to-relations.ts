import type {
  SoftDeletePolicy,
  ValidatedField,
  ValidatedModel,
  ValidatedRelation,
  ValidatedSchema,
} from "@zed-orm/schema";
import type { RelationKind, RelationMeta } from "@zed-orm/query-builder";

interface RelationFieldContext {
  readonly model: ValidatedModel;
  readonly field: ValidatedField;
  readonly relation?: ValidatedRelation;
}

function implicitJoinTableName(modelA: string, modelB: string): string {
  const [first, second] = [modelA, modelB].sort((left, right) =>
    left.localeCompare(right),
  );
  return `_${first}To${second}`;
}

function findFkRelationOnModel(
  relations: readonly ValidatedRelation[],
  modelName: string,
  fieldName: string,
): ValidatedRelation | undefined {
  return relations.find(
    (relation) => relation.model === modelName && relation.field === fieldName,
  );
}

function findIncomingFkRelation(
  relations: readonly ValidatedRelation[],
  parentModel: string,
  childModel: string,
): ValidatedRelation | undefined {
  return relations.find(
    (relation) =>
      relation.referencedModel === parentModel &&
      relation.model === childModel,
  );
}

function resolveRelationKind(
  field: ValidatedField,
  relation: ValidatedRelation | undefined,
  reverseField: ValidatedField | undefined,
): RelationKind {
  if (relation !== undefined) {
    if (!field.isList && reverseField !== undefined && !reverseField.isList) {
      return "oneToOne";
    }
    return "manyToOne";
  }

  if (field.isList && reverseField !== undefined && reverseField.isList) {
    return "manyToMany";
  }

  return "oneToMany";
}

function buildRelationMeta(
  schema: ValidatedSchema,
  context: RelationFieldContext,
): RelationMeta | undefined {
  const { model, field } = context;
  if (field.typeKind !== "model") {
    return undefined;
  }

  const relation = context.relation;
  const reverseField = [...schema.models.get(field.typeName)!.fields.values()].find(
    (candidate) =>
      candidate.typeKind === "model" && candidate.typeName === model.name,
  );

  const kind = resolveRelationKind(field, relation, reverseField);

  if (kind === "manyToOne" || kind === "oneToOne") {
    if (relation === undefined) {
      return undefined;
    }

    return {
      fieldName: field.name,
      relatedModel: field.typeName,
      kind,
      localFkFields: [...relation.fields],
      foreignKeyFields: [...relation.references],
      onSoftDelete: relation.onSoftDelete,
      ...(reverseField !== undefined
        ? { reverseFieldName: reverseField.name }
        : {}),
    };
  }

  if (kind === "oneToMany") {
    const incoming = findIncomingFkRelation(
      schema.relations,
      model.name,
      field.typeName,
    );
    if (incoming === undefined) {
      return undefined;
    }

    return {
      fieldName: field.name,
      relatedModel: field.typeName,
      kind,
      localFkFields: [...incoming.fields],
      foreignKeyFields: [...incoming.references],
      onSoftDelete: incoming.onSoftDelete,
      reverseFieldName: incoming.field,
    };
  }

  const [localModel, foreignModel] = [model.name, field.typeName].sort((a, b) =>
    a.localeCompare(b),
  );
  const joinTable = implicitJoinTableName(model.name, field.typeName);

  return {
    fieldName: field.name,
    relatedModel: field.typeName,
    kind,
    localFkFields: [],
    foreignKeyFields: [],
    onSoftDelete: "Ignore" satisfies SoftDeletePolicy,
    ...(reverseField !== undefined
      ? { reverseFieldName: reverseField.name }
      : {}),
    joinTable: {
      tableName: joinTable,
      localColumn: localModel === model.name ? "A" : "B",
      foreignColumn: foreignModel === field.typeName ? "B" : "A",
    },
  };
}

/** Build relation metadata for a validated model. */
export function modelToRelations(
  schema: ValidatedSchema,
  model: ValidatedModel,
): ReadonlyMap<string, RelationMeta> {
  const relations = new Map<string, RelationMeta>();

  for (const field of model.fields.values()) {
    if (field.typeKind !== "model") {
      continue;
    }

    const relation = findFkRelationOnModel(
      schema.relations,
      model.name,
      field.name,
    );

    const meta = buildRelationMeta(
      schema,
      relation === undefined
        ? { model, field }
        : { model, field, relation },
    );
    if (meta !== undefined) {
      relations.set(field.name, meta);
    }
  }

  return relations;
}
