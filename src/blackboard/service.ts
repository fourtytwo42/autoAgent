import { BlackboardItem, BlackboardItemType, BlackboardQuery } from '@/src/types/blackboard';
import { blackboardRepository } from '@/src/db/repositories/blackboard.repository';
import { randomUUID } from 'crypto';

export class BlackboardService {
  async create(item: Omit<BlackboardItem, 'id' | 'created_at' | 'updated_at'>): Promise<BlackboardItem> {
    const row = await blackboardRepository.create(item);
    return this.mapRowToItem(row);
  }

  async findById(id: string): Promise<BlackboardItem | null> {
    const row = await blackboardRepository.findById(id);
    return row ? this.mapRowToItem(row) : null;
  }

  async query(query: BlackboardQuery): Promise<BlackboardItem[]> {
    const rows = await blackboardRepository.query(query);
    return rows.map((row) => this.mapRowToItem(row));
  }

  async findByType(type: BlackboardItemType): Promise<BlackboardItem[]> {
    return this.query({ type });
  }

  async findChildren(parentId: string): Promise<BlackboardItem[]> {
    return this.query({ parent_id: parentId });
  }

  async findParents(childId: string): Promise<BlackboardItem[]> {
    const child = await this.findById(childId);
    if (!child || !child.links.parents) {
      return [];
    }

    const parentItems = await Promise.all(
      child.links.parents.map((parentId) => this.findById(parentId))
    );

    return parentItems.filter((item): item is BlackboardItem => item !== null);
  }

  async update(id: string, updates: Partial<Omit<BlackboardItem, 'id' | 'created_at' | 'updated_at'>>): Promise<BlackboardItem | null> {
    const row = await blackboardRepository.update(id, updates);
    return row ? this.mapRowToItem(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    return blackboardRepository.delete(id);
  }

  async addLink(fromId: string, toId: string, relation: 'parent' | 'child' | 'related'): Promise<boolean> {
    return blackboardRepository.addLink(fromId, toId, relation);
  }

  async removeLink(fromId: string, toId: string, relation: 'parent' | 'child' | 'related'): Promise<boolean> {
    return blackboardRepository.removeLink(fromId, toId, relation);
  }

  async createUserRequest(content: string, metadata?: Record<string, any>): Promise<BlackboardItem> {
    return this.create({
      type: 'user_request',
      summary: content,
      dimensions: {
        status: 'pending',
        ...metadata,
      },
      links: {},
    });
  }

  async createGoal(summary: string, parentId?: string, metadata?: Record<string, any>): Promise<BlackboardItem> {
    const goal = await this.create({
      type: 'goal',
      summary,
      dimensions: {
        status: 'open',
        priority: 'medium',
        ...metadata,
      },
      links: parentId ? { parents: [parentId] } : {},
    });

    if (parentId) {
      await this.addLink(parentId, goal.id, 'child');
    }

    return goal;
  }

  async createTask(summary: string, goalId: string, metadata?: Record<string, any>): Promise<BlackboardItem> {
    const task = await this.create({
      type: 'task',
      summary,
      dimensions: {
        status: 'pending',
        assigned_agent: null,
        ...metadata,
      },
      links: { parents: [goalId] },
    });

    await this.addLink(goalId, task.id, 'child');

    return task;
  }

  async createAgentOutput(
    agentId: string,
    modelId: string,
    taskId: string,
    output: string,
    metadata?: Record<string, any>
  ): Promise<BlackboardItem> {
    // Use summary from metadata if available (from worker's JSON output), otherwise use default
    // Validate that summary is readable text, not raw JSON, and is concise (not full output)
    let summary = `Output from ${agentId}`;
    if (metadata?.summary && typeof metadata.summary === 'string' && metadata.summary.trim().length > 0) {
      const summaryText = metadata.summary.trim();
      // Reject if it looks like raw JSON (starts with { or [)
      // Also reject if it's too long (likely full output, not a summary)
      if (!summaryText.startsWith('{') && 
          !summaryText.startsWith('[') && 
          summaryText.length > 10 && 
          summaryText.length < 200) { // Max 200 chars for a summary
        summary = summaryText;
      } else {
        // Summary is invalid (JSON or too long) - will create concise one below
        console.warn(`[BlackboardService] Summary invalid (JSON or too long), creating concise one`);
      }
    }
    
    // If still using default and we have output content, create a concise summary
    if (summary === `Output from ${agentId}` && output && output.length > 20) {
      // Create a concise summary, not just truncate the output
      let contentSummary = '';
      
      // Try to extract readable text from output (skip if it's raw JSON)
      let outputText = output.trim();
      if (outputText.startsWith('{') || outputText.startsWith('[')) {
        try {
          const parsed = JSON.parse(outputText.substring(0, 500));
          // Try common fields
          if (parsed.content) outputText = parsed.content;
          else if (parsed.response) outputText = parsed.response;
          else if (parsed.text) outputText = parsed.text;
          else if (parsed.message) outputText = parsed.message;
          else if (parsed.query) {
            contentSummary = `Completed: ${parsed.query}`;
          } else {
            contentSummary = `Completed task by ${agentId}`;
          }
        } catch (e) {
          contentSummary = `Completed task by ${agentId}`;
        }
      }
      
      // If we have outputText, create a concise summary (first sentence or 80 chars)
      if (!contentSummary && outputText && outputText.length > 10 && !outputText.startsWith('{') && !outputText.startsWith('[')) {
        // Try to find first sentence
        const firstSentence = outputText.split(/[.!?\n]/)[0];
        if (firstSentence && firstSentence.length > 15 && firstSentence.length < 150) {
          contentSummary = firstSentence.trim();
        } else {
          // Use first 80 chars, but try to break at word boundary
          const truncated = outputText.substring(0, 80);
          const lastSpace = truncated.lastIndexOf(' ');
          contentSummary = lastSpace > 40 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
        }
      }
      
      // Use the concise summary if we created one
      if (contentSummary && contentSummary.length > 10 && contentSummary.length < 200) {
        summary = contentSummary;
      }
    }
    
    const outputItem = await this.create({
      type: 'agent_output',
      summary: summary,
      dimensions: {
        agent_id: agentId,
        model_id: modelId,
        status: 'completed',
        ...metadata,
      },
      links: { parents: [taskId] },
      detail: {
        content: output,
        latency_ms: metadata?.latency_ms, // Include latency for model evaluator
      },
    });

    await this.addLink(taskId, outputItem.id, 'child');

    return outputItem;
  }

  /**
   * Get blackboard context in card format for agents
   * This provides the same view agents see on the blackboard view page
   */
  async getContextForAgent(goalId?: string, taskId?: string): Promise<string> {
    const contextItems: string[] = [];

    if (goalId) {
      // Get goal
      const goal = await this.findById(goalId);
      if (goal) {
        contextItems.push(this.formatItemAsCard(goal));
      }

      // Get user request if linked
      if (goal?.links?.parents) {
        for (const parentId of goal.links.parents) {
          const parent = await this.findById(parentId);
          if (parent && parent.type === 'user_request') {
            contextItems.unshift(this.formatItemAsCard(parent)); // Put user request first
          }
        }
      }

      // Get tasks for this goal
      const tasks = await this.findChildren(goalId);
      const taskItems = tasks.filter(t => t.type === 'task');
      for (const task of taskItems) {
        contextItems.push(this.formatItemAsCard(task));

        // Get agent outputs for this task
        const outputs = await this.findChildren(task.id);
        const outputItems = outputs.filter(o => o.type === 'agent_output');
        for (const output of outputItems) {
          contextItems.push(this.formatItemAsCard(output));
        }
      }

      // Get WeSpeaker outputs for this goal
      const allOutputs = await this.query({ type: 'agent_output', parent_id: goalId });
      const wespeakerOutputs = allOutputs.filter(o => o.dimensions?.agent_id === 'WeSpeaker');
      for (const output of wespeakerOutputs) {
        contextItems.push(this.formatItemAsCard(output));
      }
    } else if (taskId) {
      // Get task
      const task = await this.findById(taskId);
      if (task) {
        contextItems.push(this.formatItemAsCard(task));

        // Get goal
        if (task.links?.parents) {
          for (const parentId of task.links.parents) {
            const parent = await this.findById(parentId);
            if (parent && parent.type === 'goal') {
              contextItems.unshift(this.formatItemAsCard(parent));
            }
          }
        }

        // Get agent outputs for this task
        const outputs = await this.findChildren(taskId);
        const outputItems = outputs.filter(o => o.type === 'agent_output');
        for (const output of outputItems) {
          contextItems.push(this.formatItemAsCard(output));
        }
      }
    }

    return contextItems.join('\n\n');
  }

  /**
   * Format a blackboard item as a card (same format as blackboard view)
   */
  private formatItemAsCard(item: BlackboardItem): string {
    const lines: string[] = [];
    
    lines.push(`[${item.type.toUpperCase()}] ${item.summary}`);
    lines.push(`ID: ${item.id}`);
    
    if (item.created_at) {
      lines.push(`Created: ${new Date(item.created_at).toLocaleString()}`);
    }
    
    if (item.dimensions) {
      const metadata: string[] = [];
      if (item.dimensions.agent_id) metadata.push(`Agent: ${item.dimensions.agent_id}`);
      if (item.dimensions.model_id) metadata.push(`Model: ${item.dimensions.model_id}`);
      if (item.dimensions.goal_id) metadata.push(`Goal ID: ${item.dimensions.goal_id}`);
      if (item.dimensions.task_id) metadata.push(`Task ID: ${item.dimensions.task_id}`);
      if (item.dimensions.status) metadata.push(`Status: ${item.dimensions.status}`);
      if (item.dimensions.priority) metadata.push(`Priority: ${item.dimensions.priority}`);
      if (metadata.length > 0) {
        lines.push(`Metadata: ${metadata.join(', ')}`);
      }
    }

    // Include summary from detail if available (from Summarizer)
    if (item.detail?.content && item.summary !== `Output from ${item.dimensions?.agent_id}`) {
      const contentPreview = String(item.detail.content).substring(0, 300);
      lines.push(`Summary: ${contentPreview}${String(item.detail.content).length > 300 ? '...' : ''}`);
    }

    return lines.join('\n');
  }

  private mapRowToItem(row: any): BlackboardItem {
    return {
      id: row.id,
      type: row.type,
      summary: row.summary,
      dimensions: row.dimensions,
      links: row.links,
      detail: row.detail,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const blackboardService = new BlackboardService();

