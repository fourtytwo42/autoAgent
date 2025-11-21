import { Job, JobType } from '@/src/types/jobs';
import { jobQueue } from './queue';
import { BaseJobProcessor } from './processors/base.processor';
import { RunAgentProcessor } from './processors/runAgent.processor';
import { env } from '@/src/config/env';
import { randomUUID } from 'crypto';

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

    // Process immediately
    this.processJobs();

    // Then process at interval
    this.intervalId = setInterval(() => {
      this.processJobs();
    }, intervalMs);
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
      console.error(`No processor found for job type: ${job.type}`);
      await jobQueue.failJob(job.id, true); // Permanent failure
      return;
    }

    try {
      await processor.process(lockedJob);
      await jobQueue.completeJob(job.id);
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      
      // Processor failed - let job queue handle retries
      if (job.attempts >= job.max_attempts) {
        await jobQueue.failJob(job.id, true); // Permanent failure
      } else {
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

