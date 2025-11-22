import { Job, JobType } from '@/src/types/jobs';
import { jobQueue } from './queue';
import { BaseJobProcessor } from './processors/base.processor';
import { RunAgentProcessor } from './processors/runAgent.processor';
import { env } from '@/src/config/env';
import { randomUUID } from 'crypto';
import { taskManager } from '@/src/orchestrator/taskManager';
import { cleanupStuckJobs } from './processors/taskCleanup';
import { blackboardService } from '@/src/blackboard/service';

export class JobScheduler {
  private processors: Map<JobType, BaseJobProcessor> = new Map();
  private isRunning: boolean = false;
  private workerId: string;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.workerId = randomUUID();
    this.registerProcessors();
  }

  private registerProcessors(): void {
    this.processors.set('run_agent', new RunAgentProcessor());
    // Add more processors as needed
  }

  start(intervalMs: number = 5000): void {
    if (this.isRunning) {
      console.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Job scheduler started (worker: ${this.workerId})`);

    // Process immediately (with error handling for build phase)
    this.processJobs().catch((error) => {
      if (error instanceof Error && error.message.includes('build phase')) {
        // Silently skip during build phase
        return;
      }
      console.error('Error in scheduler loop:', error);
    });
    this.processPendingTasks().catch((error) => {
      if (error instanceof Error && error.message.includes('build phase')) {
        // Silently skip during build phase
        return;
      }
      console.error('Error processing pending tasks:', error);
    });

    // Then process at interval
    this.intervalId = setInterval(() => {
      this.processJobs().catch((error) => {
        if (error instanceof Error && error.message.includes('build phase')) {
          // Silently skip during build phase
          return;
        }
        console.error('Error in scheduler loop:', error);
      });
      this.processPendingTasks().catch((error) => {
        if (error instanceof Error && error.message.includes('build phase')) {
          // Silently skip during build phase
          return;
        }
        console.error('Error processing pending tasks:', error);
      });
    }, intervalMs);
  }

  private async processPendingTasks(): Promise<void> {
    try {
      const pendingTasks = await taskManager.getPendingTasks();
      
      if (pendingTasks.length > 0) {
        console.log(`[Scheduler] Found ${pendingTasks.length} pending tasks, attempting to assign agents...`);
      }
      
      // Process all pending tasks in parallel (up to 20 to avoid overload)
      // Process them in parallel to respect dependencies, each task checks its own dependencies
      // Sort by priority: high first, then medium, then low
      const sortedTasks = pendingTasks
        .filter(task => task.dimensions?.status !== 'completed' && task.dimensions?.status !== 'assigned' && task.dimensions?.status !== 'working')
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const aPriority = priorityOrder[a.dimensions?.priority as keyof typeof priorityOrder] ?? 1;
          const bPriority = priorityOrder[b.dimensions?.priority as keyof typeof priorityOrder] ?? 1;
          return aPriority - bPriority;
        })
        .slice(0, 20); // Process up to 20 tasks per cycle
      
      if (sortedTasks.length > 0) {
        console.log(`[Scheduler] Processing ${sortedTasks.length} pending tasks (prioritized by priority level)...`);
      }
      
      const taskPromises = sortedTasks.map(async (task) => {
        try {
          // Each task's assignAgentToTask checks its own dependencies
          // So we can safely process multiple tasks in parallel
          const result = await taskManager.assignAgentToTask(task.id);
          if (result) {
            console.log(`[Scheduler] Successfully assigned agent(s) to task ${task.id}: ${task.summary.substring(0, 50)}...`);
          } else {
            console.log(`[Scheduler] Task ${task.id} not assigned (dependencies not met or no agents available): ${task.summary.substring(0, 50)}...`);
          }
        } catch (error) {
          console.error(`[Scheduler] Error assigning agent to task ${task.id}:`, error);
        }
      });
      
      // Process pending tasks in parallel
      await Promise.allSettled(taskPromises);
      
      // Also check tasks that might have outputs but aren't marked as completed
      // This handles cases where assigned_agents wasn't set but outputs exist
      const { checkTaskCompletion } = await import('./processors/taskCompletion');
      
      // Check assigned tasks - retry stuck ones
      const assignedTasks = await blackboardService.query({
        type: 'task',
        dimensions: { status: 'assigned' },
        limit: 20,
      });
      
      // Check for stuck assigned tasks (assigned > 5 minutes with no outputs or jobs)
      const now = Date.now();
      const STUCK_ASSIGNED_THRESHOLD = 5 * 60 * 1000; // 5 minutes
      
      const stuckAssignedTasks = await Promise.all(
        assignedTasks.map(async (task) => {
          const updatedAge = task.updated_at ? now - new Date(task.updated_at).getTime() : Date.now() - new Date(task.created_at || 0).getTime();
          
          // Check if task has outputs
          const taskOutputs = await blackboardService.query({
            type: 'agent_output',
            parent_id: task.id,
          });
          
          // Check if there are pending jobs for this task
          const { jobQueue } = await import('./queue');
          const pendingJobs = await jobQueue.getPendingJobs(100);
          const taskJobs = pendingJobs.filter(job => {
            const payload = job.payload as any;
            return payload?.task_id === task.id;
          });
          
          // Task is stuck if: assigned > 5 min, no outputs, no pending jobs
          const isStuck = (updatedAge > STUCK_ASSIGNED_THRESHOLD) && taskOutputs.length === 0 && taskJobs.length === 0;
          
          return isStuck ? task : null;
        })
      );
      
      const stuckTasks = stuckAssignedTasks.filter(Boolean);
      if (stuckTasks.length > 0) {
        console.log(`[Scheduler] Found ${stuckTasks.length} stuck assigned tasks, retrying assignment...`);
        const retryPromises = stuckTasks.map(async (task) => {
          if (!task) return;
          try {
            console.log(`[Scheduler] Retrying assignment for stuck task ${task.id}: ${task.summary.substring(0, 50)}...`);
            await taskManager.assignAgentToTask(task.id);
          } catch (error) {
            console.error(`[Scheduler] Error retrying stuck task ${task.id}:`, error);
          }
        });
        await Promise.allSettled(retryPromises);
      }
      
      // Check working tasks
      const workingTasks = await blackboardService.query({
        type: 'task',
        dimensions: { status: 'working' },
        limit: 20,
      });
      
      const tasksToCheck = [...assignedTasks, ...workingTasks];
      
      // Check task completion in parallel
      const completionPromises = tasksToCheck.map(async (task) => {
        try {
          // Re-check completion in case outputs exist but task wasn't marked complete
          await checkTaskCompletion(task.id);
        } catch (error) {
          console.error(`[Scheduler] Error checking completion for task ${task.id}:`, error);
        }
      });
      
      await Promise.allSettled(completionPromises);
      
      // Also periodically check all goals to see if all tasks are complete
      // This ensures WeSpeaker is triggered even if a task completion check was missed
      // Also retry stuck tasks and trigger WeSpeaker if most tasks are done
      // Only check every 10th cycle to avoid too much overhead (roughly every 50 seconds)
      if (Math.random() < 0.1) {
        const openGoals = await blackboardService.query({
          type: 'goal',
          dimensions: { status: 'open' },
          limit: 10,
        });
        
        for (const goal of openGoals) {
          const allTasks = await blackboardService.findChildren(goal.id);
          const taskItems = allTasks.filter(t => t.type === 'task');
          
          if (taskItems.length > 0) {
            const completedTasks = taskItems.filter(t => t.dimensions?.status === 'completed');
            const allTasksComplete = completedTasks.length === taskItems.length;
            
            // If most tasks are complete (>80%), retry incomplete ones and potentially trigger WeSpeaker
            const completionRatio = completedTasks.length / taskItems.length;
            const shouldRetryIncomplete = completionRatio >= 0.8 && !allTasksComplete;
            
            if (shouldRetryIncomplete) {
              console.log(`[Scheduler] Goal ${goal.id} has ${completedTasks.length}/${taskItems.length} tasks complete (${Math.round(completionRatio * 100)}%), retrying incomplete tasks...`);
              
              const incompleteTasks = taskItems.filter(t => 
                t.dimensions?.status !== 'completed' && 
                (t.dimensions?.status === 'assigned' || t.dimensions?.status === 'working')
              );
              
              const now = Date.now();
              const STUCK_TASK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
              
              for (const task of incompleteTasks) {
                const updatedAge = task.updated_at ? now - new Date(task.updated_at).getTime() : Date.now() - new Date(task.created_at || 0).getTime();
                const taskOutputs = await blackboardService.query({
                  type: 'agent_output',
                  parent_id: task.id,
                });
                
                const isStuck = (updatedAge > STUCK_TASK_THRESHOLD) && taskOutputs.length === 0;
                
                if (isStuck) {
                  console.log(`[Scheduler] Retrying stuck task ${task.id} for goal ${goal.id}...`);
                  try {
                    const { taskManager } = await import('@/src/orchestrator/taskManager');
                    await taskManager.assignAgentToTask(task.id);
                  } catch (error) {
                    console.error(`[Scheduler] Error retrying task ${task.id}:`, error);
                  }
                }
              }
            }
            
            if (allTasksComplete) {
              console.log(`[Scheduler] All tasks complete for goal ${goal.id}, triggering WeSpeaker`);
              const { triggerWeSpeakerForGoal } = await import('./processors/taskCompletion');
              // Use the last completed task ID (or first task if we can't determine)
              const lastTaskId = taskItems[taskItems.length - 1]?.id || taskItems[0]?.id;
              if (lastTaskId) {
                await triggerWeSpeakerForGoal(goal.id, lastTaskId);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing pending tasks:', error);
    }
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('Job scheduler stopped');
  }

  private async processJobs(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const pendingJobs = await jobQueue.getPendingJobs(env.MAX_CONCURRENT_JOBS || 5);
      
      if (pendingJobs.length > 0) {
        console.log(`[Scheduler] Processing ${pendingJobs.length} pending jobs`);
      }

      // Process jobs in parallel (up to max concurrent)
      const promises = pendingJobs.map((job) => this.processJob(job));
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error in scheduler loop:', error);
    }
  }

  private async processJob(job: Job): Promise<void> {
    // Try to lock the job
    const lockedJob = await jobQueue.lockJob(job.id, this.workerId);

    if (!lockedJob) {
      // Job was already locked by another worker or no longer pending
      return;
    }

    const processor = this.processors.get(job.type);

    if (!processor) {
      console.error(`[Scheduler] No processor found for job type: ${job.type}`);
      await jobQueue.failJob(job.id, true); // Permanent failure
      return;
    }

    const payload = job.payload as any;
    const agentId = payload?.agent_id || 'unknown';
    console.log(`[Scheduler] Processing job ${job.id} for agent ${agentId}`);

    try {
      await processor.process(lockedJob);
      await jobQueue.completeJob(job.id);
      console.log(`[Scheduler] Completed job ${job.id} for agent ${agentId}`);
    } catch (error) {
      console.error(`[Scheduler] Error processing job ${job.id} for agent ${agentId}:`, error);
      
      // Processor failed - let job queue handle retries
      if (job.attempts >= job.max_attempts) {
        console.error(`[Scheduler] Job ${job.id} exceeded max attempts, marking as permanently failed`);
        await jobQueue.failJob(job.id, true); // Permanent failure
      } else {
        console.log(`[Scheduler] Job ${job.id} will retry (attempt ${job.attempts + 1}/${job.max_attempts})`);
        await jobQueue.failJob(job.id, false); // Retry
      }
    }
  }

  async processJobImmediately(jobId: string): Promise<void> {
    const job = await jobQueue.getJobById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await this.processJob(job);
  }
}

export const jobScheduler = new JobScheduler();

