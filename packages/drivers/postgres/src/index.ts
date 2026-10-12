/**
 * @zed-orm/driver-postgres
 *
 * PostgreSQL driver for Zed ORM.
 */

export const PACKAGE_NAME = "@zed-orm/driver-postgres" as const;

export { DriverError, type DriverErrorOptions } from "./errors.js";
export {
  PostgresDriver,
  createPostgresDriver,
} from "./driver.js";
export type { PostgresDriverOptions } from "./types.js";
