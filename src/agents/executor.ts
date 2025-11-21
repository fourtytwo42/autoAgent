import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ModelConfig, ChatMessage } from '@/src/types/models';
import { modelExecutor } from '@/src/models/executor';
import { modelRouter } from '@/src/models/router';

export class AgentExecutor {
  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Get agent type (will be loaded by the orchestrator)
    // For now, we'll assume it's passed in the context
    // In a full implementation, this would load from registry

    // Select model for agent
    const model = await modelRouter.selectModel({
      agentId: context.agent_id,
      requiredModalities: context.options?.temperature ? ['text'] : undefined,
    });

    if (!model) {
      throw new Error(`No available model for agent ${context.agent_id}`);
    }

    // Build messages (system prompt + input)
    // This will be handled by the specific agent implementation
    // For now, we'll use a basic structure
    const messages: ChatMessage[] = [];

    // Execute model call
    const output = await modelExecutor.generateText(
      model,
      messages,
      context.options || {}
    );

    const latency = Date.now() - startTime;

    return {
      agent_id: context.agent_id,
      model_id: model.id,
      input_summary: JSON.stringify(context.input),
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    // Select model for agent
    const model = await modelRouter.selectModel({
      agentId: context.agent_id,
    });

    if (!model) {
      throw new Error(`No available model for agent ${context.agent_id}`);
    }

    // Build messages (will be handled by specific agent)
    const messages: ChatMessage[] = [];

    // Execute streaming model call
    yield* modelExecutor.generateTextStream(model, messages, context.options || {});
  }
}

export const agentExecutor = new AgentExecutor();

