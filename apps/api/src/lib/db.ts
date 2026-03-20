import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDb(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    pool.on("error", (err) => {
      console.error("[DB] Pool error:", err);
    });
  }
  return pool;
}
