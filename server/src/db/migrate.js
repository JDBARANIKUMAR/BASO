import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

export const runMigration = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL is not defined in your environment or .env file.');
    console.error('   Please provide a valid Neon PostgreSQL connection string:');
    console.error('   DATABASE_URL="postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require"');
    process.exit(1);
  }

  const isLocalhost = Boolean(
    process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
  );

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  console.log('🔄 Connecting to Neon PostgreSQL and applying migration...');

  try {
    const client = await pool.connect();
    try {
      const sqlPath = path.join(__dirname, 'migration.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');

      console.log('✅ Neon Postgres tables (users, otp_codes) migrated successfully!');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Migration failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

runMigration()
  .then(() => {
    console.log('🚀 Ready to start server.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to run migration:', err);
    process.exit(1);
  });
