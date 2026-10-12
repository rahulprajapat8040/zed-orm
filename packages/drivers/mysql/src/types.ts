/** Options for {@link createMysqlDriver}. */
export interface MysqlDriverOptions {
  /** MySQL connection URL (`mysql://…`). */
  readonly databaseUrl: string;
  /** Maximum pool size. Defaults to `10`. */
  readonly connectionLimit?: number;
  /** Connection timeout in milliseconds. */
  readonly connectTimeout?: number;
}
