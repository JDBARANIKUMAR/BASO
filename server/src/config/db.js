import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

export const connectDB = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('[Database] DATABASE_URL is not set.');
    console.error('[Database] Fix: add DATABASE_URL to your .env (local) or environment variables (Render/Railway).');
    console.error('[Database] Example: postgresql://user:password@host/db?sslmode=require');
    process.exit(1);
  }

  try {
    await prisma.$connect();
    console.log('[Database] PostgreSQL (Neon) connected via Prisma');
  } catch (error) {
    console.error('[Database] CONNECTION FAILED:', error.message);
    console.error('[Database] Troubleshooting checklist:');
    console.error('  1. DATABASE_URL is correct and points to your production database.');
    console.error('  2. Neon: branch is NOT paused (Neon auto-pauses idle branches - resume it in the console).');
    console.error('  3. Neon: connection string ends with ?sslmode=require.');
    console.error('  4. IP allowlist: add 0.0.0.0/0 (Neon/other providers) - hosting IPs change often.');
    console.error('  5. Schema exists: run `npx prisma db push` once from your machine.');
    process.exit(1);
  }
};

/**
 * Lightweight readiness probe used by GET /api/health.
 * Returns true when the database answers, false otherwise (never throws).
 */
export const isDbReady = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};
