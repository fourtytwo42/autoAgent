import { Pool, PoolConfig } from 'pg';
import { env } from './env';

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
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

