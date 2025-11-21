import { describe, it, expect } from 'vitest';
import { interestMatcher } from '@/src/agents/matcher';
import { AgentType, BlackboardItem } from '@/src/types';
import { createTestAgent } from '../../fixtures/agents';
import { createTestBlackboardItem } from '../../fixtures/blackboard';

describe('InterestMatcher', () => {
  describe('match', () => {
    it('should match agents by type interest', () => {
      const agent: AgentType = createTestAgent({
        interests: { type: ['goal', 'task'] },
      });

      const item: BlackboardItem = createTestBlackboardItem({
        type: 'goal',
        summary: 'Test goal',
      });

      const matches = interestMatcher.match([agent], item);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].agent.id).toBe(agent.id);
    });

    it('should not match agents with different type interests', () => {
      const agent: AgentType = createTestAgent({
        interests: { type: ['goal'] },
      });

      const item: BlackboardItem = createTestBlackboardItem({
        type: 'task',
        summary: 'Test task',
      });

      const matches = interestMatcher.match([agent], item);
      expect(matches.length).toBe(0);
    });

    it('should match agents by dimension filters', () => {
      const agent: AgentType = createTestAgent({
        interests: {
          type: ['task'],
          dimensions: { status: 'pending', priority: 'high' },
        },
      });

      const item: BlackboardItem = createTestBlackboardItem({
        type: 'task',
        summary: 'Test task',
        dimensions: { status: 'pending', priority: 'high' },
      });

      const matches = interestMatcher.match([agent], item);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should still match by type even when dimension filters do not match', () => {
      const agent: AgentType = createTestAgent({
        interests: {
          type: ['task'],
          dimensions: { status: 'pending' },
        },
      });

      const item: BlackboardItem = createTestBlackboardItem({
        type: 'task',
        summary: 'Test task',
        dimensions: { status: 'completed' },
      });

      const matches = interestMatcher.match([agent], item);
      // Type match gives 10 points, dimension mismatch doesn't subtract
      // So it should still match, but with lower score
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].score).toBeGreaterThanOrEqual(10); // Type match
      expect(matches[0].score).toBeLessThan(12); // No dimension match bonus
    });

    it('should rank matches by relevance', () => {
      const agent1: AgentType = createTestAgent({
        id: 'agent1',
        interests: { type: ['goal'] },
      });

      const agent2: AgentType = createTestAgent({
        id: 'agent2',
        interests: {
          type: ['goal'],
          dimensions: { priority: 'high' },
        },
      });

      const item: BlackboardItem = createTestBlackboardItem({
        type: 'goal',
        summary: 'Test goal',
        dimensions: { priority: 'high' },
      });

      const matches = interestMatcher.match([agent1, agent2], item);
      expect(matches.length).toBeGreaterThan(0);
      // Agent2 should rank higher due to more specific match
      if (matches.length > 1) {
        expect(matches[0].agent.id).toBe('agent2');
      }
    });
  });
});

