import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { TaskPlannerPrompt } from '../prompts/taskPlanner.prompt';
import { blackboardService } from '@/src/blackboard/service';

export class TaskPlannerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'TaskPlanner',
        description: 'Breaks down goals into actionable tasks',
        system_prompt: TaskPlannerPrompt,
        modalities: ['text'],
        interests: { type: ['goal'], dimensions: { status: 'open' } },
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

    // Extract goal information from context
    const goalId = context.input.goal_id as string;
    const goalSummary = context.input.goal_summary as string || 'Unknown goal';

    // Build prompt for task planning - emphasize JSON output
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Analyze the following goal and break it down into specific, actionable tasks.

Goal: ${goalSummary}

**CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no prose, no explanations, no tables.**

Return a JSON object with this exact structure:
{
  "tasks": [
    {
      "number": 1,
      "summary": "Clear, actionable instruction starting with a verb",
      "priority": "high|medium|low",
      "agent_count": 1,
      "task_type": "research|writing|analysis|coding|planning|general",
      "dependencies": []
    }
  ]
}

Each task summary must:
- Start with an action verb (Identify, Create, Research, Compile, etc.)
- Be a single, specific task (not a group description or explanation)
- Be clear and actionable

Do NOT include:
- Explanatory text about task groups
- Notes about priorities or dependencies
- Markdown formatting
- Any text outside the JSON object

Respond with ONLY the JSON object, nothing else.`,
    };

    const messages = this.buildMessages([userMessage]);

    // Execute model call
    const output = await this.executeModelCall(model, messages, {
      temperature: 0.5, // Balanced creativity and structure
      maxTokens: 2000,
    });

    // Parse output and create tasks (simplified - in production would parse structured output)
    // For now, the orchestrator will handle task creation based on the output

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      input_summary: `Goal: ${goalId} - ${goalSummary}`,
      output,
      latency_ms: latency,
      metadata: {
        model_name: model.name,
        model_provider: model.provider,
        goal_id: goalId,
      },
    };
  }

  async *executeStream(context: AgentExecutionContext): AsyncIterable<string> {
    const result = await this.execute(context);
    yield result.output;
  }
}

