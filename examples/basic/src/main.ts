import { createClient } from "../generated/zed/index.js";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error("DATABASE_URL is required to run the basic example.");
    process.exit(1);
  }

  const db = createClient({ databaseUrl });
  await db.connect();

  try {
    const email = `basic-example-${Date.now()}@example.com`;
    const created = await db.user.create({ data: { email } });
    console.log("Created user:", created);

    const users = await db.user.findMany();
    console.log(`Users in database: ${users.length}`);
  } finally {
    await db.disconnect();
  }
}

void main();
