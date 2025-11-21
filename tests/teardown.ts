import { afterAll } from 'vitest';
import { getTestDb, closeTestDb } from './helpers/db';

afterAll(async () => {
  // Clean up test database connections
  await closeTestDb();
});

