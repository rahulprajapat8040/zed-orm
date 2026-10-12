import { describe, expect, it } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";
import { diffSchemas } from "./diff.js";
import { renderMigration } from "./render.js";
import { createSnapshot, emptySnapshot } from "./snapshot.js";

describe("renderMigration", () => {
  it("renders enum types and foreign keys", () => {
    const source = `
enum Role {
  USER
  ADMIN
}

model User {
  id    String @id
  email String @unique
  role  Role
}

model Post {
  id       String @id
  title    String
  authorId String
  author   User @relation(fields: [authorId], references: [id])
}
`;

    const snapshot = createSnapshot(
      validateSchema(parseSchema(source, "schema.zed")),
    );
    const diff = diffSchemas(emptySnapshot(), snapshot);
    const rendered = renderMigration(snapshot.provider, diff.operations);

    expect(rendered.sql).toContain('CREATE TYPE "Role" AS ENUM');
    expect(rendered.sql).toContain('REFERENCES "User"');
    expect(rendered.statements.length).toBeGreaterThan(1);
  });

  it("renders inline MySQL enums without CREATE TYPE", () => {
    const source = `
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

model User {
  id    String @id
  email String @unique
  role  Role
}
`;

    const snapshot = createSnapshot(
      validateSchema(parseSchema(source, "schema.zed")),
    );
    expect(snapshot.provider).toBe("mysql");

    const diff = diffSchemas(emptySnapshot("mysql"), snapshot);
    const rendered = renderMigration(snapshot.provider, diff.operations);

    expect(rendered.sql).not.toContain("CREATE TYPE");
    expect(rendered.sql).toContain("ENUM('USER', 'ADMIN')");
    expect(rendered.sql).toContain("CREATE TABLE `User`");
  });
});
