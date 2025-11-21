import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { WeSpeakerPrompt } from '../prompts/wespeaker.prompt';

export class WeSpeakerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'WeSpeaker',
        description: 'User-facing conversational agent',
        system_prompt: WeSpeakerPrompt,
        modalities: ['text'],
        interests: { type: ['user_request'] },
        permissions: { can_use_tools: ['web_search'], can_create_goals: true },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Select model
    const model = await this.selectModel(['text']);

    // Extract user message from context
    const userMessage = this.extractUserMessage(context.input);

    // Build messages
    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const output = await this.executeModelCall(model, messages, {
      temperature: 0.7,
      maxTokens: context.options?.maxTokens || 20000,
    });

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: typeof context.input === 'string' ? context.input : JSON.stringify(context.input),
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    // Select model
    const model = await this.selectModel(['text']);

    // Extract user message from context
    const userMessage = this.extractUserMessage(context.input);

    // Build messages
    const messages = this.buildMessages([userMessage]);

    // Execute streaming model call
    yield* this.executeModelCallStream(model, messages, {
      temperature: 0.7,
      maxTokens: context.options?.maxTokens || 20000,
    });
  }

  private extractUserMessage(input: Record<string, any>): ChatMessage {
    // Extract user message from context
    if (typeof input === 'string') {
      return {
        role: 'user',
        content: input,
      };
    }

    if (input.message && typeof input.message === 'string') {
      return {
        role: 'user',
        content: input.message,
      };
    }

    if (input.content && typeof input.content === 'string') {
      return {
        role: 'user',
        content: input.content,
      };
    }

    // Default: try to stringify
    return {
      role: 'user',
      content: JSON.stringify(input),
    };
  }
}

