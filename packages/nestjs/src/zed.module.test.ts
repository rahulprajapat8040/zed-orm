import "reflect-metadata";
import { Injectable, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InjectZed, ZED_CLIENT, ZedModule } from "./index.js";
import type { ZedClientLifecycle } from "./types.js";

function createMockClient(): ZedClientLifecycle & {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
}

@Injectable()
class UsersService {
  constructor(@InjectZed() readonly db: ZedClientLifecycle) {}
}

@Module({
  providers: [UsersService],
})
class UsersModule {}

describe("@zed-orm/nestjs ZedModule", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("forRoot registers a client and runs lifecycle hooks", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ZedModule.forRoot({
          client: mockClient,
          isGlobal: true,
        }),
        UsersModule,
      ],
    }).compile();

    await moduleRef.init();
    expect(mockClient.connect).toHaveBeenCalledTimes(1);

    const users = moduleRef.get(UsersService);
    expect(users.db).toBe(mockClient);

    await moduleRef.close();
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it("forRoot creates a client from createClient + databaseUrl", async () => {
    const factoryClient = createMockClient();
    const createClient = vi.fn(() => factoryClient);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ZedModule.forRoot({
          databaseUrl: "postgresql://localhost/zed",
          createClient,
          isGlobal: false,
        }),
      ],
    }).compile();

    await moduleRef.init();
    expect(createClient).toHaveBeenCalledWith({
      databaseUrl: "postgresql://localhost/zed",
    });
    expect(moduleRef.get(ZED_CLIENT)).toBe(factoryClient);
    await moduleRef.close();
  });

  it("forRootAsync resolves options from a factory", async () => {
    const factoryClient = createMockClient();
    const createClient = vi.fn(() => factoryClient);

    const CONFIG = Symbol("CONFIG");

    @Module({
      providers: [
        {
          provide: CONFIG,
          useValue: { databaseUrl: "postgresql://localhost/async" },
        },
      ],
      exports: [CONFIG],
    })
    class ConfigModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ZedModule.forRootAsync({
          imports: [ConfigModule],
          inject: [CONFIG],
          useFactory: (config: { databaseUrl: string }) => ({
            databaseUrl: config.databaseUrl,
            createClient,
          }),
          isGlobal: false,
        }),
      ],
    }).compile();

    await moduleRef.init();
    expect(createClient).toHaveBeenCalledWith({
      databaseUrl: "postgresql://localhost/async",
    });
    expect(moduleRef.get(ZED_CLIENT)).toBe(factoryClient);
    await moduleRef.close();
  });
});
