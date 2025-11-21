# Testing Infrastructure

## Overview

The autoAgent project has a comprehensive testing infrastructure using Vitest, covering unit tests, integration tests, and end-to-end tests.

## Quick Start

```bash
# Run all tests
npm test

# Run only unit tests (fast, no DB)
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/              # Pure unit tests (no DB, no external deps)
├── integration/       # Integration tests (DB, mocked providers)
├── e2e/              # End-to-end API tests (Next.js routes)
├── fixtures/         # Test data factories
└── helpers/          # Shared utilities
```

## Test Database

- **Database**: `autoagent_test`
- **User**: `hendo420`
- **Automatic setup**: Migrations run automatically before tests
- **Automatic cleanup**: Database is cleaned between test suites

## Mock Providers

By default, all model providers are mocked using `USE_MOCK_PROVIDERS=true`.

Mock providers support:
- Deterministic responses based on input
- Configurable delays (latency simulation)
- Error injection (timeouts, rate limits, network errors)
- Streaming support

## Writing Tests

### Unit Tests

Test pure functions with no dependencies:

```typescript
import { describe, it, expect } from 'vitest';

describe('My Utility', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### Integration Tests

Test with database and mocked providers:

```typescript
import { describe, it, expect } from 'vitest';
import { withFreshDb } from '../../helpers/db';
import { fixtureModels } from '../../fixtures/models';

describe('Model Registry', () => {
  it('should create a model', async () => {
    await withFreshDb(async (db) => {
      const model = fixtureModels.gpt4();
      // Your test code here
    });
  });
});
```

### E2E Tests

Test the full API stack:

```typescript
import { describe, it, expect } from 'vitest';
import { createApiClient } from '../../helpers/apiClient';

describe('API E2E', () => {
  const client = createApiClient();
  
  it('should handle requests', async () => {
    const response = await client.get('/api/endpoint');
    expect(response.status).toBe(200);
  });
});
```

## Test Fixtures

Use fixtures to create test data:

```typescript
import { fixtureModels } from '../fixtures/models';
import { fixtureAgents } from '../fixtures/agents';
import { fixtureBlackboardItems } from '../fixtures/blackboard';

const model = fixtureModels.gpt4();
const agent = fixtureAgents.weSpeaker();
const item = fixtureBlackboardItems.userRequest('Hello');
```

## Environment Variables

Create a `.env.test` file with:

```
DATABASE_URL=postgresql://user:password@localhost:5432/autoagent_test
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/autoagent_test
USE_MOCK_PROVIDERS=true
NODE_ENV=test
```

## Coverage

Coverage thresholds are set at 80% for:
- Lines
- Functions
- Branches
- Statements

Run coverage report:
```bash
npm run test:coverage
```

## Migration System

Database migrations are in `migrations/` directory. They run automatically before tests.

## Helper Functions

### Database Helpers (`tests/helpers/db.ts`)
- `getTestDb()` - Get test database connection
- `setupTestDb()` - Run migrations
- `cleanTestDb()` - Clean all tables
- `withFreshDb()` - Run test with fresh database state

### Mock Providers (`tests/helpers/mocks/`)
- `getMockProvider()` - Get mock provider for a model
- `createSuccessMock()` - Create successful mock
- `createTimeoutMock()` - Create timeout mock
- `createRateLimitMock()` - Create rate limit mock

### Test Utils (`tests/helpers/testUtils.ts`)
- `waitFor()` - Wait for condition
- `mockDate()` - Mock dates
- `assertIsUUID()` - Assert UUID format
- `assertBlackboardItemStructure()` - Validate blackboard items

## Best Practices

1. **Unit tests first**: Write unit tests for pure functions
2. **Integration tests**: Test database operations and mocked providers
3. **E2E tests**: Test full workflows through API
4. **Use fixtures**: Always use fixtures for test data
5. **Clean state**: Use `withFreshDb()` for tests that modify database
6. **Mock external services**: Use mock providers, never call real APIs in tests
7. **Test edge cases**: Include error scenarios and boundary conditions
8. **Fast feedback**: Keep unit tests fast (<100ms per test)

## Troubleshooting

### Database connection errors
- Verify Postgres is running: `sudo systemctl status postgresql`
- Check credentials in `.env.test`
- Verify database exists: `psql -U hendo420 -d autoagent_test -c "SELECT 1;"`

### Migration errors
- Check migration files in `migrations/` directory
- Verify SQL syntax is correct
- Check if migrations table exists

### Test timeout errors
- Increase timeout in `vitest.config.ts`
- Check for hanging database connections
- Verify mock providers return promptly

