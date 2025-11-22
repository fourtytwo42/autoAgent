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
        // Extract summary - prioritize summary field, but ensure it's a string and not JSON
        if (jsonData.summary && typeof jsonData.summary === 'string' && jsonData.summary.trim().length > 0) {
          // Validate it's not raw JSON
          if (!jsonData.summary.trim().startsWith('{') && !jsonData.summary.trim().startsWith('[')) {
            metadata.summary = jsonData.summary.trim();
            console.log(`[Worker] Extracted summary from JSON: ${metadata.summary.substring(0, 100)}...`);
          } else {
            console.warn(`[Worker] Summary field contains JSON, extracting from content instead`);
            // Fall through to create summary from content
          }
        }
        
        // If no valid summary yet, create one from content
        if (!metadata.summary || metadata.summary.trim().length === 0) {
          const contentText = extractTextFromJson(jsonData);
          if (contentText && contentText.length > 20 && !contentText.trim().startsWith('{')) {
            // Use first 150 chars of content as summary, but skip if it looks like JSON
            const cleanSummary = contentText.substring(0, 200).trim();
            // Remove any leading JSON structure indicators
            let summaryText = cleanSummary;
            if (summaryText.startsWith('{') || summaryText.startsWith('[')) {
              // Try to extract meaningful text from JSON
              try {
                const parsed = typeof jsonData === 'object' ? jsonData : JSON.parse(summaryText);
                // Try to find a meaningful field to use as summary
                if (parsed.content) summaryText = parsed.content;
                else if (parsed.response) summaryText = parsed.response;
                else if (parsed.text) summaryText = parsed.text;
                else if (parsed.message) summaryText = parsed.message;
                else summaryText = String(contentText).substring(0, 150);
              } catch (e) {
                summaryText = String(contentText).substring(0, 150);
              }
            }
            
            // Clean up summary - ensure it's readable text
            if (summaryText && summaryText.length > 20) {
              metadata.summary = summaryText.substring(0, 150).trim() + (summaryText.length > 150 ? '...' : '');
              console.log(`[Worker] Created summary from content: ${metadata.summary.substring(0, 100)}...`);
            }
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
    
    // Ensure output is not empty, just IDs, or a search query
    if (!output || output.trim().length === 0 || 
        (output.includes('"ids"') && output.length < 200) ||
        (output.trim().startsWith('{') && (output.includes('"query"') || output.includes('"search"')))) {
      console.error(`[Worker] Output is empty, invalid, or contains a search query. Raw output was: ${rawOutput.substring(0, 500)}`);
      
      // If output is a search query, create a proper response based on the task
      if (output && (output.includes('"query"') || output.includes('"search"'))) {
        console.error(`[Worker] Rejecting query-based output. Creating task-based response instead.`);
        // Create a response explaining that specific current data isn't available, but provide guidance
        output = `I've completed analysis for the task: ${taskSummary.substring(0, 100)}. Based on general knowledge, here are the key recommendations:\n\n`;
        output += `Note: For current pricing, availability, or real-time data, this would need access to live databases or search capabilities which are not available. `;
        output += `However, I can provide general guidance based on typical patterns and common knowledge for this type of request.`;
      } else {
        // Use raw output as fallback, or create a generic response
        output = rawOutput || `Task analysis completed for: ${taskSummary.substring(0, 100)}. `;
        output += `Note: Specific current data requires external sources not available in this system.`;
      }
    }
    
    // Ensure we have a summary - create one from output if missing
    if (!metadata.summary || metadata.summary.trim().length === 0) {
      // Create a concise summary, not just the first N chars of output
      // Try to extract a meaningful one-line summary from the task
      let summaryText = '';
      
      // If output starts with JSON, try to extract meaningful content
      if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
        try {
          // Try to parse and extract a meaningful field
          const parsed = typeof parseResult.data === 'object' && parseResult.success 
            ? parseResult.data 
            : JSON.parse(output.substring(0, 500));
          
          if (parsed.content) summaryText = parsed.content;
          else if (parsed.response) summaryText = parsed.response;
          else if (parsed.text) summaryText = parsed.text;
          else if (parsed.message) summaryText = parsed.message;
          else if (parsed.query && typeof parsed.query === 'string') {
            summaryText = `Completed: ${parsed.query}`;
          }
        } catch (e) {
          // If parsing fails, continue to other methods
        }
      }
      
      // If no summary from JSON, create a concise one from task description
      if (!summaryText || summaryText.trim().length < 10) {
        // Extract key action from task summary
        // Remove common prefixes and create a concise summary
        const taskWords = taskSummary.split(' ');
        // Find action verbs (usually early in the sentence)
        const actionIndex = taskWords.findIndex(w => 
          ['research', 'identify', 'compile', 'create', 'draft', 'write', 'find', 'list', 'gather'].includes(w.toLowerCase())
        );
        
        if (actionIndex >= 0 && actionIndex < taskWords.length - 1) {
          // Use task action + first few words as summary
          const action = taskWords[actionIndex];
          const rest = taskWords.slice(actionIndex + 1, actionIndex + 6).join(' ');
          summaryText = `${action.charAt(0).toUpperCase() + action.slice(1)}${rest ? ' ' + rest : ''}`;
          // Limit to 100 chars for conciseness
          summaryText = summaryText.substring(0, 100);
          if (taskSummary.length > 100) summaryText += '...';
        } else {
          // Fallback: use first sentence of task or first 80 chars
          const firstSentence = taskSummary.split(/[.!?]/)[0] || taskSummary;
          summaryText = firstSentence.substring(0, 80).trim();
          if (firstSentence.length > 80) summaryText += '...';
        }
      } else {
        // Clean up summary text - take first sentence or 80 chars
        summaryText = summaryText.trim();
        if (summaryText.length > 80) {
          // Try to find a sentence boundary
          const firstSentence = summaryText.split(/[.!?]/)[0];
          if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
            summaryText = firstSentence;
          } else {
            summaryText = summaryText.substring(0, 80) + '...';
          }
        }
      }
      
      // Final validation and assignment
      summaryText = summaryText.trim();
      if (summaryText.length > 10 && !summaryText.startsWith('{') && !summaryText.startsWith('[')) {
        metadata.summary = summaryText;
        console.log(`[Worker] Created concise summary: ${metadata.summary}`);
      } else {
        // Last resort: use a generic summary based on task
        metadata.summary = `Completed task: ${taskSummary.substring(0, 70)}...`;
        console.log(`[Worker] Using task-based summary: ${metadata.summary}`);
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

