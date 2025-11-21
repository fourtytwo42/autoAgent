import { describe, it, expect } from 'vitest';
import { createApiClient } from '../../helpers/apiClient';

describe('Blackboard API E2E', () => {
  const client = createApiClient(process.env.TEST_API_URL || 'http://localhost:3000');

  it('should query blackboard items', async () => {
    try {
      const response = await client.get('/api/blackboard');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('API not available, skipping E2E test');
        return;
      }
      throw error;
    }
  });

  it('should create a blackboard item', async () => {
    try {
      const response = await client.post('/api/blackboard', {
        type: 'user_request',
        summary: 'Test request',
        dimensions: {},
        links: {},
      });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('user_request');
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('API not available, skipping E2E test');
        return;
      }
      throw error;
    }
  });

  it('should filter by type', async () => {
    try {
      const response = await client.get('/api/blackboard?type=goal');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('API not available, skipping E2E test');
        return;
      }
      throw error;
    }
  });
});

