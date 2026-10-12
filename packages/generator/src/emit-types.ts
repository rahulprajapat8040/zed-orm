import type {
  ValidatedEnum,
  ValidatedField,
  ValidatedModel,
  ValidatedSchema,
} from "@zed-orm/schema";
import { fieldToTsType } from "./type-mapping.js";
import { modelToRelations } from "./schema-to-relations.js";

function emitEnum(enumNode: ValidatedEnum): string {
  const values = [...enumNode.values].sort().map((value) => `'${value}'`);
  return `export type ${enumNode.name} = ${values.join(" | ")};`;
}

function isStoredField(field: ValidatedField): boolean {
  return field.typeKind !== "model";
}

function emitScalarFields(model: ValidatedModel): readonly string[] {
  return [...model.fields.values()]
    .filter((field) => isStoredField(field))
    .map((field) => field.name);
}

function emitRelationFields(model: ValidatedModel): readonly ValidatedField[] {
  return [...model.fields.values()].filter((field) => field.typeKind === "model");
}

function emitModelType(model: ValidatedModel): string {
  const scalarLines = [...model.fields.values()]
    .filter((field) => isStoredField(field))
    .map((field) => `  readonly ${field.name}: ${fieldToTsType(field)};`);

  const relationLines = emitRelationFields(model).map(
    (field) => `  readonly ${field.name}?: ${fieldToTsType(field)};`,
  );

  const lines = [...scalarLines, ...relationLines];
  return `export type ${model.name} = {\n${lines.join("\n")}\n};`;
}

function emitWhereInput(model: ValidatedModel): string {
  const scalarFields = emitScalarFields(model);
  const fieldLines = scalarFields.map(
    (field) => `  readonly ${field}?: FieldWhereInput;`,
  );

  return `export type ${model.name}WhereInput = {\n${fieldLines.join("\n")}\n  readonly AND?: readonly ${model.name}WhereInput[];\n  readonly OR?: readonly ${model.name}WhereInput[];\n};`;
}

function emitSelectInput(model: ValidatedModel): string {
  const scalarFields = emitScalarFields(model);
  const fieldLines = scalarFields.map(
    (field) => `  readonly ${field}?: boolean;`,
  );

  return `export type ${model.name}Select = {\n${fieldLines.join("\n")}\n};`;
}

function emitOrderByInput(model: ValidatedModel): string {
  const scalarFields = emitScalarFields(model);
  const fieldLines = scalarFields.map(
    (field) => `  readonly ${field}?: OrderDirection;`,
  );

  return `export type ${model.name}OrderByInput = {\n${fieldLines.join("\n")}\n};`;
}

function emitIncludeInput(model: ValidatedModel, schema: ValidatedSchema): string {
  const relations = modelToRelations(schema, model);
  if (relations.size === 0) {
    return `export type ${model.name}Include = Record<string, never>;`;
  }

  const fieldLines = [...relations.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fieldName, relation]) => {
      const nestedInclude = `${relation.relatedModel}Include`;
      const nestedSelect = `${relation.relatedModel}Select`;
      const isList =
        relation.kind === "oneToMany" || relation.kind === "manyToMany";
      const nestedType = isList
        ? `boolean | { readonly select?: ${nestedSelect}; readonly include?: ${nestedInclude} }`
        : `boolean | { readonly select?: ${nestedSelect}; readonly include?: ${nestedInclude} }`;
      return `  readonly ${fieldName}?: ${nestedType};`;
    });

  return `export type ${model.name}Include = {\n${fieldLines.join("\n")}\n};`;
}

function isWritableOnCreate(field: ValidatedField): boolean {
  return isStoredField(field);
}

function isWritableOnUpdate(field: ValidatedField): boolean {
  return isStoredField(field) && !field.isId && !field.isUpdatedAt;
}

function emitCreateInput(model: ValidatedModel): string {
  const fields = [...model.fields.values()].filter(isWritableOnCreate);
  const fieldLines = fields.map((field) => {
    const optional =
      field.isOptional || field.hasDefault || field.isUpdatedAt ? "?" : "";
    return `  readonly ${field.name}${optional}: ${fieldToTsType(field)};`;
  });

  return `export type ${model.name}CreateInput = {\n${fieldLines.join("\n")}\n};`;
}

function emitUpdateInput(model: ValidatedModel): string {
  const fields = [...model.fields.values()].filter(isWritableOnUpdate);
  const fieldLines = fields.map(
    (field) => `  readonly ${field.name}?: ${fieldToTsType(field)};`,
  );

  return `export type ${model.name}UpdateInput = {\n${fieldLines.join("\n")}\n};`;
}

function emitSoftDeleteReadOptions(model: ValidatedModel): readonly string[] {
  if (!model.softDelete) {
    return [];
  }
  return [
    `  readonly withDeleted?: boolean;`,
    `  readonly onlyDeleted?: boolean;`,
  ];
}

function emitReadArgs(model: ValidatedModel): string {
  const softDeleteOptions = emitSoftDeleteReadOptions(model);
  return [
    `export type ${model.name}FindManyArgs = {`,
    `  readonly where?: ${model.name}WhereInput;`,
    `  readonly select?: ${model.name}Select;`,
    `  readonly include?: ${model.name}Include;`,
    `  readonly orderBy?: ${model.name}OrderByInput | readonly ${model.name}OrderByInput[];`,
    `  readonly take?: number;`,
    `  readonly skip?: number;`,
    ...softDeleteOptions,
    `};`,
    ``,
    `export type ${model.name}FindFirstArgs = {`,
    `  readonly where?: ${model.name}WhereInput;`,
    `  readonly select?: ${model.name}Select;`,
    `  readonly include?: ${model.name}Include;`,
    `  readonly orderBy?: ${model.name}OrderByInput | readonly ${model.name}OrderByInput[];`,
    `  readonly skip?: number;`,
    ...softDeleteOptions,
    `};`,
    ``,
    `export type ${model.name}FindUniqueArgs = {`,
    `  readonly where: ${model.name}WhereInput;`,
    `  readonly select?: ${model.name}Select;`,
    `  readonly include?: ${model.name}Include;`,
    ...softDeleteOptions,
    `};`,
  ].join("\n");
}

function emitWriteArgs(model: ValidatedModel): string {
  return [
    `export type ${model.name}CreateArgs = {`,
    `  readonly data: ${model.name}CreateInput;`,
    `  readonly select?: ${model.name}Select;`,
    `};`,
    ``,
    `export type ${model.name}CreateManyArgs = {`,
    `  readonly data: readonly ${model.name}CreateInput[];`,
    `  readonly select?: ${model.name}Select;`,
    `};`,
    ``,
    `export type ${model.name}UpdateArgs = {`,
    `  readonly where: ${model.name}WhereInput;`,
    `  readonly data: ${model.name}UpdateInput;`,
    `  readonly select?: ${model.name}Select;`,
    `};`,
    ``,
    `export type ${model.name}UpdateManyArgs = {`,
    `  readonly where?: ${model.name}WhereInput;`,
    `  readonly data: ${model.name}UpdateInput;`,
    `};`,
    ``,
    `export type ${model.name}DeleteArgs = {`,
    `  readonly where: ${model.name}WhereInput;`,
    `  readonly select?: ${model.name}Select;`,
    `};`,
    ``,
    `export type ${model.name}DeleteManyArgs = {`,
    `  readonly where?: ${model.name}WhereInput;`,
    `};`,
    ...(model.softDelete
      ? [
          ``,
          `export type ${model.name}RestoreArgs = {`,
          `  readonly where: ${model.name}WhereInput;`,
          `  readonly select?: ${model.name}Select;`,
          `};`,
          ``,
          `export type ${model.name}RestoreManyArgs = {`,
          `  readonly where?: ${model.name}WhereInput;`,
          `};`,
        ]
      : []),
  ].join("\n");
}

/** Emit TypeScript model and query argument types. */
export function emitTypes(schema: ValidatedSchema): string {
  const enums = [...schema.enums.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const models = [...schema.models.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  const sections: string[] = [
    "// This file is generated by `zed generate`. Do not edit manually.",
    "",
    'import type { FieldWhereInput, OrderDirection } from "@zed-orm/query-builder";',
    "",
  ];

  if (enums.length > 0) {
    sections.push("// Enums", ...enums.map((enumNode) => emitEnum(enumNode)), "");
  }

  if (models.length > 0) {
    sections.push("// Models", ...models.map((model) => emitModelType(model)), "");
    sections.push(
      "// Query inputs",
      ...models.flatMap((model) => [
        emitWhereInput(model),
        "",
        emitSelectInput(model),
        "",
        emitOrderByInput(model),
        "",
        emitIncludeInput(model, schema),
        "",
        emitCreateInput(model),
        "",
        emitUpdateInput(model),
        "",
        emitReadArgs(model),
        "",
        emitWriteArgs(model),
        "",
      ]),
    );
  }

  return sections.join("\n").trimEnd() + "\n";
}
