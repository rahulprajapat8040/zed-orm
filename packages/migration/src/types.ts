/** Supported database providers for migrations. */
export type MigrationProvider = "postgresql" | "mysql";

/** Serializable default expression for a column. */
export type SnapshotDefault =
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "function"; name: string };

/** Column type in a schema snapshot. */
export type SnapshotColumnType =
  | { kind: "scalar"; scalar: string }
  | { kind: "enum"; enumName: string; values: readonly string[] };

export interface SnapshotColumn {
  readonly name: string;
  readonly type: SnapshotColumnType;
  readonly nullable: boolean;
  readonly isUnique: boolean;
  readonly default?: SnapshotDefault;
}

export interface SnapshotIndex {
  readonly name: string;
  readonly columns: readonly string[];
}

export interface SnapshotUnique {
  readonly name: string;
  readonly columns: readonly string[];
}

export interface SnapshotForeignKey {
  readonly name: string;
  readonly columns: readonly string[];
  readonly referencedTable: string;
  readonly referencedColumns: readonly string[];
}

export interface SnapshotTable {
  readonly name: string;
  readonly columns: readonly SnapshotColumn[];
  readonly primaryKey: readonly string[];
  readonly indexes: readonly SnapshotIndex[];
  readonly uniqueConstraints: readonly SnapshotUnique[];
  readonly foreignKeys: readonly SnapshotForeignKey[];
  readonly isJoinTable?: boolean;
}

export interface SnapshotEnum {
  readonly name: string;
  readonly values: readonly string[];
}

/** Serializable schema snapshot for diffing and migration history. */
export interface SchemaSnapshot {
  readonly version: 1;
  readonly provider: MigrationProvider;
  readonly enums: readonly SnapshotEnum[];
  readonly tables: readonly SnapshotTable[];
}

export type MigrationOp =
  | { readonly op: "createEnum"; readonly name: string; readonly values: readonly string[] }
  | { readonly op: "addEnumValue"; readonly enumName: string; readonly value: string }
  | { readonly op: "createTable"; readonly table: SnapshotTable }
  | { readonly op: "dropTable"; readonly tableName: string }
  | { readonly op: "addColumn"; readonly tableName: string; readonly column: SnapshotColumn }
  | { readonly op: "dropColumn"; readonly tableName: string; readonly columnName: string }
  | {
      readonly op: "alterColumn";
      readonly tableName: string;
      readonly from: SnapshotColumn;
      readonly to: SnapshotColumn;
    }
  | { readonly op: "createIndex"; readonly tableName: string; readonly index: SnapshotIndex }
  | { readonly op: "dropIndex"; readonly tableName: string; readonly indexName: string }
  | { readonly op: "addUnique"; readonly tableName: string; readonly unique: SnapshotUnique }
  | { readonly op: "dropUnique"; readonly tableName: string; readonly constraintName: string }
  | {
      readonly op: "addForeignKey";
      readonly tableName: string;
      readonly foreignKey: SnapshotForeignKey;
    }
  | { readonly op: "dropForeignKey"; readonly tableName: string; readonly constraintName: string };

export type MigrationWarningKind =
  | "dropTable"
  | "dropColumn"
  | "alterColumnType"
  | "makeRequired"
  | "dropIndex"
  | "dropUnique"
  | "dropForeignKey"
  | "dropEnum";

export interface MigrationWarning {
  readonly kind: MigrationWarningKind;
  readonly message: string;
  readonly operation: MigrationOp;
}

export interface DiffResult {
  readonly operations: readonly MigrationOp[];
  readonly warnings: readonly MigrationWarning[];
}

export interface RenderedMigration {
  readonly sql: string;
  readonly statements: readonly string[];
}

/** Query result for migration execution. */
export interface MigrationQueryResult<T = unknown> {
  readonly rows: readonly T[];
  readonly rowCount: number;
}

/** Minimal query executor for applying migrations. */
export interface MigrationExecutor {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<MigrationQueryResult<T>>;
}

export interface MigrationRecord {
  readonly name: string;
  readonly appliedAt: Date;
}

export interface PendingMigration {
  readonly name: string;
  readonly path: string;
  readonly sql: string;
}

export interface MigrationStatus {
  readonly applied: readonly MigrationRecord[];
  readonly pending: readonly PendingMigration[];
}
