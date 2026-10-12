/** A compiled SQL statement with bind parameters. */
export interface SqlStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export type ScalarValue = string | number | boolean | bigint | Date | null;

/** Field-level filter operators. */
export interface FieldFilter {
  readonly equals?: ScalarValue;
  readonly not?: ScalarValue | { readonly equals?: ScalarValue };
  readonly in?: readonly ScalarValue[];
  readonly notIn?: readonly ScalarValue[];
  readonly lt?: ScalarValue;
  readonly lte?: ScalarValue;
  readonly gt?: ScalarValue;
  readonly gte?: ScalarValue;
}

export type FieldWhereInput = ScalarValue | FieldFilter;

/** Where clause input (field filters combined with AND by default). */
export type WhereInput = {
  readonly [field: string]: FieldWhereInput | undefined;
} & {
  readonly AND?: readonly WhereInput[];
  readonly OR?: readonly WhereInput[];
};

export type SelectInput = Readonly<Record<string, boolean>>;

export type OrderDirection = "asc" | "desc";

export type OrderByInput =
  | Readonly<Record<string, OrderDirection>>
  | readonly Readonly<Record<string, OrderDirection>>[];

export interface SoftDeleteReadOptions {
  /** Include soft-deleted rows (default reads exclude them). */
  readonly withDeleted?: boolean;
  /** Return only soft-deleted rows. */
  readonly onlyDeleted?: boolean;
}

export interface FindManyArgs extends SoftDeleteReadOptions {
  readonly where?: WhereInput;
  readonly select?: SelectInput;
  readonly orderBy?: OrderByInput;
  readonly take?: number;
  readonly skip?: number;
}

export interface FindFirstArgs extends SoftDeleteReadOptions {
  readonly where?: WhereInput;
  readonly select?: SelectInput;
  readonly orderBy?: OrderByInput;
  readonly skip?: number;
}

export interface FindUniqueArgs extends SoftDeleteReadOptions {
  readonly where: WhereInput;
  readonly select?: SelectInput;
}

/** Scalar values accepted in create/update data. */
export type DataInput = Readonly<Record<string, ScalarValue>>;

export interface CreateArgs {
  readonly data: DataInput;
  readonly select?: SelectInput;
}

export interface CreateManyArgs {
  readonly data: readonly DataInput[];
  readonly select?: SelectInput;
}

export interface UpdateArgs {
  readonly where: WhereInput;
  readonly data: DataInput;
  readonly select?: SelectInput;
}

export interface UpdateManyArgs {
  readonly where?: WhereInput;
  readonly data: DataInput;
}

export interface DeleteArgs {
  readonly where: WhereInput;
  readonly select?: SelectInput;
  /** Timestamp written to `deletedAt` (defaults to `new Date()`). */
  readonly deletedAt?: Date;
}

export interface DeleteManyArgs {
  readonly where?: WhereInput;
  /** Timestamp written to `deletedAt` (defaults to `new Date()`). */
  readonly deletedAt?: Date;
}

export interface RestoreArgs {
  readonly where: WhereInput;
  readonly select?: SelectInput;
}

export interface RestoreManyArgs {
  readonly where?: WhereInput;
}

/** Nested relation loading for reads. */
export type RelationLoadArgs = {
  readonly select?: SelectInput;
  readonly include?: IncludeInput;
};

export type IncludeInput = Readonly<
  Record<string, boolean | RelationLoadArgs | undefined>
>;

export interface FindManyArgsWithInclude extends FindManyArgs {
  readonly include?: IncludeInput;
}

export interface FindFirstArgsWithInclude extends FindFirstArgs {
  readonly include?: IncludeInput;
}

export interface FindUniqueArgsWithInclude extends FindUniqueArgs {
  readonly include?: IncludeInput;
}
