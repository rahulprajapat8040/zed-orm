/** Options for {@link createPostgresDriver}. */
export interface PostgresDriverOptions {
  /** PostgreSQL connection URL (`postgresql://…`). */
  readonly databaseUrl: string;
  /** Maximum pool size. Defaults to `10`. */
  readonly max?: number;
  /** Connection timeout in milliseconds. */
  readonly connectionTimeoutMillis?: number;
  /** Idle client timeout in milliseconds. */
  readonly idleTimeoutMillis?: number;
}
