import type { InjectionToken, ModuleMetadata } from "@nestjs/common";

/**
 * Minimal client contract required for NestJS lifecycle wiring.
 * Satisfied by generated `createClient()` output.
 */
export interface ZedClientLifecycle {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface ZedClientOptions {
  readonly databaseUrl: string;
}

export type ZedClientFactory<TClient extends ZedClientLifecycle> = (
  options: ZedClientOptions,
) => TClient;

/** Register a generated client factory and connection URL. */
export interface ZedModuleFactoryOptions<
  TClient extends ZedClientLifecycle = ZedClientLifecycle,
> {
  readonly databaseUrl: string;
  readonly createClient: ZedClientFactory<TClient>;
  readonly isGlobal?: boolean;
}

/** Register a pre-built client instance (e.g. for testing). */
export interface ZedModuleClientOptions<
  TClient extends ZedClientLifecycle = ZedClientLifecycle,
> {
  readonly client: TClient;
  readonly isGlobal?: boolean;
}

export type ZedModuleOptions<TClient extends ZedClientLifecycle> =
  | ZedModuleFactoryOptions<TClient>
  | ZedModuleClientOptions<TClient>;

export interface ZedModuleAsyncOptions<
  TClient extends ZedClientLifecycle = ZedClientLifecycle,
> extends Pick<ModuleMetadata, "imports"> {
  readonly inject?: readonly InjectionToken[];
  readonly useFactory: (
    ...args: readonly unknown[]
  ) => ZedModuleFactoryOptions<TClient> | Promise<ZedModuleFactoryOptions<TClient>>;
  readonly isGlobal?: boolean;
}
