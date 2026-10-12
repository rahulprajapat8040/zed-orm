import { describe, expect, it } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";
import { createSnapshot, emptySnapshot, serializeSnapshot } from "./snapshot.js";

const simpleSource = `
enum Role {
  USER
  ADMIN
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  role      Role
  posts     Post[]
}

model Post {
  id       String @id
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
`;

describe("createSnapshot", () => {
  it("builds enums, tables, indexes, and foreign keys", () => {
    const schema = validateSchema(parseSchema(simpleSource, "schema.zed"));
    const snapshot = createSnapshot(schema);

    expect(snapshot.version).toBe(1);
    expect(snapshot.provider).toBe("postgresql");
    expect(snapshot.enums).toEqual([
      { name: "Role", values: ["ADMIN", "USER"] },
    ]);

    const user = snapshot.tables.find((table) => table.name === "User");
    expect(user).toBeDefined();
    expect(user?.primaryKey).toEqual(["id"]);
    expect(user?.columns.map((column) => column.name)).toEqual([
      "id",
      "email",
      "role",
    ]);
    expect(user?.uniqueConstraints.some((unique) => unique.columns.includes("email"))).toBe(
      true,
    );

    const post = snapshot.tables.find((table) => table.name === "Post");
    expect(post?.foreignKeys).toHaveLength(1);
    expect(post?.foreignKeys[0]?.referencedTable).toBe("User");
  });

  it("round-trips through JSON serialization", () => {
    const schema = validateSchema(parseSchema(simpleSource, "schema.zed"));
    const snapshot = createSnapshot(schema);
    const restored = JSON.parse(serializeSnapshot(snapshot));
    expect(restored.tables.map((table: { name: string }) => table.name)).toEqual(
      snapshot.tables.map((table) => table.name),
    );
  });

  it("includes implicit many-to-many join tables", () => {
    const source = `
model Post {
  id   String @id
  tags Tag[]
}

model Tag {
  id    String @id
  posts Post[]
}
`;
    const snapshot = createSnapshot(
      validateSchema(parseSchema(source, "schema.zed")),
    );
    expect(snapshot.tables.some((table) => table.name === "_PostToTag")).toBe(true);
  });

  it("starts from an empty snapshot", () => {
    expect(emptySnapshot()).toEqual({
      version: 1,
      provider: "postgresql",
      enums: [],
      tables: [],
    });
  });
});
