import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { modelEvaluator } from '@/src/models/evaluator';

const ModelEvaluatorPrompt = `You are ModelEvaluator, responsible for evaluating the performance of LLM models used by the hive.

Your role is to:
- Analyze judgements made about model outputs
- Calculate quality and reliability scores
- Identify patterns in model performance
- Recommend model selection improvements
- Track performance across different domains (code, design, math, etc.)

You should provide clear, data-driven evaluations and recommendations.`;

export class ModelEvaluatorAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'ModelEvaluator',
        description: 'Evaluates model performance and updates scores',
        system_prompt: ModelEvaluatorPrompt,
        modalities: ['text'],
        interests: { type: ['judgement', 'metric'] },
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

    // Extract evaluation request from context
    const evaluationRequest = this.extractEvaluationRequest(context.input);

    // Perform evaluation
    let evaluationResult;
    if (evaluationRequest.modelId) {
      evaluationResult = await modelEvaluator.evaluateModel(evaluationRequest.modelId);
      if (evaluationResult) {
        await modelEvaluator.updateModelScores(evaluationRequest.modelId);
      }
    } else {
      // Evaluate all models
      await modelEvaluator.updateAllModelScores();
      evaluationResult = { message: 'All models evaluated' } as any;
    }

    // Build messages for LLM analysis
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Analyze the following model evaluation results and provide insights:\n\n${JSON.stringify(evaluationResult, null, 2)}`,
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
      input_summary: JSON.stringify(evaluationRequest),
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        evaluation_result: evaluationResult,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    // For now, just execute and yield the full result
    const result = await this.execute(context);
    yield result.output;
  }

  private extractEvaluationRequest(input: Record<string, any>): { modelId?: string; evaluateAll?: boolean } {
    if (typeof input === 'string') {
      return { evaluateAll: true };
    }

    return {
      modelId: input.model_id || input.modelId,
      evaluateAll: input.evaluate_all || input.evaluateAll || false,
    };
  }
}

