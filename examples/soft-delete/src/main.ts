import { createClient } from "../generated/zed/index.js";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error("DATABASE_URL is required to run the soft-delete example.");
    process.exit(1);
  }

  const db = createClient({ databaseUrl });
  await db.connect();

  try {
    const email = `soft-delete-${Date.now()}@example.com`;
    const user = await db.user.create({
      data: { email },
    });

    await db.post.create({
      data: {
        title: "Cascade me",
        authorId: user.id,
      },
    });

    await db.user.delete({ where: { id: user.id } });

    const activeUsers = await db.user.findMany();
    const deletedUsers = await db.user.findMany({ onlyDeleted: true });
    const activePosts = await db.post.findMany();

    console.log("Active users:", activeUsers.length);
    console.log("Deleted users:", deletedUsers.length);
    console.log("Active posts after cascade:", activePosts.length);
  } finally {
    await db.disconnect();
  }
}

void main();
