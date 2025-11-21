import { BlackboardItem } from '@/src/types/blackboard';
import { blackboardService } from '@/src/blackboard/service';
import { agentRegistry } from '@/src/agents/registry';
import { interestMatcher } from '@/src/agents/matcher';
import { jobQueue } from '@/src/jobs/queue';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { jobScheduler } from '@/src/jobs/scheduler';

export class TaskManager {
  async createTask(
    summary: string,
    goalId: string,
    metadata?: Record<string, any>,
    options?: { autoAssign?: boolean }
  ): Promise<BlackboardItem> {
    const task = await blackboardService.createTask(summary, goalId, metadata);

    const autoAssign = options?.autoAssign ?? true;

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
    if (autoAssign) {
      await this.assignAgentToTask(task.id);
    }

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

  async canTaskStart(taskId: string): Promise<boolean> {
    // Check if all dependencies are completed
    const task = await blackboardService.findById(taskId);
    if (!task || task.type !== 'task') {
      return false;
    }

    const dependencies = task.dimensions?.dependencies;
    if (!dependencies || !Array.isArray(dependencies) || dependencies.length === 0) {
      return true; // No dependencies, can start
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validDependencies = dependencies.filter((dep): dep is string => typeof dep === 'string' && uuidRegex.test(dep));

    // If there were invalid dependency entries (legacy data), ignore them
    if (validDependencies.length === 0) {
      return true;
    }

    // Check if all dependency tasks are completed
    for (const depTaskId of validDependencies) {
      const depTask = await blackboardService.findById(depTaskId);
      if (!depTask || depTask.type !== 'task') {
        return false; // Dependency not found
      }
      
      const depStatus = depTask.dimensions?.status;
      if (depStatus !== 'completed') {
        return false; // Dependency not completed
      }
    }

    return true; // All dependencies completed
  }

  async assignAgentToTask(taskId: string): Promise<boolean> {
    // Check if task can start (dependencies met)
    const canStart = await this.canTaskStart(taskId);
    if (!canStart) {
      // Task has unmet dependencies, don't assign yet
      return false;
    }

    const task = await blackboardService.findById(taskId);
    if (!task || task.type !== 'task') {
      return false;
    }
    
    // Don't assign agents to already completed tasks
    if (task.dimensions?.status === 'completed') {
      console.log(`[TaskManager] Task ${taskId} is already completed, skipping assignment`);
      return false;
    }

    // Get how many agents should work on this task
    const agentCount = task.dimensions?.agent_count || 1;
    const taskType = task.dimensions?.task_type || 'general';

    // Get enabled agents
    const agents = await agentRegistry.getEnabledAgents();

    // Find matching agents - prefer specialized workers for task type
    const matches = interestMatcher.match(agents, task);
    
    // Filter by task type affinity if we have specialized workers
    let selectedAgents = matches;
    if (taskType !== 'general') {
      // Prefer specialized workers (ResearchWorker, WritingWorker, AnalysisWorker)
      const specialized = matches.filter(m => 
        m.agent.id.toLowerCase().includes(taskType) || 
        m.agent.id === 'ResearchWorker' && taskType === 'research' ||
        m.agent.id === 'WritingWorker' && taskType === 'writing' ||
        m.agent.id === 'AnalysisWorker' && taskType === 'analysis'
      );
      if (specialized.length > 0) {
        selectedAgents = specialized;
      }
    }

    if (selectedAgents.length === 0) {
      return false;
    }

    // Select up to agentCount agents (or all available if fewer)
    const agentsToAssign = selectedAgents.slice(0, Math.min(agentCount, selectedAgents.length));
    const assignedAgentIds: string[] = [];

    // Assign each agent to the task
    for (const match of agentsToAssign) {
      const webEnabled = task.dimensions?.web_enabled ?? false;
      // Create job to run agent
      const job = await jobQueue.createRunAgentJob(
        match.agent.id,
        {
          task_id: taskId,
          goal_id: task.links.parents?.[0],
          task_summary: task.summary,
          task_type: taskType,
          web_enabled: webEnabled,
        },
        {
          temperature: 0.7,
          maxTokens: 20000,
        }
      );

      console.log(`[TaskManager] Created job ${job.id} for agent ${match.agent.id} on task ${taskId}: ${task.summary.substring(0, 50)}`);
      console.log(`[TaskManager] Job status: ${job.status}, scheduled_for: ${job.scheduled_for}`);
      
      // Try to process the job immediately if scheduler is running
      try {
        await jobScheduler.processJobImmediately(job.id);
        console.log(`[TaskManager] Job ${job.id} processed immediately`);
      } catch (error) {
        console.log(`[TaskManager] Job ${job.id} will be processed by scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      assignedAgentIds.push(match.agent.id);

      await eventsRepository.create({
        type: 'task_updated',
        blackboard_item_id: taskId,
        agent_id: match.agent.id,
        data: {
          assigned_agent: match.agent.id,
          status: 'assigned',
        },
      });
    }

    // Update task with assigned agents
    // Read fresh task to ensure we have current dimensions
    const freshTask = await blackboardService.findById(taskId);
    if (!freshTask) {
      console.error(`[TaskManager] Task ${taskId} not found when trying to update`);
      return false;
    }
    
    console.log(`[TaskManager] Updating task ${taskId} with assigned agents: ${assignedAgentIds.join(', ')}`);
    console.log(`[TaskManager] Current task dimensions before update: ${JSON.stringify(freshTask.dimensions)}`);
    
    // Don't overwrite completed status - only set to assigned if not already completed
    const currentStatus = freshTask.dimensions?.status;
    const newStatus = currentStatus === 'completed' ? 'completed' : 'assigned';
    
    const updated = await blackboardService.update(taskId, {
      dimensions: {
        ...(freshTask.dimensions || {}),
        assigned_agents: assignedAgentIds,
        assigned_agent: assignedAgentIds[0], // Keep first for backward compatibility
        status: newStatus,
        agent_count: agentsToAssign.length,
      },
    });
    
    if (updated) {
      console.log(`[TaskManager] Successfully updated task ${taskId} with status: assigned, agents: ${assignedAgentIds.join(', ')}`);
      console.log(`[TaskManager] Updated task dimensions: ${JSON.stringify(updated.dimensions)}`);
      
      // Verify the update persisted
      const verifyTask = await blackboardService.findById(taskId);
      if (verifyTask) {
        console.log(`[TaskManager] Verification - task ${taskId} dimensions after update: ${JSON.stringify(verifyTask.dimensions)}`);
      }
    } else {
      console.error(`[TaskManager] Failed to update task ${taskId}`);
    }

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

