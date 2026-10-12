import "reflect-metadata";
import { Injectable, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { createPostgresDriver } from "@zed-orm/driver-postgres";
import { modelMetas as fixtureMetas } from "../../generator/test/fixtures/simple/meta.js";
import type { Post, User } from "../../generator/test/fixtures/simple/types.js";
import {
  InjectZed,
  ZED_CLIENT,
  ZedModule,
  type ZedClientFactory,
} from "./index.js";
import type { ModelMeta } from "@zed-orm/query-builder";
import { ModelDelegate, withTransaction } from "@zed-orm/runtime";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env["DATABASE_URL"];

function withTableName(meta: ModelMeta, tableName: string): ModelMeta {
  return { ...meta, tableName };
}

type TestClient = {
  user: ModelDelegate<User>;
  post: ModelDelegate<Post>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  $transaction<TResult>(
    callback: (tx: {
      user: ModelDelegate<User>;
      post: ModelDelegate<Post>;
    }) => Promise<TResult>,
  ): Promise<TResult>;
};

function createTestClientFactory(
  userTable: string,
  postTable: string,
): ZedClientFactory<TestClient> {
  return ({ databaseUrl: url }) => {
    const driver = createPostgresDriver({ databaseUrl: url });
    const modelMetas = {
      User: withTableName(fixtureMetas["User"], userTable),
      Post: withTableName(fixtureMetas["Post"], postTable),
    };

    const createDelegates = (executor: typeof driver) => ({
      user: new ModelDelegate<User>(executor, modelMetas.User, modelMetas),
      post: new ModelDelegate<Post>(executor, modelMetas.Post, modelMetas),
    });

    const { $transaction } = withTransaction(driver, createDelegates);

    return {
      ...createDelegates(driver),
      async connect() {
        await driver.connect();
      },
      async disconnect() {
        await driver.disconnect();
      },
      $transaction,
    };
  };
}

@Injectable()
class UsersService {
  constructor(@InjectZed() readonly db: TestClient) {}

  findAll() {
    return this.db.user.findMany();
  }
}

@Module({
  providers: [UsersService],
})
class AppModule {}

describe.skipIf(databaseUrl === undefined)("NestJS database integration", () => {
  let moduleRef: TestingModule;
  const suffix = Date.now().toString();
  const userTable = `zed_nest_user_${suffix}`;
  const postTable = `zed_nest_post_${suffix}`;
  const createClient = createTestClientFactory(userTable, postTable);

  beforeAll(async () => {
    const driver = createPostgresDriver({ databaseUrl: databaseUrl! });
    await driver.connect();
    await driver.query(`
      CREATE TABLE "${userTable}" (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL
      )
    `);
    await driver.query(`
      CREATE TABLE "${postTable}" (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        "authorId" TEXT NOT NULL REFERENCES "${userTable}" (id)
      )
    `);
    await driver.disconnect();

    moduleRef = await Test.createTestingModule({
      imports: [
        ZedModule.forRoot({
          databaseUrl: databaseUrl!,
          createClient,
          isGlobal: true,
        }),
        AppModule,
      ],
    }).compile();

    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef.close();

    const driver = createPostgresDriver({ databaseUrl: databaseUrl! });
    await driver.connect();
    await driver.query(`DROP TABLE IF EXISTS "${postTable}"`);
    await driver.query(`DROP TABLE IF EXISTS "${userTable}"`);
    await driver.disconnect();
  });

  it("wires DI, lifecycle, and database queries", async () => {
    const injected = moduleRef.get<TestClient>(ZED_CLIENT);
    const users = moduleRef.get(UsersService);

    expect(users.db).toBe(injected);

    const created = await users.db.user.create({
      data: {
        id: "nest-u1",
        email: `nest-${suffix}@example.com`,
        role: "USER",
      },
    });
    expect(created.email).toContain("nest-");

    const found = await users.findAll();
    expect(found.some((user) => user.id === "nest-u1")).toBe(true);
  });
});
