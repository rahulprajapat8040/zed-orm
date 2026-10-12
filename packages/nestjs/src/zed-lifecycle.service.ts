import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { ZedClientLifecycle } from "./types.js";
import { ZED_CLIENT } from "./tokens.js";

/**
 * Connects the Zed client on module init and disconnects on shutdown.
 */
@Injectable()
export class ZedLifecycleService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(ZED_CLIENT) private readonly client: ZedClientLifecycle,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.disconnect();
  }
}
