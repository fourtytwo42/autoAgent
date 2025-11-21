import { Pool, PoolConfig } from 'pg';
import { env } from './env';

let pool: Pool | null = null;

/**
 * Get database pool with lazy initialization.
 * Skips initialization during Next.js build phase.
 */
export function getDatabasePool(): Pool {
  // Skip during Next.js build phase
  if (process.env.NEXT_PHASE === 'phase-production-build' || 
      process.env.NEXT_PHASE === 'phase-development-build') {
    throw new Error('Database not available during Next.js build phase');
  }

  // Skip if we're in browser (shouldn't happen, but safety check)
  if (typeof window !== 'undefined') {
    throw new Error('Database not available in browser');
  }

  if (!pool) {
    // Check if DATABASE_URL is available
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured');
    }

    const config: PoolConfig = {
      connectionString: env.DATABASE_URL,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  return pool;
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const testPool = getDatabasePool();
    await testPool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

