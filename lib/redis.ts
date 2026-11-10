import Redis from "ioredis";

const g = globalThis as unknown as { __redis?: Redis };

function create(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    // Avoid crashing on connection errors; callers handle failed commands.
    if (process.env.NODE_ENV !== "test") console.warn("[redis]", err.message);
  });
  return client;
}

export const redis: Redis = g.__redis ?? create();
if (process.env.NODE_ENV !== "production") g.__redis = redis;
