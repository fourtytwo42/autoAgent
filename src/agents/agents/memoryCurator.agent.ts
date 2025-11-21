import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { MemoryCuratorPrompt } from '../prompts/memoryCurator.prompt';
import { blackboardService } from '@/src/blackboard/service';

export class MemoryCuratorAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'MemoryCurator',
        description: 'Maintains and optimizes the knowledge base',
        system_prompt: MemoryCuratorPrompt,
        modalities: ['text'],
        interests: { type: ['goal', 'task', 'agent_output'] },
        permissions: { can_use_tools: [], can_create_goals: false },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Select model
    const model = await this.selectModel(['text']);

    // Get old items for review
    const oldItems = await blackboardService.query({
      type: 'task',
      dimensions: { status: 'completed' },
      limit: 50,
    });

    const completedGoals = await blackboardService.query({
      type: 'goal',
      dimensions: { status: 'completed' },
      limit: 50,
    });

    const userMessage: ChatMessage = {
      role: 'user',
      content: `Review the following items for curation:\n\nCompleted Tasks: ${oldItems.length}\nCompleted Goals: ${completedGoals.length}\n\nProvide:\n1. Items to archive\n2. Items to delete\n3. Items to consolidate\n4. Reasoning for each recommendation`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const output = await this.executeModelCall(model, messages, {
      temperature: 0.3, // Lower temperature for analytical tasks
      maxTokens: 2000,
    });

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: `Reviewed ${oldItems.length + completedGoals.length} items`,
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        items_reviewed: oldItems.length + completedGoals.length,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

