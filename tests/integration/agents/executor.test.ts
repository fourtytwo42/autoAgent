import { describe, it, expect } from 'vitest';
import { withFreshDb } from '../../helpers/db';
import { agentExecutor } from '@/src/agents/executor';
import { agentRegistry } from '@/src/agents/registry';
import { shouldUseMockProviders } from '@/src/config/models';

describe('Agent Executor Integration', () => {
  it('should execute an agent', async () => {
    await withFreshDb(async () => {
      const useMock = shouldUseMockProviders();
      if (!useMock) return;

      const agents = await agentRegistry.getEnabledAgents();
      if (agents.length === 0) {
        // No agents available
        return;
      }

      const agent = agents[0];
      const context = {
        agent_id: agent.id,
        model_id: '',
        input: { message: 'Test message' },
        options: {},
      };

      const output = await agentExecutor.execute(agent.id, context);
      expect(output).toBeDefined();
      expect(output.agent_id).toBe(agent.id);
      expect(output.output).toBeDefined();
    });
  });

  it('should handle agent execution errors gracefully', async () => {
    await withFreshDb(async () => {
      const useMock = shouldUseMockProviders();
      if (!useMock) return;

      // Try to execute non-existent agent
      await expect(
        agentExecutor.execute('NonExistentAgent', {
          agent_id: 'NonExistentAgent',
          model_id: '',
          input: {},
          options: {},
        })
      ).rejects.toThrow();
    });
  });
});

