import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { ZED_CLIENT } from "./tokens.js";
import type {
  ZedClientLifecycle,
  ZedModuleAsyncOptions,
  ZedModuleClientOptions,
  ZedModuleFactoryOptions,
  ZedModuleOptions,
} from "./types.js";
import { ZedLifecycleService } from "./zed-lifecycle.service.js";

function isClientOptions<TClient extends ZedClientLifecycle>(
  options: ZedModuleOptions<TClient>,
): options is ZedModuleClientOptions<TClient> {
  return "client" in options;
}

function resolveClient<TClient extends ZedClientLifecycle>(
  options: ZedModuleOptions<TClient>,
): TClient {
  if (isClientOptions(options)) {
    return options.client;
  }

  const factoryOptions = options as ZedModuleFactoryOptions<TClient>;
  return factoryOptions.createClient({
    databaseUrl: factoryOptions.databaseUrl,
  });
}

function createZedProviders<TClient extends ZedClientLifecycle>(
  options: ZedModuleOptions<TClient>,
): readonly Provider[] {
  const client = resolveClient(options);

  return [
    { provide: ZED_CLIENT, useValue: client },
    ZedLifecycleService,
  ];
}

@Module({})
export class ZedModule {
  static forRoot<TClient extends ZedClientLifecycle>(
    options: ZedModuleOptions<TClient>,
  ): DynamicModule {
    return {
      module: ZedModule,
      global: options.isGlobal ?? true,
      providers: [...createZedProviders(options)],
      exports: [ZED_CLIENT],
    };
  }

  static forRootAsync<TClient extends ZedClientLifecycle>(
    options: ZedModuleAsyncOptions<TClient>,
  ): DynamicModule {
    const clientProvider: Provider = {
      provide: ZED_CLIENT,
      useFactory: async (...args: readonly unknown[]) => {
        const config = await options.useFactory(...args);
        return resolveClient(config);
      },
      inject: options.inject ? [...options.inject] : [],
    };

    const dynamicModule: DynamicModule = {
      module: ZedModule,
      global: options.isGlobal ?? true,
      providers: [clientProvider, ZedLifecycleService],
      exports: [ZED_CLIENT],
    };

    if (options.imports !== undefined) {
      dynamicModule.imports = [...options.imports];
    }

    return dynamicModule;
  }
}
