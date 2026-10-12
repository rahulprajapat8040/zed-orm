import { bench, describe } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";

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

describe("schema parse + validate", () => {
  bench("parseSchema", () => {
    parseSchema(schemaSource, "schema.zed");
  });

  bench("validateSchema", () => {
    validateSchema(parseSchema(schemaSource, "schema.zed"));
  });
});
