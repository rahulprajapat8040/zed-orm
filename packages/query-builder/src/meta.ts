import type { SoftDeletePolicy } from "./soft-delete.js";

/** Supported SQL dialects for query compilation. */
export type SqlDialect = "postgresql" | "mysql";

/** Scalar field kinds stored in the database. */
export type ScalarKind =
  | "String"
  | "Int"
  | "BigInt"
  | "Float"
  | "Decimal"
  | "Boolean"
  | "DateTime"
  | "Json"
  | "Bytes";

/** Metadata for a single model field used during SQL generation. */
export interface FieldMeta {
  readonly name: string;
  readonly columnName: string;
  readonly scalarKind?: ScalarKind;
  readonly enumName?: string;
  readonly isRelation: boolean;
  readonly isId: boolean;
  readonly isUnique: boolean;
  readonly isList: boolean;
  /** Field annotated with `@updatedAt` — auto-managed on create/update. */
  readonly isUpdatedAt?: boolean;
}

/** Relation cardinality from the owning model's perspective. */
export type RelationKind =
  | "oneToOne"
  | "manyToOne"
  | "oneToMany"
  | "manyToMany";

/** Metadata for a relation field on a model. */
export interface RelationMeta {
  readonly fieldName: string;
  readonly relatedModel: string;
  readonly kind: RelationKind;
  /** FK column names on this model (empty when FK lives on the related model). */
  readonly localFkFields: readonly string[];
  /** Referenced column names on the related model. */
  readonly foreignKeyFields: readonly string[];
  /** Opposite relation field name when known. */
  readonly reverseFieldName?: string;
  /** Implicit join table for many-to-many (alphabetical A/B column names). */
  readonly joinTable?: {
    readonly tableName: string;
    readonly localColumn: string;
    readonly foreignColumn: string;
  };
  /** Relational soft-delete policy when the referenced parent is deleted. */
  readonly onSoftDelete?: SoftDeletePolicy;
}

/** Metadata for a model table used during SQL generation. */
export interface ModelMeta {
  readonly modelName: string;
  readonly tableName: string;
  readonly fields: ReadonlyMap<string, FieldMeta>;
  readonly idFields: readonly string[];
  readonly relations: ReadonlyMap<string, RelationMeta>;
  /** Whether the model opts into soft delete via `@@softDelete`. */
  readonly softDelete?: boolean;
  /** Timestamp field used for soft delete (defaults to `deletedAt`). */
  readonly deletedAtField?: string;
}

/** Return scalar (non-relation) fields in stable declaration order. */
export function getScalarFields(meta: ModelMeta): readonly FieldMeta[] {
  return [...meta.fields.values()].filter((field) => !field.isRelation);
}

/** Return fields that can uniquely identify a row (@id or @unique). */
export function getUniqueFields(meta: ModelMeta): readonly FieldMeta[] {
  return getScalarFields(meta).filter(
    (field) => field.isId || field.isUnique,
  );
}
