import type {
  CreateArgs,
  CreateManyArgs,
  DeleteArgs,
  DeleteManyArgs,
  FindFirstArgsWithInclude,
  FindManyArgsWithInclude,
  FindUniqueArgsWithInclude,
  UpdateArgs,
  UpdateManyArgs,
} from "@zed-orm/query-builder";

/** Per-model operation argument types wired by the generated client. */
export interface ModelDelegateTypes {
  readonly findMany: FindManyArgsWithInclude;
  readonly findFirst: FindFirstArgsWithInclude;
  readonly findUnique: FindUniqueArgsWithInclude;
  readonly create: CreateArgs;
  readonly createMany: CreateManyArgs;
  readonly update: UpdateArgs;
  readonly updateMany: UpdateManyArgs;
  readonly delete: DeleteArgs;
  readonly deleteMany: DeleteManyArgs;
}

/** Default untyped delegate map used when no generated types are supplied. */
export type DefaultModelDelegateTypes = ModelDelegateTypes;
