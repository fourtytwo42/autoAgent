import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { ResearchWorkerPrompt } from '../prompts/researchWorker.prompt';
import { blackboardService } from '@/src/blackboard/service';
import { parseJsonOutput, extractTextFromJson } from '@/src/utils/jsonParser';

export class ResearchWorkerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'ResearchWorker',
        description: 'Specialized agent for research and information gathering tasks',
        system_prompt: ResearchWorkerPrompt,
        modalities: ['text'],
        interests: { type: ['task'], dimensions: { task_type: 'research' } },
        permissions: { can_use_tools: ['web_search'], can_create_goals: false },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Get task context
    const taskId = context.input.task_id;
    const taskSummary = context.input.task_summary || context.input.message || 'Conduct research';
    const goalId = context.input.goal_id;

    // Get related context from blackboard
    let relatedContext = '';
    if (taskId) {
      const task = await blackboardService.findById(taskId);
      if (task) {
        relatedContext += `Task: ${task.summary}\n`;
        if (task.dimensions?.priority) {
          relatedContext += `Priority: ${task.dimensions.priority}\n`;
        }
      }
    }

    if (goalId) {
      const goal = await blackboardService.findById(goalId);
      if (goal) {
        relatedContext += `\nRelated Goal: ${goal.summary}\n`;
      }
    }

    // Build messages
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.agentType.system_prompt,
      },
      {
        role: 'user',
        content: `Conduct research on the following task:\n\n${taskSummary}\n\n${relatedContext ? `\nContext:\n${relatedContext}` : ''}\n\nProvide well-sourced, accurate information. Organize your findings clearly.`,
      },
    ];

    // Select model and execute
    const model = await this.selectModel();
    const rawOutput = await this.executeModelCall(model, messages, context.options);

    // Parse JSON output
    const parseResult = parseJsonOutput(rawOutput);
    let output: string;
    let metadata: Record<string, any> = {
      task_id: taskId,
      goal_id: goalId,
      task_type: 'research',
    };

    if (parseResult.success && parseResult.data) {
      const jsonData = parseResult.data as any;
      output = extractTextFromJson(jsonData);
      if (jsonData.summary) metadata.summary = jsonData.summary;
      if (jsonData.status) metadata.status = jsonData.status;
      if (jsonData.sources) metadata.sources = jsonData.sources;
    } else {
      console.warn(`[ResearchWorker] Failed to parse JSON output: ${parseResult.error}, using raw output`);
      output = rawOutput;
    }

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      output,
      input_summary: taskSummary.substring(0, 200),
      latency_ms: latency,
      metadata,
    };
  }
}

