import { Job, JobType, JobStatus, RunAgentJobPayload } from '@/src/types/jobs';
import { jobsRepository } from '@/src/db/repositories/jobs.repository';
import { randomUUID } from 'crypto';

export class JobQueue {
  async createJob(
    type: JobType,
    payload: Record<string, any>,
    scheduledFor?: Date,
    maxAttempts?: number
  ): Promise<Job> {
    const row = await jobsRepository.create({
      type,
      payload,
      scheduled_for: scheduledFor || new Date(),
      max_attempts: maxAttempts || 3,
    });

    return this.mapRowToJob(row);
  }

  async createRunAgentJob(
    agentId: string,
    context: Record<string, any>,
    options?: { temperature?: number; maxTokens?: number },
    scheduledFor?: Date
  ): Promise<Job> {
    const payload: RunAgentJobPayload = {
      agent_id: agentId,
      context,
      options,
    };

    return this.createJob('run_agent', payload, scheduledFor);
  }

  async getPendingJobs(limit: number = 10): Promise<Job[]> {
    const rows = await jobsRepository.findPending(limit);
    return rows.map((row) => this.mapRowToJob(row));
  }

  async getJobById(id: string): Promise<Job | null> {
    const row = await jobsRepository.findById(id);
    return row ? this.mapRowToJob(row) : null;
  }

  async lockJob(jobId: string, lockedBy: string): Promise<Job | null> {
    const row = await jobsRepository.lock(jobId, lockedBy);
    return row ? this.mapRowToJob(row) : null;
  }

  async completeJob(jobId: string): Promise<Job | null> {
    const row = await jobsRepository.complete(jobId);
    return row ? this.mapRowToJob(row) : null;
  }

  async failJob(jobId: string, permanent: boolean = false): Promise<Job | null> {
    const row = await jobsRepository.fail(jobId, !permanent);
    return row ? this.mapRowToJob(row) : null;
  }

  async unlockJob(jobId: string): Promise<void> {
    await jobsRepository.unlock(jobId);
  }

  private mapRowToJob(row: any): Job {
    return {
      id: row.id,
      type: row.type as JobType,
      payload: row.payload,
      status: row.status as JobStatus,
      attempts: row.attempts,
      max_attempts: row.max_attempts,
      scheduled_for: row.scheduled_for,
      locked_at: row.locked_at,
      locked_by: row.locked_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const jobQueue = new JobQueue();

