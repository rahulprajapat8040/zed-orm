import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { UsersService } from "./users/users.service.js";

async function bootstrap(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error("DATABASE_URL is required to run the NestJS example.");
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const users = app.get(UsersService);
    const created = await users.create(`nest-example-${Date.now()}@example.com`);
    console.log("Created user:", created);

    const all = await users.findAll();
    console.log(`Users in database: ${all.length}`);
  } finally {
    await app.close();
  }
}

void bootstrap();
