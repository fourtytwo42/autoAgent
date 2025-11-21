import { randomUUID } from 'crypto';

export interface BlackboardItem {
  id: string;
  type: string;
  summary: string;
  dimensions: Record<string, any>;
  links: {
    parents?: string[];
    children?: string[];
    related?: string[];
  };
  detail?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export function createTestBlackboardItem(
  overrides: Partial<BlackboardItem> = {}
): BlackboardItem {
  return {
    id: randomUUID(),
    type: 'test_item',
    summary: 'Test item',
    dimensions: {},
    links: {},
    ...overrides,
  };
}

export const fixtureBlackboardItems = {
  userRequest: (content = 'Test user request'): BlackboardItem =>
    createTestBlackboardItem({
      type: 'user_request',
      summary: content,
      dimensions: { status: 'pending', topic: 'general' },
      links: {},
    }),
  
  goal: (summary = 'Test goal', parentId?: string): BlackboardItem =>
    createTestBlackboardItem({
      type: 'goal',
      summary,
      dimensions: { status: 'open', priority: 'medium' },
      links: parentId ? { parents: [parentId] } : {},
    }),
  
  task: (summary = 'Test task', parentGoalId?: string): BlackboardItem =>
    createTestBlackboardItem({
      type: 'task',
      summary,
      dimensions: { status: 'pending', assigned_agent: null },
      links: parentGoalId ? { parents: [parentGoalId] } : {},
    }),
  
  agentOutput: (
    agentId: string,
    taskId: string,
    content = 'Test output'
  ): BlackboardItem =>
    createTestBlackboardItem({
      type: 'agent_output',
      summary: `Output from ${agentId}`,
      dimensions: { agent_id: agentId, status: 'completed' },
      links: { parents: [taskId] },
      detail: { content },
    }),
  
  judgement: (
    agentOutputId: string,
    score = 0.8
  ): BlackboardItem =>
    createTestBlackboardItem({
      type: 'judgement',
      summary: `Judgement score: ${score}`,
      dimensions: { score, status: 'completed' },
      links: { parents: [agentOutputId] },
      detail: { score, reasoning: 'Test judgement' },
    }),
};

