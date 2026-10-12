import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";
import { PACKAGE_NAME, generateClient } from "./index.js";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/simple",
);

const schemaSource = `
enum Role {
  USER
  ADMIN
}

model User {
  id    String @id @default(uuid())
  email String @unique
  role  Role
  posts Post[]
}

model Post {
  id       String @id
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
`;

describe("@zed-orm/generator", () => {
  it("exports package identity", () => {
    expect(PACKAGE_NAME).toBe("@zed-orm/generator");
  });

  it("generates deterministic client files", () => {
    const schema = validateSchema(parseSchema(schemaSource, "schema.zed"));
    const first = generateClient(schema);
    const second = generateClient(schema);

    expect(first.files.map((file) => file.path)).toEqual([
      "types.ts",
      "meta.ts",
      "client.ts",
      "index.ts",
    ]);
    expect(first).toEqual(second);
  });

  it("matches committed fixture output", () => {
    const schema = validateSchema(parseSchema(schemaSource, "schema.zed"));
    const generated = generateClient(schema);

    for (const file of generated.files) {
      const expected = readFileSync(join(fixtureDir, file.path), "utf8");
      expect(file.content).toBe(expected);
    }
  });
});
