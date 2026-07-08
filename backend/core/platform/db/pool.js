import pg from "pg";

const { Pool } = pg;

let pool = null;

export function getDatabaseUrl() {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (process.env.VIBETECH_TEST_DB === "1" && testUrl) {
    return testUrl;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required. Start PostgreSQL and set DATABASE_URL in frontend/.env.local");
  }
  return url;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return pool;
}

export async function withClient(fn) {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
