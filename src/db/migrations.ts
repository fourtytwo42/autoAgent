import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import fs from 'fs/promises';
import path from 'path';

export async function runMigrations(pool?: Pool): Promise<void> {
  const db = pool || getDatabasePool();
  const migrationsDir = path.resolve(__dirname, '../../migrations');

  try {
    // Ensure migrations table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Get all migration files sorted by name
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort();

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

        // Execute migration
        await db.query(sql);

        // Record migration
        await db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);

        console.log(`✅ Executed migration: ${file}`);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('⚠️  Migrations directory not found, skipping migrations');
      return;
    }
    throw error;
  }
}

export async function getLatestMigration(pool?: Pool): Promise<string | null> {
  const db = pool || getDatabasePool();

  const result = await db.query(
    'SELECT name FROM migrations ORDER BY executed_at DESC LIMIT 1'
  );

  return result.rows.length > 0 ? result.rows[0].name : null;
}

