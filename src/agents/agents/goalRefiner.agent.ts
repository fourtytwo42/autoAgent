import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { GoalRefinerPrompt } from '../prompts/goalRefiner.prompt';
import { parseJsonOutput, extractTextFromJson } from '@/src/utils/jsonParser';

export class GoalRefinerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'GoalRefiner',
        description: 'Refines user requests into well-defined goals',
        system_prompt: GoalRefinerPrompt,
        modalities: ['text'],
        interests: { type: ['user_request'] },
        permissions: { can_use_tools: [], can_create_goals: false },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Extract user request from context
    const userRequest = context.input.user_request || context.input.message || '';
    const userRequestId = context.input.user_request_id as string;

    // Select model (prefer high-quality reasoning models)
    const model = await this.selectModel(['text']);

    // Build prompt for goal refinement
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Refine the following user request into a well-defined, actionable goal:\n\nUser Request: ${userRequest}\n\nProvide a refined goal statement that expands on the user's intent, adds necessary context, and makes it specific and actionable.`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const rawOutput = await this.executeModelCall(model, messages, {
      temperature: 0.6, // Balanced for creative expansion while staying focused
      maxTokens: 20000,
    });

    // Parse JSON output
    const parseResult = parseJsonOutput(rawOutput);
    let output: string;
    let metadata: Record<string, any> = {
      model_name: model.name,
      model_provider: model.provider,
      user_request_id: userRequestId,
    };

    if (parseResult.success && parseResult.data) {
      const jsonData = parseResult.data as any;
      // Extract refined_goal from JSON
      if (jsonData.refined_goal) {
        output = jsonData.refined_goal;
      } else {
        output = extractTextFromJson(jsonData);
      }
      if (jsonData.key_components) {
        metadata.key_components = jsonData.key_components;
      }
    } else {
      console.warn(`[GoalRefiner] Failed to parse JSON output: ${parseResult.error}, using raw output`);
      output = rawOutput;
    }

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: userRequest.substring(0, 200),
      output,
      latency_ms: latency,
      metadata,
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    // Use default implementation from BaseAgent
    yield* super.executeStream(context);
  }
}

