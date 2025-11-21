import { BaseTool } from './base.tool';
import { ToolDefinition, ToolResult, ToolContext } from './types';
import { blackboardService } from '@/src/blackboard/service';

export class BlackboardTool extends BaseTool {
  name = 'query_blackboard';
  description = 'Query the blackboard to get context about goals, tasks, agent outputs, and other items. Use this to dig deeper into related information when needed.';

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query_type: {
            type: 'string',
            description: 'Type of query to perform: by_id, by_type, by_goal, by_task, or related_to',
          },
          item_id: {
            type: 'string',
            description: 'ID of a specific item to retrieve (for by_id queries)',
          },
          item_type: {
            type: 'string',
            description: 'Type of items to retrieve (for by_type queries): user_request, goal, task, agent_output, judgement, user_query_request, or user_response',
          },
          goal_id: {
            type: 'string',
            description: 'Goal ID to get related items for (for by_goal queries)',
          },
          task_id: {
            type: 'string',
            description: 'Task ID to get related items for (for by_task queries)',
          },
          parent_id: {
            type: 'string',
            description: 'Parent item ID to get children for (for related_to queries)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of items to return (default: 10)',
          },
        },
        required: ['query_type'],
      },
    };
  }

  async execute(parameters: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const { query_type, item_id, item_type, goal_id, task_id, parent_id, limit = 10 } = parameters;

      let items: any[] = [];

      switch (query_type) {
        case 'by_id':
          if (!item_id) {
            return this.createErrorResult('item_id is required for by_id queries');
          }
          const item = await blackboardService.findById(item_id);
          if (item) {
            items = [this.formatItemForAgent(item)];
          }
          break;

        case 'by_type':
          if (!item_type) {
            return this.createErrorResult('item_type is required for by_type queries');
          }
          const typeItems = await blackboardService.findByType(item_type as any);
          items = typeItems.slice(0, limit).map(item => this.formatItemForAgent(item));
          break;

        case 'by_goal':
          if (!goal_id) {
            return this.createErrorResult('goal_id is required for by_goal queries');
          }
          const goalItems = await blackboardService.findChildren(goal_id);
          items = goalItems.slice(0, limit).map(item => this.formatItemForAgent(item));
          break;

        case 'by_task':
          if (!task_id) {
            return this.createErrorResult('task_id is required for by_task queries');
          }
          const taskItems = await blackboardService.findChildren(task_id);
          items = taskItems.slice(0, limit).map(item => this.formatItemForAgent(item));
          break;

        case 'related_to':
          if (!parent_id) {
            return this.createErrorResult('parent_id is required for related_to queries');
          }
          const relatedItems = await blackboardService.findChildren(parent_id);
          items = relatedItems.slice(0, limit).map(item => this.formatItemForAgent(item));
          break;

        default:
          return this.createErrorResult(`Unknown query_type: ${query_type}`);
      }

      return this.createSuccessResult({
        items,
        count: items.length,
      });
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error querying blackboard'
      );
    }
  }

  private formatItemForAgent(item: any): any {
    // Format item in the same way agents see it on the blackboard view
    return {
      id: item.id,
      type: item.type,
      summary: item.summary,
      created_at: item.created_at,
      updated_at: item.updated_at,
      dimensions: item.dimensions || {},
      metadata: {
        agent_id: item.dimensions?.agent_id,
        model_id: item.dimensions?.model_id,
        goal_id: item.dimensions?.goal_id || item.links?.parents?.[0],
        task_id: item.dimensions?.task_id,
        status: item.dimensions?.status,
        priority: item.dimensions?.priority,
      },
      // Include a preview of the detail content if available
      content_preview: item.detail?.content 
        ? String(item.detail.content).substring(0, 500) 
        : undefined,
    };
  }
}

