/**
 * @zed-orm/client
 *
 * Public developer-facing ORM API.
 * Milestone 0: package boundary stub only.
 */

export const PACKAGE_NAME = "@zed-orm/client" as const;

/** Placeholder client options. */
export interface ZedClientOptions {
  readonly databaseUrl: string;
}

/**
 * Public Zed client. Full model APIs are generated in later milestones.
 */
export class ZedClient {
  readonly options: ZedClientOptions;

  constructor(options: ZedClientOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    throw new Error(
      "@zed-orm/client: connect is not implemented yet (Milestone 4+).",
    );
  }

  async disconnect(): Promise<void> {
    // No-op until a real connection exists.
  }
}
