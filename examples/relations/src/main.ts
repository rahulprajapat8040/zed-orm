import { createClient } from "../generated/zed/index.js";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error("DATABASE_URL is required to run the relations example.");
    process.exit(1);
  }

  const db = createClient({ databaseUrl });
  await db.connect();

  try {
    const email = `relations-${Date.now()}@example.com`;
    const user = await db.user.create({
      data: { email },
    });

    await db.post.create({
      data: {
        title: "Hello relations",
        authorId: user.id,
      },
    });

    const users = await db.user.findMany({
      include: { posts: true },
    });

    console.log(
      "Users with posts:",
      users.map((entry) => ({
        email: entry.email,
        postCount: entry.posts.length,
      })),
    );
  } finally {
    await db.disconnect();
  }
}

void main();
