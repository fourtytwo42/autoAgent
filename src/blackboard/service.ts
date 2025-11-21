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
    const outputItem = await this.create({
      type: 'agent_output',
      summary: `Output from ${agentId}`,
      dimensions: {
        agent_id: agentId,
        model_id: modelId,
        status: 'completed',
        ...metadata,
      },
      links: { parents: [taskId] },
      detail: {
        content: output,
      },
    });

    await this.addLink(taskId, outputItem.id, 'child');

    return outputItem;
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

