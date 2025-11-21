import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { JudgePrompt } from '../prompts/judge.prompt';
import { blackboardService } from '@/src/blackboard/service';

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

    // Build evaluation prompt
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Evaluate the following agent output:\n\nTask: ${taskSummary}\nAgent: ${agentId}\n\nOutput:\n${agentOutput}\n\nProvide:\n1. A quality score (0.0 to 1.0)\n2. Brief evaluation explaining strengths and weaknesses\n3. Suggestions for improvement if applicable`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const output = await this.executeModelCall(model, messages, {
      temperature: 0.3, // Lower temperature for consistent evaluation
      maxTokens: 1000,
    });

    // Parse score from output (simplified - in production would use structured output)
    const scoreMatch = output.match(/score[:\s]+([0-9.]+)/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;

    // Create judgement in blackboard
    await blackboardService.create({
      type: 'judgement',
      summary: `Judgement for ${agentId} output`,
      dimensions: {
        agent_id: agentId,
        agent_output_id: agentOutputId,
        score: Math.max(0, Math.min(1, score)), // Clamp to 0-1
        status: 'completed',
      },
      links: { parents: [agentOutputId] },
      detail: {
        reasoning: output,
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
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

