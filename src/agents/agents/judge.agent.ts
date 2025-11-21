import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { JudgePrompt } from '../prompts/judge.prompt';
import { blackboardService } from '@/src/blackboard/service';
import { parseJsonOutput } from '@/src/utils/jsonParser';

export class JudgeAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'Judge',
        description: 'Evaluates agent outputs and provides quality scores',
        system_prompt: JudgePrompt,
        modalities: ['text'],
        interests: { type: ['agent_output'], dimensions: { status: 'completed' } },
        permissions: { can_use_tools: [], can_create_goals: false },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Select model (prefer high-quality models for evaluation)
    const model = await this.selectModel(['text']);

    // Extract agent output information
    const agentOutputId = context.input.agent_output_id as string;
    const agentOutput = context.input.agent_output as string;
    const taskSummary = context.input.task_summary as string || 'Unknown task';
    const agentId = context.input.agent_id as string || 'Unknown agent';
    const modelId = context.input.model_id as string || '';

    // Build evaluation prompt
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Evaluate the following agent output:\n\nTask: ${taskSummary}\nAgent: ${agentId}\n\nOutput:\n${agentOutput}\n\nProvide:\n1. A quality score (0.0 to 1.0)\n2. Brief evaluation explaining strengths and weaknesses\n3. Suggestions for improvement if applicable`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const rawOutput = await this.executeModelCall(model, messages, {
      temperature: 0.3, // Lower temperature for consistent evaluation
      maxTokens: 20000,
    });

    // Parse JSON output
    const parseResult = parseJsonOutput(rawOutput);
    let output: string;
    let score = 0.5;
    let scores: Record<string, number> = {};
    let explanation = '';
    let strengths: string[] = [];
    let weaknesses: string[] = [];

    if (parseResult.success && parseResult.data) {
      const jsonData = parseResult.data as any;
      score = jsonData.overall_score ?? jsonData.score ?? 0.5;
      scores = jsonData.scores || {};
      explanation = jsonData.explanation || '';
      strengths = jsonData.strengths || [];
      weaknesses = jsonData.weaknesses || [];
      output = explanation || JSON.stringify(jsonData, null, 2);
    } else {
      console.warn(`[Judge] Failed to parse JSON output: ${parseResult.error}, using raw output`);
      output = rawOutput;
      // Fallback: try to extract score from text
      const scoreMatch = rawOutput.match(/score[:\s]+([0-9.]+)/i);
      if (scoreMatch) {
        score = parseFloat(scoreMatch[1]);
      }
    }

    // Clamp score to 0-1
    score = Math.max(0, Math.min(1, score));

    // Create judgement in blackboard
    await blackboardService.create({
      type: 'judgement',
      summary: `Judgement for ${agentId} output`,
      dimensions: {
        agent_id: agentId,
        agent_output_id: agentOutputId,
        model_id: modelId, // Include model_id so evaluator can find judgements by model
        score,
        status: 'completed',
        ...scores,
      },
      links: { parents: [agentOutputId] },
      detail: {
        reasoning: output,
        explanation,
        strengths,
        weaknesses,
        evaluated_at: new Date().toISOString(),
      },
    });

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: `Evaluated output from ${agentId}`,
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        agent_output_id: agentOutputId,
        score,
        scores,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

