/**
 * @zed-orm/nestjs
 *
 * NestJS integration for Zed ORM.
 * This is the ONLY package allowed to depend on NestJS.
 */

export const PACKAGE_NAME = "@zed-orm/nestjs" as const;

export { InjectZed } from "./inject-zed.js";
export { ZED_CLIENT } from "./tokens.js";
export type {
  ZedClientFactory,
  ZedClientLifecycle,
  ZedClientOptions,
  ZedModuleAsyncOptions,
  ZedModuleClientOptions,
  ZedModuleFactoryOptions,
  ZedModuleOptions,
} from "./types.js";
export { ZedLifecycleService } from "./zed-lifecycle.service.js";
export { ZedModule } from "./zed.module.js";
