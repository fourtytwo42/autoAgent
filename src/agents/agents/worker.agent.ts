import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { WorkerPrompt } from '../prompts/worker.prompt';
import { blackboardService } from '@/src/blackboard/service';
import { parseJsonOutput, extractTextFromJson } from '@/src/utils/jsonParser';
import { createUserQueryRequest } from '@/src/blackboard/userQueryHandler';

export class WorkerAgent extends BaseAgent {
  constructor(agentType?: AgentType) {
    super(
      agentType || {
        id: 'Worker',
        description: 'General-purpose task execution agent',
        system_prompt: WorkerPrompt,
        modalities: ['text'],
        interests: { type: ['task'] },
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
    const taskSummary = context.input.task_summary || context.input.message || 'Execute the assigned task';
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
      
      // Check for user responses if this is a continuation
      if (context.input.continuation && context.input.user_response) {
        relatedContext += `\n**User Response to Previous Question:**\n${context.input.user_response}\n\nUse this information to complete your task.`;
      }
      
      // Check for pending user responses
      const userResponses = await blackboardService.query({
        type: 'user_response',
        dimensions: {
          task_id: taskId,
          status: 'answered',
        },
        parent_id: taskId,
      });
      
      if (userResponses.length > 0) {
        const latestResponse = userResponses[userResponses.length - 1];
        const answer = (latestResponse.detail as any)?.answer || latestResponse.summary;
        relatedContext += `\n**User Response:**\n${answer}\n\nUse this information to complete your task.`;
      }
    }

    if (goalId) {
      const goal = await blackboardService.findById(goalId);
      if (goal) {
        relatedContext += `\nRelated Goal: ${goal.summary}\n`;
      }
    }

    // Build messages - emphasize focusing ONLY on the specific task
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.agentType.system_prompt,
      },
      {
        role: 'user',
        content: `**IMPORTANT: You must ONLY complete the specific task below. Do NOT attempt to complete the entire goal or other tasks.**

**Your Task:**
${taskSummary}

${relatedContext ? `\n**Context (for reference only - do NOT complete these):**\n${relatedContext}\n\nRemember: The goal and other tasks are for context only. Focus ONLY on completing YOUR task above.` : ''}

Provide a clear, complete response that addresses ONLY the task requirements listed above. Do not include information about other tasks or attempt to complete the entire goal.`,
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
    };

    if (parseResult.success && parseResult.data) {
      const jsonData = parseResult.data as any;
      
      // Check if worker is requesting user information
      if (jsonData.status === 'waiting_for_user' && jsonData.user_query && taskId) {
        try {
          const question = jsonData.user_query.question || 'I need some information to continue.';
          const queryContext = jsonData.user_query.context || jsonData.content || '';
          
          await createUserQueryRequest(taskId, question, queryContext);
          
          // Return a message indicating we're waiting for user input
          output = jsonData.content || `Waiting for user response to: ${question}`;
          metadata.status = 'waiting_for_user';
          metadata.user_query_requested = true;
          
          console.log(`[Worker] Requested user input for task ${taskId}: ${question}`);
        } catch (error) {
          console.error(`[Worker] Error creating user query request:`, error);
          output = extractTextFromJson(jsonData);
        }
      } else {
        // Extract content from JSON
        output = extractTextFromJson(jsonData);
        // Store additional metadata from JSON if present
        if (jsonData.summary) {
          metadata.summary = jsonData.summary;
        }
        if (jsonData.status) {
          metadata.status = jsonData.status;
        }
      }
    } else {
      // Fallback: use raw output if JSON parsing fails
      console.warn(`[Worker] Failed to parse JSON output: ${parseResult.error}, using raw output`);
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

