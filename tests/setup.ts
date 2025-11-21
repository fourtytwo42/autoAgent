import dotenv from 'dotenv';
import { beforeAll } from 'vitest';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set default test environment variables
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
    configurable: true,
  });
}
process.env.USE_MOCK_PROVIDERS = process.env.USE_MOCK_PROVIDERS || 'true';

beforeAll(async () => {
  // Global test setup
  // Database connection will be established on demand in tests
});

