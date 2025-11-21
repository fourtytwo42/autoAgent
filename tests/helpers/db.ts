import { Pool, Client } from 'pg';
import path from 'path';
import fs from 'fs/promises';

let testPool: Pool | null = null;
let testClient: Client | null = null;

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set');
  }
  return url;
}

export async function getTestDb(): Promise<Pool> {
  if (!testPool) {
    const url = getTestDatabaseUrl();
    testPool = new Pool({ connectionString: url });
    
    // Test connection
    try {
      await testPool.query('SELECT 1');
    } catch (error) {
      throw new Error(`Failed to connect to test database: ${error}`);
    }
  }
  return testPool;
}

export async function getTestDbClient(): Promise<Client> {
  if (!testClient) {
    const url = getTestDatabaseUrl();
    testClient = new Client({ connectionString: url });
    await testClient.connect();
  }
  return testClient;
}

export async function closeTestDb(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
  if (testClient) {
    await testClient.end();
    testClient = null;
  }
}

/**
 * Run migrations on test database
 */
export async function setupTestDb(): Promise<void> {
  const db = await getTestDb();
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  
  try {
    // Ensure we have proper permissions on the public schema
    try {
      await db.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
      await db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO CURRENT_USER');
      await db.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER');
      await db.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO CURRENT_USER');
      await db.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO CURRENT_USER');
    } catch (permError) {
      // Permissions might already be set or user might not have grant privileges
      // This is okay, continue with migrations
      console.log('Note: Could not set permissions (may already be set):', (permError as Error).message);
    }
    
    // Get all migration files sorted by name
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    // Ensure migrations table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    
    // Execute each migration
    for (const file of sqlFiles) {
      const result = await db.query(
        'SELECT 1 FROM migrations WHERE name = $1',
        [file]
      );
      
      if (result.rows.length === 0) {
        const sql = await fs.readFile(
          path.join(migrationsDir, file),
          'utf-8'
        );
        
        await db.query(sql);
        await db.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [file]
        );
        
        console.log(`Executed migration: ${file}`);
      }
    }
  } catch (error) {
    // If migrations directory doesn't exist, create it
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(migrationsDir, { recursive: true });
      console.log('Created migrations directory');
      return;
    }
    throw error;
  }
}

/**
 * Clean all tables in test database (preserve schema)
 */
export async function cleanTestDb(): Promise<void> {
  const db = await getTestDb();
  
  // Get all table names
  const result = await db.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename != 'migrations'
  `);
  
  if (result.rows.length === 0) {
    return;
  }
  
  // Truncate all tables (faster than DELETE and resets sequences)
  const tableNames = result.rows.map(r => r.tablename).join(', ');
  await db.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
}

/**
 * Wrapper for tests that need database access
 */
export async function withTestDb<T>(
  fn: (db: Pool) => Promise<T>
): Promise<T> {
  const db = await getTestDb();
  return fn(db);
}

/**
 * Run a test with fresh database state
 */
export async function withFreshDb<T>(
  fn: (db: Pool) => Promise<T>
): Promise<T> {
  await setupTestDb();
  await cleanTestDb();
  const db = await getTestDb();
  return fn(db);
}

