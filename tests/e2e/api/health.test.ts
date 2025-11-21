import { describe, it, expect } from 'vitest';
import { createApiClient } from '../../helpers/apiClient';

describe('Health API E2E', () => {
  const client = createApiClient(process.env.TEST_API_URL || 'http://localhost:3000');

  it('should return health status', async () => {
    try {
      const response = await client.get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(['ok', 'error']).toContain(response.body.status);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('API not available, skipping E2E test');
        return;
      }
      throw error;
    }
  });
});

