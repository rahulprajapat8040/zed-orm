import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DriverError, createMysqlDriver } from "./index.js";

const databaseUrl = process.env["MYSQL_DATABASE_URL"];

describe.skipIf(databaseUrl === undefined)(
  "@zed-orm/driver-mysql integration",
  () => {
    const driver = createMysqlDriver({ databaseUrl: databaseUrl! });
    const tableName = `zed_driver_test_${Date.now()}`;

    beforeAll(async () => {
      await driver.connect();
      await driver.query(
        `CREATE TABLE \`${tableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        )`,
      );
    });

    afterAll(async () => {
      await driver.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      await driver.disconnect();
    });

    it("connects and runs a health check", async () => {
      const result = await driver.query<{ one: number }>("SELECT 1 AS one");
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]?.one).toBe(1);
    });

    it("executes parameterized queries", async () => {
      await driver.query(
        `INSERT INTO \`${tableName}\` (name) VALUES (?)`,
        ["alice"],
      );

      const result = await driver.query<{ name: string }>(
        `SELECT name FROM \`${tableName}\` WHERE name = ?`,
        ["alice"],
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]?.name).toBe("alice");
    });

    it("commits successful transactions", async () => {
      await driver.transaction(async (tx) => {
        await tx.query(`INSERT INTO \`${tableName}\` (name) VALUES (?)`, [
          "bob",
        ]);
      });

      const result = await driver.query<{ name: string }>(
        `SELECT name FROM \`${tableName}\` WHERE name = ?`,
        ["bob"],
      );
      expect(result.rowCount).toBe(1);
    });

    it("rolls back failed transactions", async () => {
      await expect(
        driver.transaction(async (tx) => {
          await tx.query(`INSERT INTO \`${tableName}\` (name) VALUES (?)`, [
            "charlie",
          ]);
          throw new Error("force rollback");
        }),
      ).rejects.toThrow("force rollback");

      const result = await driver.query<{ name: string }>(
        `SELECT name FROM \`${tableName}\` WHERE name = ?`,
        ["charlie"],
      );
      expect(result.rowCount).toBe(0);
    });

    it("uses savepoints for nested transactions", async () => {
      await driver.transaction(async (tx) => {
        await tx.query(`INSERT INTO \`${tableName}\` (name) VALUES (?)`, [
          "outer",
        ]);

        await expect(
          tx.transaction(async (nested) => {
            await nested.query(
              `INSERT INTO \`${tableName}\` (name) VALUES (?)`,
              ["inner"],
            );
            throw new Error("nested rollback");
          }),
        ).rejects.toThrow("nested rollback");
      });

      const outer = await driver.query<{ name: string }>(
        `SELECT name FROM \`${tableName}\` WHERE name = ?`,
        ["outer"],
      );
      const inner = await driver.query<{ name: string }>(
        `SELECT name FROM \`${tableName}\` WHERE name = ?`,
        ["inner"],
      );

      expect(outer.rowCount).toBe(1);
      expect(inner.rowCount).toBe(0);
    });

    it("wraps query failures in DriverError", async () => {
      await expect(
        driver.query(`SELECT * FROM \`${tableName}\` WHERE bad_column = ?`, [
          1,
        ]),
      ).rejects.toThrow(DriverError);
    });
  },
);
