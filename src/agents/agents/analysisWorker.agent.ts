import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { AnalysisWorkerPrompt } from '../prompts/analysisWorker.prompt';
import { blackboardService } from '@/src/blackboard/service';

export class AnalysisWorkerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'AnalysisWorker',
        description: 'Specialized agent for analysis tasks',
        system_prompt: AnalysisWorkerPrompt,
        modalities: ['text'],
        interests: { type: ['task'], dimensions: { task_type: 'analysis' } },
        permissions: { can_use_tools: [], can_create_goals: false },
        is_core: true,
        is_enabled: true,
      }
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Get task context
    const taskId = context.input.task_id;
    const taskSummary = context.input.task_summary || context.input.message || 'Analyze data';
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
        content: `Analyze the following task:\n\n${taskSummary}\n\n${relatedContext ? `\nContext:\n${relatedContext}` : ''}\n\nProvide accurate, deep analysis with actionable insights.`,
      },
    ];

    // Select model and execute
    const model = await this.selectModel();
    const response = await this.executeModelCall(model, messages, context.options);

    const latency = Date.now() - startTime;

    return {
      agent_id: this.agentType.id,
      model_id: model.id,
      output: response,
      input_summary: taskSummary.substring(0, 200),
      latency_ms: latency,
      metadata: {
        task_id: taskId,
        goal_id: goalId,
        task_type: 'analysis',
      },
    };
  }
}

