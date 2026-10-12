import { bench, describe } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";
import {
  createSnapshot,
  diffSchemas,
  emptySnapshot,
} from "@zed-orm/migration";

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
  author   User @relation(fields: [authorId], references: [id])
}
`;

const snapshot = createSnapshot(
  validateSchema(parseSchema(schemaSource, "schema.zed")),
);

describe("migration diff", () => {
  bench("diffSchemas (empty -> schema)", () => {
    diffSchemas(emptySnapshot(), snapshot);
  });
});
