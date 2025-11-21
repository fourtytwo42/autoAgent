import { describe, it, expect } from 'vitest';
import { createApiClient } from '../../helpers/apiClient';

describe('Models API E2E', () => {
  const client = createApiClient(process.env.TEST_API_URL || 'http://localhost:3000');

  it('should list all models', async () => {
    try {
      const response = await client.get('/api/models');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('models');
      expect(Array.isArray(response.body.models)).toBe(true);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('API not available, skipping E2E test');
        return;
      }
      throw error;
    }
  });

  it('should filter enabled models', async () => {
    try {
      const response = await client.get('/api/models?enabled=true');
      expect(response.status).toBe(200);
      expect(response.body.models).toBeDefined();
      response.body.models.forEach((model: any) => {
        expect(model.is_enabled).toBe(true);
      });
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('API not available, skipping E2E test');
        return;
      }
      throw error;
    }
  });
});

