import { BaseAgent } from './base.agent';
import { AgentType, AgentExecutionContext, AgentOutput } from '@/src/types/agents';
import { ChatMessage } from '@/src/types/models';
import { WorkerPrompt } from '../prompts/worker.prompt';
import { blackboardService } from '@/src/blackboard/service';
import { parseJsonOutput, extractTextFromJson } from '@/src/utils/jsonParser';
import { createUserQueryRequest } from '@/src/blackboard/userQueryHandler';
import { toolRegistry } from '@/src/tools/registry';

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

    // Get blackboard context in card format (same as blackboard view)
    let blackboardContext = '';
    if (goalId) {
      blackboardContext = await blackboardService.getContextForAgent(goalId);
    } else if (taskId) {
      blackboardContext = await blackboardService.getContextForAgent(undefined, taskId);
    }

    // Check for user responses if this is a continuation
    let userResponseContext = '';
    if (context.input.continuation && context.input.user_response) {
      userResponseContext = `\n**User Response to Previous Question:**\n${context.input.user_response}\n\nUse this information to complete your task.`;
    } else if (taskId) {
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
        userResponseContext = `\n**User Response:**\n${answer}\n\nUse this information to complete your task.`;
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

${blackboardContext ? `\n**Blackboard Context (same view as the blackboard page - for reference only):**\n${blackboardContext}\n\nRemember: These items are for context only. Focus ONLY on completing YOUR task above.` : ''}
${userResponseContext}

You can use tool calls in your JSON output to query the blackboard for more information if needed. See the system prompt for details on the query_blackboard tool.

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
        // Handle tool calls if present
        if (jsonData.tool_calls && Array.isArray(jsonData.tool_calls)) {
          const toolResults: any[] = [];
          for (const toolCall of jsonData.tool_calls) {
            try {
              if (toolCall.tool === 'query_blackboard') {
                const tool = toolRegistry.get('query_blackboard');
                if (tool) {
                  const result = await tool.execute(toolCall.parameters || {}, {
                    agent_id: this.agentType.id,
                    task_id: taskId,
                    metadata: context.input,
                  });
                  toolResults.push({
                    tool: toolCall.tool,
                    parameters: toolCall.parameters,
                    result: result.output,
                  });
                }
              }
            } catch (error) {
              console.error(`[Worker] Error executing tool call:`, error);
              toolResults.push({
                tool: toolCall.tool,
                error: error instanceof Error ? error.message : 'Tool execution failed',
              });
            }
          }
          
          // Add tool results to metadata
          if (toolResults.length > 0) {
            metadata.tool_calls = toolResults;
            // Extract content from JSON first
            const baseContent = extractTextFromJson(jsonData);
            // Append tool results to output for context
            output = baseContent;
            if (toolResults.length > 0) {
              output += '\n\n**Blackboard Query Results:**\n';
              toolResults.forEach((result, idx) => {
                if (result.result) {
                  output += `\nQuery ${idx + 1}:\n${JSON.stringify(result.result, null, 2)}\n`;
                }
              });
            }
          } else {
            output = extractTextFromJson(jsonData);
          }
        } else {
          // Extract content from JSON - prioritize content field
          output = extractTextFromJson(jsonData);
          
          // If output is too short or looks like just IDs, log a warning
          if (output.length < 50 || (output.includes('"ids"') && !output.includes('content'))) {
            console.warn(`[Worker] Output seems incomplete or contains only IDs. JSON data:`, JSON.stringify(jsonData, null, 2));
            console.warn(`[Worker] Extracted output:`, output);
            // Try to get content directly if it exists
            if (jsonData.content && typeof jsonData.content === 'string' && jsonData.content.length > 10) {
              output = jsonData.content;
              console.log(`[Worker] Using content field directly: ${output.substring(0, 100)}...`);
            }
          }
        }
        
        // Store additional metadata from JSON if present
        if (jsonData.summary) {
          metadata.summary = jsonData.summary;
          console.log(`[Worker] Extracted summary from JSON: ${jsonData.summary.substring(0, 100)}...`);
        } else {
          // If no summary field, try to create one from content
          const contentText = extractTextFromJson(jsonData);
          if (contentText && contentText.length > 20) {
            // Use first 150 chars of content as summary
            metadata.summary = contentText.substring(0, 150) + (contentText.length > 150 ? '...' : '');
            console.log(`[Worker] Created summary from content: ${metadata.summary.substring(0, 100)}...`);
          }
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
    
    // Ensure output is not empty or just IDs
    if (!output || output.trim().length === 0 || (output.includes('"ids"') && output.length < 200)) {
      console.error(`[Worker] Output is empty or invalid. Raw output was: ${rawOutput.substring(0, 500)}`);
      // Use raw output as fallback
      output = rawOutput || `Task completed by ${this.agentType.id}`;
    }
    
    // Ensure we have a summary - create one from output if missing
    if (!metadata.summary || metadata.summary.trim().length === 0) {
      // Create a summary from the output content (first 150 chars)
      const summaryText = output.substring(0, 150).trim();
      if (summaryText.length > 20) {
        metadata.summary = summaryText + (output.length > 150 ? '...' : '');
        console.log(`[Worker] Created summary from output content: ${metadata.summary}`);
      } else {
        // Fallback to a generic summary
        metadata.summary = `Completed task: ${taskSummary.substring(0, 100)}`;
        console.log(`[Worker] Using fallback summary: ${metadata.summary}`);
      }
    }
    
    console.log(`[Worker] Final output length: ${output.length} chars, preview: ${output.substring(0, 200)}...`);
    console.log(`[Worker] Final metadata summary: ${metadata.summary}`);

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

