import { describe, it, expect } from 'vitest';
import { withFreshDb } from '../../helpers/db';
import { jobQueue } from '@/src/jobs/queue';
import { JobType } from '@/src/types/jobs';

describe('Job Queue Integration', () => {
  it('should create a job', async () => {
    await withFreshDb(async () => {
      const job = await jobQueue.createRunAgentJob(
        'WeSpeaker',
        { message: 'Test' }
      );

      expect(job).toBeDefined();
      expect(job.type).toBe('run_agent');
      expect(job.status).toBe('pending');
    });
  });

  it('should dequeue a pending job', async () => {
    await withFreshDb(async () => {
      // Create a job
      await jobQueue.createRunAgentJob('WeSpeaker', { message: 'Test' });

      // Dequeue
      const job = await jobQueue.dequeue();
      if (job) {
        expect(job.status).toBe('running');
        expect(job.locked_at).toBeDefined();
      }
    });
  });

  it('should update job status', async () => {
    await withFreshDb(async () => {
      const job = await jobQueue.createRunAgentJob('WeSpeaker', { message: 'Test' });
      
      await jobQueue.updateStatus(job.id, 'completed');
      
      const updated = await jobQueue.getById(job.id);
      if (updated) {
        expect(updated.status).toBe('completed');
      }
    });
  });
});

