import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ModelConfig, ChatMessage } from '@/src/types/models';
import { modelExecutor } from '@/src/models/executor';
import { modelRouter } from '@/src/models/router';

export abstract class BaseAgent {
  constructor(protected agentType: AgentType) {}

  abstract execute(context: AgentExecutionContext): Promise<AgentOutput>;
  
  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    // Default implementation: execute and yield the full result
    const result = await this.execute(context);
    yield result.output;
  }

  protected async selectModel(requiredModalities?: string[]): Promise<ModelConfig> {
    const model = await modelRouter.selectModel({
      agentId: this.agentType.id,
      requiredModalities,
    });

    if (!model) {
      throw new Error(`No available model for agent ${this.agentType.id}`);
    }

    return model;
  }

  protected buildMessages(userMessages: ChatMessage[]): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Add system prompt
    if (this.agentType.system_prompt) {
      messages.push({
        role: 'system',
        content: this.agentType.system_prompt,
      });
    }

    // Add user messages
    messages.push(...userMessages);

    return messages;
  }

  protected async executeModelCall(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    return modelExecutor.generateText(model, messages, options);
  }

  protected async *executeModelCallStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): AsyncIterable<string> {
    yield* modelExecutor.generateTextStream(model, messages, options);
  }
}

