import { Injectable } from "@nestjs/common";
import { InjectZed } from "@zed-orm/nestjs";
import type { GeneratedClient } from "../../generated/zed/client.js";

@Injectable()
export class UsersService {
  constructor(@InjectZed() private readonly db: GeneratedClient) {}

  findAll() {
    return this.db.user.findMany();
  }

  create(email: string) {
    return this.db.user.create({
      data: {
        id: crypto.randomUUID(),
        email,
      },
    });
  }
}
