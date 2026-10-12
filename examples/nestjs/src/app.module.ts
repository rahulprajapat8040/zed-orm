import { Module } from "@nestjs/common";
import { ZedModule } from "@zed-orm/nestjs";
import { createClient } from "../generated/zed/client.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ZedModule.forRoot({
      databaseUrl: process.env["DATABASE_URL"] ?? "",
      createClient,
    }),
    UsersModule,
  ],
})
export class AppModule {}
