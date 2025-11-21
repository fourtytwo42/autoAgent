# Testing Infrastructure

This directory contains the comprehensive testing infrastructure for the autoAgent project.

## Test Structure

- `unit/` - Pure unit tests with no dependencies (DB, external services)
- `integration/` - Integration tests with database and mocked providers
- `e2e/` - End-to-end tests testing Next.js API routes
- `fixtures/` - Test data factories and fixtures
- `helpers/` - Shared test utilities and helpers

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests (fast, no DB)
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Database

Tests use a separate PostgreSQL database: `autoagent_test`

The database is automatically set up and cleaned between test suites.

## Mock Providers

By default, all model providers are mocked using `USE_MOCK_PROVIDERS=true`.

Mock providers support:
- Deterministic responses based on input
- Configurable delays (latency simulation)
- Error injection (timeouts, rate limits, network errors)
- Streaming support

## Writing Tests

### Unit Tests

Unit tests should test pure functions with no dependencies:

```typescript
import { describe, it, expect } from 'vitest';

describe('My Utility', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### Integration Tests

Integration tests use the test database:

```typescript
import { describe, it, expect } from 'vitest';
import { withFreshDb } from '../../helpers/db';
import { fixtureModels } from '../../fixtures/models';

describe('My Integration', () => {
  it('should work with database', async () => {
    await withFreshDb(async (db) => {
      // Your test code here
    });
  });
});
```

### E2E Tests

E2E tests test the full API stack:

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

## Mock Providers

Configure mock provider behavior:

```typescript
import { getMockProvider } from '../helpers/mocks';
import { fixtureModels } from '../fixtures/models';

const model = fixtureModels.gpt4();
const mockProvider = getMockProvider(model, 'success'); // or 'timeout', 'rate_limit', etc.
const response = await mockProvider.generateText(model, messages);
```

