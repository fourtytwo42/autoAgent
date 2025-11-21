import { Job, JobType } from '@/src/types/jobs';

export abstract class BaseJobProcessor {
  abstract type: JobType;

  abstract process(job: Job): Promise<void>;

  async handleError(job: Job, error: Error): Promise<void> {
    console.error(`Error processing job ${job.id} (${job.type}):`, error);
    // Error handling will be done by the scheduler
  }
}

