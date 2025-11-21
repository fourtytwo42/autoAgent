export interface AgentType {
  id: string;
  description: string;
  system_prompt: string;
  modalities: string[];
  interests: Record<string, any>;
  permissions: Record<string, any>;
  is_core: boolean;
  is_enabled: boolean;
}

export function createTestAgent(overrides: Partial<AgentType> = {}): AgentType {
  return {
    id: 'TestAgent',
    description: 'Test agent for testing',
    system_prompt: 'You are a test agent.',
    modalities: ['text'],
    interests: { type: ['task'] },
    permissions: { can_use_tools: [], can_create_goals: false },
    is_core: false,
    is_enabled: true,
    ...overrides,
  };
}

export const fixtureAgents = {
  weSpeaker: (): AgentType => createTestAgent({
    id: 'WeSpeaker',
    description: 'User-facing conversational agent',
    system_prompt: 'You are WeSpeaker, the conversational interface of the hive.',
    interests: { type: ['user_request'] },
    permissions: { can_use_tools: ['web_search'], can_create_goals: true },
    is_core: true,
  }),
  
  taskPlanner: (): AgentType => createTestAgent({
    id: 'TaskPlanner',
    description: 'Breaks down goals into tasks',
    system_prompt: 'You are TaskPlanner, responsible for decomposing goals into actionable tasks.',
    interests: { type: ['goal'] },
    permissions: { can_use_tools: [], can_create_goals: false },
    is_core: true,
  }),
  
  judge: (): AgentType => createTestAgent({
    id: 'Judge',
    description: 'Evaluates agent outputs',
    system_prompt: 'You are Judge, responsible for evaluating the quality of agent outputs.',
    interests: { type: ['agent_output'] },
    permissions: { can_use_tools: [], can_create_goals: false },
    is_core: true,
  }),
  
  steward: (): AgentType => createTestAgent({
    id: 'Steward',
    description: 'Manages goal prioritization',
    system_prompt: 'You are Steward, responsible for prioritizing and allocating resources to goals.',
    interests: { type: ['goal'] },
    permissions: { can_use_tools: [], can_create_goals: false },
    is_core: true,
  }),
};

