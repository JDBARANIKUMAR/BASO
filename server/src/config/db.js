import pg from 'pg';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const { Pool } = pg;

// ─── Neon Serverless Postgres Connection Pool ───────────────────────────────
// Neon requires SSL. We enforce sslmode=require and set rejectUnauthorized: false
// to ensure compatibility with serverless pooling certificates.
const isLocalhost = Boolean(
  process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[pg Pool Error] Unexpected idle client error:', err.message);
});

/**
 * Execute a parameterized query with pg Pool
 * @param {string} text - SQL statement with $1, $2 placeholders
 * @param {Array} params - Array of parameter values
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Verify database connection at server startup
 */
export const connectDB = async () => {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('ep-cool-snowflake-123456')) {
    console.warn('[Database] DATABASE_URL is not configured or using placeholder in .env.');
    console.warn('[Database] Please provide a valid Neon PostgreSQL connection string.');
    return;
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS current_time');
    client.release();
    console.log('[Database] Neon PostgreSQL connected via pg Pool at', result.rows[0].current_time);
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
    console.error('Troubleshooting: Ensure DATABASE_URL in .env has sslmode=require and Neon branch is active.');
  }
};

/**
 * Health check probe used by GET /api/health
 */
export const isDbReady = async () => {
  try {
    const res = await pool.query('SELECT 1');
    return Boolean(res && res.rowCount > 0);
  } catch {
    return false;
  }
};

// Keep prisma client available for existing legacy tables/relations
export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});
