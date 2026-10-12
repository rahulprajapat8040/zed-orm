import type {
  DatasourceNode,
  EnumNode,
  FieldNode,
  GeneratorNode,
  ModelNode,
  SchemaAST,
  SourceSpan,
} from "@zed-orm/ast";

export type FieldTypeKind = "scalar" | "enum" | "model";

export interface ValidatedField {
  readonly name: string;
  readonly node: FieldNode;
  readonly typeName: string;
  readonly typeKind: FieldTypeKind;
  readonly isList: boolean;
  readonly isOptional: boolean;
  readonly isId: boolean;
  readonly isUnique: boolean;
  readonly hasDefault: boolean;
  readonly isUpdatedAt: boolean;
  readonly isRelation: boolean;
}

export interface ValidatedModel {
  readonly name: string;
  readonly node: ModelNode;
  readonly fields: ReadonlyMap<string, ValidatedField>;
  readonly idFields: readonly string[];
  readonly softDelete: boolean;
  /** Field storing the soft-delete timestamp (defaults to `deletedAt`). */
  readonly deletedAtField?: string;
}

export interface ValidatedEnum {
  readonly name: string;
  readonly node: EnumNode;
  readonly values: ReadonlySet<string>;
}

/** Relational soft-delete propagation policy on `@relation`. */
export type SoftDeletePolicy = "Cascade" | "Restrict" | "Nullify" | "Ignore";

export interface ValidatedRelation {
  readonly name?: string;
  readonly model: string;
  readonly field: string;
  readonly referencedModel: string;
  readonly fields: readonly string[];
  readonly references: readonly string[];
  readonly onSoftDelete: SoftDeletePolicy;
  readonly span: SourceSpan;
}

/**
 * Semantically validated schema graph.
 * Safe for generators and migrations to consume.
 */
export interface ValidatedSchema {
  readonly ast: SchemaAST;
  readonly datasources: readonly DatasourceNode[];
  readonly generators: readonly GeneratorNode[];
  readonly models: ReadonlyMap<string, ValidatedModel>;
  readonly enums: ReadonlyMap<string, ValidatedEnum>;
  readonly relations: readonly ValidatedRelation[];
}
