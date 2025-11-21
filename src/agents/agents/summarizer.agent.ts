import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { SummarizerPrompt } from '../prompts/summarizer.prompt';
import { parseJsonOutput } from '@/src/utils/jsonParser';

export class SummarizerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'Summarizer',
        description: 'Creates concise summaries of agent outputs for the blackboard',
        system_prompt: SummarizerPrompt,
        modalities: ['text'],
        interests: {},
        permissions: {},
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Select model
    const model = await this.selectModel(['text']);

    // Extract agent output to summarize
    const agentOutput = context.input.agent_output as string;
    const agentId = context.input.agent_id as string;
    const taskId = context.input.task_id as string;
    const goalId = context.input.goal_id as string;

    if (!agentOutput) {
      throw new Error('agent_output is required for Summarizer');
    }

    // Build prompt
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Create a concise summary of the following agent output:

Agent: ${agentId}
${taskId ? `Task ID: ${taskId}` : ''}
${goalId ? `Goal ID: ${goalId}` : ''}

Output:
${agentOutput.substring(0, 5000)}${agentOutput.length > 5000 ? '...' : ''}

**CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no prose, no explanations.**

Return this JSON structure:
{
  "summary": "Concise 1-2 sentence summary",
  "key_points": ["key point 1", "key point 2"],
  "metadata": {
    "status": "completed|in_progress|failed",
    "outcome": "success|partial|failed"
  }
}`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const rawOutput = await this.executeModelCall(model, messages, {
      temperature: 0.3, // Low temperature for consistent summaries
      maxTokens: 500,
    });

    // Parse JSON output
    const parseResult = parseJsonOutput(rawOutput);
    let summary = '';
    let keyPoints: string[] = [];
    let metadata: Record<string, any> = {};

    if (parseResult.success && parseResult.data) {
      const jsonData = parseResult.data as any;
      summary = jsonData.summary || agentOutput.substring(0, 200);
      keyPoints = jsonData.key_points || [];
      metadata = jsonData.metadata || {};
    } else {
      // Fallback: use first 200 chars as summary
      summary = agentOutput.substring(0, 200);
    }

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: `Summarized output from ${agentId}`,
      output: summary,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        key_points: keyPoints,
        ...metadata,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

