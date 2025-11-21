import { BlackboardItem } from '@/src/types/blackboard';
import { blackboardService } from '@/src/blackboard/service';
import { agentRegistry } from '@/src/agents/registry';
import { interestMatcher } from '@/src/agents/matcher';
import { jobQueue } from '@/src/jobs/queue';
import { eventsRepository } from '@/src/db/repositories/events.repository';

export class TaskManager {
  async createTask(summary: string, goalId: string, metadata?: Record<string, any>): Promise<BlackboardItem> {
    const task = await blackboardService.createTask(summary, goalId, metadata);

    await eventsRepository.create({
      type: 'task_created',
      blackboard_item_id: task.id,
      data: {
        goal_id: goalId,
        summary,
        metadata,
      },
    });

    // Try to assign agent to task
    await this.assignAgentToTask(task.id);

    return task;
  }

  async getTask(id: string): Promise<BlackboardItem | null> {
    return blackboardService.findById(id);
  }

  async getPendingTasks(): Promise<BlackboardItem[]> {
    return blackboardService.query({
      type: 'task',
      dimensions: { status: 'pending' },
    });
  }

  async assignAgentToTask(taskId: string): Promise<boolean> {
    const task = await blackboardService.findById(taskId);
    if (!task || task.type !== 'task') {
      return false;
    }

    // Get enabled agents
    const agents = await agentRegistry.getEnabledAgents();

    // Find matching agents
    const matches = interestMatcher.match(agents, task);

    if (matches.length === 0) {
      return false;
    }

    // Use the best match
    const bestMatch = matches[0];

    // Update task with assigned agent
    await blackboardService.update(taskId, {
      dimensions: {
        ...task.dimensions,
        assigned_agent: bestMatch.agent.id,
        status: 'assigned',
      },
    });

    // Create job to run agent
    await jobQueue.createRunAgentJob(
      bestMatch.agent.id,
      {
        task_id: taskId,
        goal_id: task.links.parents?.[0],
      },
      {
        temperature: 0.7,
        maxTokens: 2000,
      }
    );

    await eventsRepository.create({
      type: 'task_updated',
      blackboard_item_id: taskId,
      agent_id: bestMatch.agent.id,
      data: {
        assigned_agent: bestMatch.agent.id,
        status: 'assigned',
      },
    });

    return true;
  }

  async updateTaskStatus(taskId: string, status: string): Promise<BlackboardItem | null> {
    const task = await blackboardService.findById(taskId);
    if (!task) {
      return null;
    }

    const updated = await blackboardService.update(taskId, {
      dimensions: {
        ...task.dimensions,
        status,
      },
    });

    if (updated) {
      await eventsRepository.create({
        type: 'task_updated',
        blackboard_item_id: taskId,
        data: { status },
      });
    }

    return updated;
  }
}

export const taskManager = new TaskManager();

