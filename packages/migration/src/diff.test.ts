import { describe, expect, it } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";
import { diffSchemas } from "./diff.js";
import { renderMigration } from "./render.js";
import { createSnapshot, emptySnapshot } from "./snapshot.js";

const initialSource = `
model User {
  id    String @id
  email String @unique
}
`;

const extendedSource = `
model User {
  id    String @id
  email String @unique
  name  String
}

model Post {
  id       String @id
  title    String
  authorId String
  author   User @relation(fields: [authorId], references: [id])
}
`;

describe("diffSchemas", () => {
  it("creates tables for an initial migration", () => {
    const to = createSnapshot(
      validateSchema(parseSchema(initialSource, "schema.zed")),
    );
    const result = diffSchemas(emptySnapshot(), to);

    expect(result.operations.some((op) => op.op === "createTable")).toBe(true);
    expect(result.warnings).toHaveLength(0);

    const rendered = renderMigration(to.provider, result.operations);
    expect(rendered.sql).toContain('CREATE TABLE "User"');
    expect(rendered.sql).toContain('"email" TEXT NOT NULL');
  });

  it("detects added columns and new tables", () => {
    const from = createSnapshot(
      validateSchema(parseSchema(initialSource, "schema.zed")),
    );
    const to = createSnapshot(
      validateSchema(parseSchema(extendedSource, "schema.zed")),
    );
    const result = diffSchemas(from, to);

    expect(result.operations.some((op) => op.op === "addColumn")).toBe(true);
    expect(result.operations.some((op) => op.op === "createTable")).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns on destructive drops", () => {
    const from = createSnapshot(
      validateSchema(parseSchema(extendedSource, "schema.zed")),
    );
    const to = createSnapshot(
      validateSchema(parseSchema(initialSource, "schema.zed")),
    );
    const result = diffSchemas(from, to);

    expect(result.warnings.some((warning) => warning.kind === "dropTable")).toBe(
      true,
    );
    expect(result.warnings.some((warning) => warning.kind === "dropColumn")).toBe(
      true,
    );
  });
});
