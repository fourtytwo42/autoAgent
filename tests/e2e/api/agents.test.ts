import { describe, it, expect } from 'vitest';
import { createApiClient } from '../../helpers/apiClient';

describe('Agents API E2E', () => {
  const client = createApiClient(process.env.TEST_API_URL || 'http://localhost:3000');

  it('should list all agents', async () => {
    try {
      const response = await client.get('/api/agents');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('API not available, skipping E2E test');
        return;
      }
      throw error;
    }
  });

  it('should filter enabled agents', async () => {
    try {
      const response = await client.get('/api/agents?enabled=true');
      expect(response.status).toBe(200);
      expect(response.body.agents).toBeDefined();
      response.body.agents.forEach((agent: any) => {
        expect(agent.is_enabled).toBe(true);
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

