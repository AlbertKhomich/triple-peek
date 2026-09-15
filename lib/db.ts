import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  entitySearchPool?: Pool;
};

export function getPool(): Pool {
  if (!globalForDb.entitySearchPool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }

    const pool = new Pool({ connectionString });
    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error", error);
    });

    // Keep one pool per process, including across development hot reloads.
    globalForDb.entitySearchPool = pool;
  }

  return globalForDb.entitySearchPool;
}
