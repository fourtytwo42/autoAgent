import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { StewardPrompt } from '../prompts/steward.prompt';
import { blackboardService } from '@/src/blackboard/service';

export class StewardAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'Steward',
        description: 'Manages goal prioritization and resource allocation',
        system_prompt: StewardPrompt,
        modalities: ['text'],
        interests: { type: ['goal'] },
        permissions: { can_use_tools: [], can_create_goals: false },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Select model (prefer high-quality reasoning models)
    const model = await this.selectModel(['text']);

    // Get all open goals
    const openGoals = await blackboardService.query({
      type: 'goal',
      dimensions: { status: 'open' },
      limit: 50,
    });

    // Build prompt with goal overview
    const goalsSummary = openGoals.map((g, i) => 
      `${i + 1}. ${g.summary} (Priority: ${g.dimensions?.priority || 'medium'})`
    ).join('\n');

    const userMessage: ChatMessage = {
      role: 'user',
      content: `Review the following open goals and provide prioritization recommendations:\n\n${goalsSummary}\n\nConsider:\n- User goals vs system goals\n- Dependencies\n- Resource availability\n- Impact and urgency\n\nProvide:\n1. Prioritized list of goals\n2. Resource allocation suggestions\n3. Any goals that should be deferred or closed`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const output = await this.executeModelCall(model, messages, {
      temperature: 0.4, // Balanced for strategic thinking
      maxTokens: 20000,
    });

    // Update goal priorities based on output (simplified - would parse structured output)
    // For now, the orchestrator will handle priority updates

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: `Reviewed ${openGoals.length} open goals`,
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        goals_reviewed: openGoals.length,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

