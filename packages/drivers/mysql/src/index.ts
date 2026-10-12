/**
 * @zed-orm/driver-mysql
 *
 * MySQL driver for Zed ORM.
 */

export const PACKAGE_NAME = "@zed-orm/driver-mysql" as const;

export { DriverError, type DriverErrorOptions } from "./errors.js";
export { MysqlDriver, createMysqlDriver } from "./driver.js";
export type { MysqlDriverOptions } from "./types.js";
