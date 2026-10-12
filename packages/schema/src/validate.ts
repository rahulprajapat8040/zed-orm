import {
  SCALAR_TYPE_NAMES,
  BlockAttributeName,
  FieldAttributeName,
  getNamedType,
  isArrayExpression,
  isIdentifier,
  isListFieldType,
  isOptionalFieldType,
  isSchemaAST,
  type AttributeArgNode,
  type ExpressionNode,
  type FieldNode,
  type ModelNode,
  type SchemaAST,
  type SourceSpan,
} from "@zed-orm/ast";
import { ZedErrorCode } from "@zed-orm/shared";
import { SchemaError } from "./errors.js";
import type {
  SoftDeletePolicy,
  ValidatedEnum,
  ValidatedField,
  ValidatedModel,
  ValidatedRelation,
  ValidatedSchema,
} from "./types.js";

const DEFAULT_DELETED_AT_FIELD = "deletedAt";
const SOFT_DELETE_POLICIES = new Set<SoftDeletePolicy>([
  "Cascade",
  "Restrict",
  "Nullify",
  "Ignore",
]);
const DEFAULT_SOFT_DELETE_POLICY: SoftDeletePolicy = "Restrict";

const SCALAR_SET = new Set<string>(SCALAR_TYPE_NAMES);

/**
 * Validate a parsed `SchemaAST` and build a validated schema graph.
 *
 * @throws {SchemaError} on the first semantic error (fail-fast for clarity in M3)
 */
export function validateSchema(ast: SchemaAST): ValidatedSchema {
  if (!isSchemaAST(ast)) {
    throw new SchemaError("Expected a SchemaAST root node.");
  }

  const enums = collectEnums(ast);
  const models = collectModels(ast, enums);
  const relations = collectAndValidateRelations(ast, models);

  return {
    ast,
    datasources: ast.datasources,
    generators: ast.generators,
    models,
    enums,
    relations,
  };
}

function collectEnums(ast: SchemaAST): Map<string, ValidatedEnum> {
  const enums = new Map<string, ValidatedEnum>();

  for (const node of ast.enums) {
    const name = node.name.name;
    if (enums.has(name)) {
      throw schemaError(`Duplicate enum '${name}'.`, node.name.loc);
    }
    if (SCALAR_SET.has(name)) {
      throw schemaError(
        `Enum name '${name}' conflicts with a scalar type.`,
        node.name.loc,
      );
    }

    const values = new Set<string>();
    for (const value of node.values) {
      const valueName = value.name.name;
      if (values.has(valueName)) {
        throw schemaError(
          `Duplicate enum value '${valueName}' in enum '${name}'.`,
          value.name.loc,
        );
      }
      values.add(valueName);
    }

    if (values.size === 0) {
      throw schemaError(
        `Enum '${name}' must declare at least one value.`,
        node.loc,
      );
    }

    enums.set(name, { name, node, values });
  }

  return enums;
}

function collectModels(
  ast: SchemaAST,
  enums: ReadonlyMap<string, ValidatedEnum>,
): Map<string, ValidatedModel> {
  // First pass: register model names for type resolution.
  const modelNames = new Set<string>();
  for (const node of ast.models) {
    const name = node.name.name;
    if (modelNames.has(name)) {
      throw schemaError(`Duplicate model '${name}'.`, node.name.loc);
    }
    if (enums.has(name)) {
      throw schemaError(
        `Model name '${name}' conflicts with an enum.`,
        node.name.loc,
      );
    }
    if (SCALAR_SET.has(name)) {
      throw schemaError(
        `Model name '${name}' conflicts with a scalar type.`,
        node.name.loc,
      );
    }
    modelNames.add(name);
  }

  const models = new Map<string, ValidatedModel>();

  for (const node of ast.models) {
    models.set(node.name.name, validateModel(node, modelNames, enums));
  }

  return models;
}

function validateModel(
  node: ModelNode,
  modelNames: ReadonlySet<string>,
  enums: ReadonlyMap<string, ValidatedEnum>,
): ValidatedModel {
  const fields = new Map<string, ValidatedField>();
  const idFields: string[] = [];

  for (const field of node.fields) {
    const fieldName = field.name.name;
    if (fields.has(fieldName)) {
      throw schemaError(
        `Duplicate field '${fieldName}' in model '${node.name.name}'.`,
        field.name.loc,
      );
    }

    const validated = validateField(field, node.name.name, modelNames, enums);
    fields.set(fieldName, validated);
    if (validated.isId) {
      idFields.push(fieldName);
    }
  }

  // Block-level @@id
  for (const attr of node.attributes) {
    if (attr.name.name === BlockAttributeName.Id) {
      const names = readIdentifierArrayArg(attr.args, attr.loc, "@@id");
      for (const name of names) {
        if (!fields.has(name)) {
          throw schemaError(
            `@@id references unknown field '${name}' on model '${node.name.name}'.`,
            attr.loc,
          );
        }
        if (!idFields.includes(name)) {
          idFields.push(name);
        }
      }
    }

    if (
      attr.name.name === BlockAttributeName.Unique ||
      attr.name.name === BlockAttributeName.Index
    ) {
      const names = readIdentifierArrayArg(
        attr.args,
        attr.loc,
        `@@${attr.name.name}`,
      );
      for (const name of names) {
        if (!fields.has(name)) {
          throw schemaError(
            `@@${attr.name.name} references unknown field '${name}' on model '${node.name.name}'.`,
            attr.loc,
          );
        }
      }
    }
  }

  if (fields.size === 0) {
    throw schemaError(
      `Model '${node.name.name}' must declare at least one field.`,
      node.loc,
    );
  }

  if (idFields.length === 0) {
    throw schemaError(
      `Model '${node.name.name}' must have an @id field or @@id attribute.`,
      node.name.loc,
    );
  }

  const softDelete = node.attributes.some(
    (attr) => attr.name.name === BlockAttributeName.SoftDelete,
  );

  let deletedAtField: string | undefined;
  if (softDelete) {
    const deletedAt = fields.get(DEFAULT_DELETED_AT_FIELD);
    if (deletedAt === undefined) {
      throw schemaError(
        `Model '${node.name.name}' uses @@softDelete but is missing required field '${DEFAULT_DELETED_AT_FIELD} DateTime?'.`,
        node.loc,
      );
    }
    if (
      deletedAt.typeKind !== "scalar" ||
      deletedAt.typeName !== "DateTime" ||
      !deletedAt.isOptional
    ) {
      throw schemaError(
        `Soft-delete field '${node.name.name}.${DEFAULT_DELETED_AT_FIELD}' must be optional DateTime.`,
        deletedAt.node.loc,
      );
    }
    deletedAtField = DEFAULT_DELETED_AT_FIELD;
  }

  return {
    name: node.name.name,
    node,
    fields,
    idFields,
    softDelete,
    ...(deletedAtField !== undefined ? { deletedAtField } : {}),
  };
}

function validateField(
  field: FieldNode,
  modelName: string,
  modelNames: ReadonlySet<string>,
  enums: ReadonlyMap<string, ValidatedEnum>,
): ValidatedField {
  const named = getNamedType(field.fieldType);
  if (named === undefined) {
    throw schemaError(
      `Field '${field.name.name}' has an invalid type.`,
      field.fieldType.loc,
    );
  }

  const typeName = named.name.name;
  let typeKind: ValidatedField["typeKind"];

  if (SCALAR_SET.has(typeName)) {
    typeKind = "scalar";
  } else if (enums.has(typeName)) {
    typeKind = "enum";
  } else if (modelNames.has(typeName)) {
    typeKind = "model";
  } else {
    throw schemaError(
      `Unknown type '${typeName}' on field '${modelName}.${field.name.name}'.\n\nExpected a scalar, enum, or model.`,
      named.loc,
    );
  }

  const isList = isListFieldType(field.fieldType);
  const isOptional = isOptionalFieldType(field.fieldType);

  let isId = false;
  let isUnique = false;
  let hasDefault = false;
  let isUpdatedAt = false;
  let isRelation = false;

  for (const attr of field.attributes) {
    switch (attr.name.name) {
      case FieldAttributeName.Id:
        isId = true;
        if (isList) {
          throw schemaError(
            `@id cannot be applied to list field '${field.name.name}'.`,
            attr.loc,
          );
        }
        if (typeKind === "model") {
          throw schemaError(
            `@id cannot be applied to relation field '${field.name.name}'.`,
            attr.loc,
          );
        }
        break;
      case FieldAttributeName.Unique:
        isUnique = true;
        break;
      case FieldAttributeName.Default:
        hasDefault = true;
        if (attr.args.length === 0) {
          throw schemaError(`@default requires an argument.`, attr.loc);
        }
        break;
      case FieldAttributeName.UpdatedAt:
        isUpdatedAt = true;
        if (typeName !== "DateTime") {
          throw schemaError(
            `@updatedAt can only be used on DateTime fields.`,
            attr.loc,
          );
        }
        break;
      case FieldAttributeName.Relation:
        isRelation = true;
        if (typeKind !== "model") {
          throw schemaError(
            `@relation can only be used on fields that reference a model.`,
            attr.loc,
          );
        }
        break;
      default:
        // Unknown attributes are allowed for forward compatibility.
        break;
    }
  }

  if (typeKind === "model" && !isRelation && !isList) {
    // Singular model-typed fields must declare @relation(fields:, references:).
    throw schemaError(
      `Relation field '${modelName}.${field.name.name}' must use @relation (or be a list).`,
      field.loc,
    );
  }

  if (isRelation && isList) {
    const relationAttr = field.attributes.find(
      (attr) => attr.name.name === FieldAttributeName.Relation,
    );
    const hasFields =
      relationAttr?.args.some((arg) => arg.name?.name === "fields") ?? false;
    const hasReferences =
      relationAttr?.args.some((arg) => arg.name?.name === "references") ??
      false;
    if (hasFields || hasReferences) {
      throw schemaError(
        `List relation field '${modelName}.${field.name.name}' cannot declare fields/references (put them on the singular side).`,
        relationAttr?.loc ?? field.loc,
      );
    }
  }

  return {
    name: field.name.name,
    node: field,
    typeName,
    typeKind,
    isList,
    isOptional,
    isId,
    isUnique,
    hasDefault,
    isUpdatedAt,
    isRelation,
  };
}

function collectAndValidateRelations(
  ast: SchemaAST,
  models: ReadonlyMap<string, ValidatedModel>,
): ValidatedRelation[] {
  const relations: ValidatedRelation[] = [];

  for (const model of ast.models) {
    const validatedModel = models.get(model.name.name);
    if (validatedModel === undefined) {
      continue;
    }

    for (const field of model.fields) {
      const validatedField = validatedModel.fields.get(field.name.name);
      if (validatedField === undefined || !validatedField.isRelation) {
        continue;
      }

      const relationAttr = field.attributes.find(
        (attr) => attr.name.name === FieldAttributeName.Relation,
      );
      if (relationAttr === undefined) {
        continue;
      }

      const fields = readNamedIdentifierArray(
        relationAttr.args,
        "fields",
        relationAttr.loc,
      );
      const references = readNamedIdentifierArray(
        relationAttr.args,
        "references",
        relationAttr.loc,
      );
      const relationName = readOptionalStringArg(relationAttr.args, "name");
      const onSoftDelete = readSoftDeletePolicyArg(relationAttr.args);

      if (fields.length === 0 || references.length === 0) {
        throw relationError(
          `@relation on '${model.name.name}.${field.name.name}' requires both fields: [...] and references: [...].`,
          relationAttr.loc,
        );
      }

      if (fields.length !== references.length) {
        throw relationError(
          `@relation on '${model.name.name}.${field.name.name}' has mismatched fields/references lengths.`,
          relationAttr.loc,
        );
      }

      for (const localField of fields) {
        if (!validatedModel.fields.has(localField)) {
          throw relationError(
            `@relation fields reference unknown field '${localField}' on model '${model.name.name}'.`,
            relationAttr.loc,
          );
        }
        const local = validatedModel.fields.get(localField);
        if (local?.typeKind === "model") {
          throw relationError(
            `@relation fields must reference scalar/enum fields, not '${localField}'.`,
            relationAttr.loc,
          );
        }
      }

      const referencedModel = models.get(validatedField.typeName);
      if (referencedModel === undefined) {
        throw relationError(
          `@relation references unknown model '${validatedField.typeName}'.`,
          relationAttr.loc,
        );
      }

      for (const refField of references) {
        if (!referencedModel.fields.has(refField)) {
          throw relationError(
            `@relation references unknown field '${refField}' on model '${referencedModel.name}'.`,
            relationAttr.loc,
          );
        }
      }

      if (onSoftDelete === "Nullify") {
        for (const localField of fields) {
          const fkField = validatedModel.fields.get(localField);
          if (fkField !== undefined && !fkField.isOptional) {
            throw relationError(
              `onSoftDelete: Nullify requires optional foreign-key field '${model.name.name}.${localField}'.`,
              relationAttr.loc,
            );
          }
        }
      }

      relations.push({
        ...(relationName !== undefined ? { name: relationName } : {}),
        model: model.name.name,
        field: field.name.name,
        referencedModel: referencedModel.name,
        fields,
        references,
        onSoftDelete,
        span: relationAttr.loc,
      });
    }

    // List relation fields must point at models (already checked via typeKind).
    for (const field of validatedModel.fields.values()) {
      if (field.typeKind === "model" && field.isList) {
        // Opposite side existence is optional in M3; both sides can be declared independently.
        continue;
      }
    }
  }

  return relations;
}

function readNamedIdentifierArray(
  args: readonly AttributeArgNode[],
  name: string,
  span: SourceSpan,
): string[] {
  const arg = args.find((item) => item.name?.name === name);
  if (arg === undefined) {
    return [];
  }
  return expressionToIdentifiers(arg.value, span, name);
}

function readIdentifierArrayArg(
  args: readonly AttributeArgNode[],
  span: SourceSpan,
  label: string,
): string[] {
  const first = args[0];
  if (first === undefined) {
    throw schemaError(
      `${label} requires a field list argument, e.g. ${label}([id]).`,
      span,
    );
  }
  return expressionToIdentifiers(first.value, span, label);
}

function expressionToIdentifiers(
  value: ExpressionNode,
  span: SourceSpan,
  label: string,
): string[] {
  if (!isArrayExpression(value)) {
    throw schemaError(`${label} expects an array of identifiers.`, span);
  }
  return value.elements.map((element) => {
    if (!isIdentifier(element)) {
      throw schemaError(
        `${label} expects identifiers inside the array.`,
        element.loc,
      );
    }
    return element.name;
  });
}

function readSoftDeletePolicyArg(
  args: readonly AttributeArgNode[],
): SoftDeletePolicy {
  const arg = args.find((item) => item.name?.name === "onSoftDelete");
  if (arg === undefined) {
    return DEFAULT_SOFT_DELETE_POLICY;
  }

  let raw: string | undefined;
  if (arg.value.kind === "StringLiteral") {
    raw = arg.value.value;
  } else if (isIdentifier(arg.value)) {
    raw = arg.value.name;
  }

  if (raw === undefined || !SOFT_DELETE_POLICIES.has(raw as SoftDeletePolicy)) {
    throw relationError(
      `Invalid onSoftDelete policy '${raw ?? ""}'. Expected Cascade, Restrict, Nullify, or Ignore.`,
      arg.loc,
    );
  }

  return raw as SoftDeletePolicy;
}

function readOptionalStringArg(
  args: readonly AttributeArgNode[],
  name: string,
): string | undefined {
  const arg = args.find((item) => item.name?.name === name);
  if (arg === undefined) {
    return undefined;
  }
  if (arg.value.kind === "StringLiteral") {
    return arg.value.value;
  }
  if (isIdentifier(arg.value)) {
    return arg.value.name;
  }
  return undefined;
}

function schemaError(message: string, span: SourceSpan): SchemaError {
  return new SchemaError(message, { code: ZedErrorCode.SCHEMA, span });
}

function relationError(message: string, span: SourceSpan): SchemaError {
  return new SchemaError(message, { code: ZedErrorCode.RELATION, span });
}
