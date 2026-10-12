import type { RelationKind, SoftDeletePolicy } from "@zed-orm/query-builder";

/** Scalar field kinds mirrored for code generation (kept in sync with query-builder). */
export type GeneratorScalarKind =
  | "String"
  | "Int"
  | "BigInt"
  | "Float"
  | "Decimal"
  | "Boolean"
  | "DateTime"
  | "Json"
  | "Bytes";

export interface GeneratorFieldMeta {
  readonly name: string;
  readonly columnName: string;
  readonly scalarKind?: GeneratorScalarKind;
  readonly enumName?: string;
  readonly isRelation: boolean;
  readonly isId: boolean;
  readonly isUnique: boolean;
  readonly isList: boolean;
  readonly isUpdatedAt?: boolean;
}

export interface GeneratorRelationMeta {
  readonly fieldName: string;
  readonly relatedModel: string;
  readonly kind: RelationKind;
  readonly localFkFields: readonly string[];
  readonly foreignKeyFields: readonly string[];
  readonly reverseFieldName?: string;
  readonly joinTable?: {
    readonly tableName: string;
    readonly localColumn: string;
    readonly foreignColumn: string;
  };
  readonly onSoftDelete?: SoftDeletePolicy;
}

export interface GeneratorModelMeta {
  readonly modelName: string;
  readonly tableName: string;
  readonly fields: ReadonlyMap<string, GeneratorFieldMeta>;
  readonly idFields: readonly string[];
  readonly relations: ReadonlyMap<string, GeneratorRelationMeta>;
  readonly softDelete?: boolean;
  readonly deletedAtField?: string;
}
