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
      
      // Process up to 5 pending tasks per cycle (only if they're not completed)
      for (const task of pendingTasks.slice(0, 5)) {
        // Skip if task is already completed
        if (task.dimensions?.status === 'completed') {
          continue;
        }
        // Try to assign an agent to the task
        await taskManager.assignAgentToTask(task.id);
      }
      
      // Also check tasks that might have outputs but aren't marked as completed
      // This handles cases where assigned_agents wasn't set but outputs exist
      const { checkTaskCompletion } = await import('./processors/taskCompletion');
      
      // Check assigned tasks
      const assignedTasks = await blackboardService.query({
        type: 'task',
        dimensions: { status: 'assigned' },
        limit: 10,
      });
      
      // Check working tasks
      const workingTasks = await blackboardService.query({
        type: 'task',
        dimensions: { status: 'working' },
        limit: 10,
      });
      
      const tasksToCheck = [...assignedTasks, ...workingTasks];
      
      for (const task of tasksToCheck) {
        // Re-check completion in case outputs exist but task wasn't marked complete
        await checkTaskCompletion(task.id);
      }
      
      // Also periodically check all goals to see if all tasks are complete
      // This ensures WeSpeaker is triggered even if a task completion check was missed
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
            const allTasksComplete = taskItems.every(t => 
              t.dimensions?.status === 'completed'
            );
            
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

