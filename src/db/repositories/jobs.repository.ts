import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import { Job, JobRow, JobType, JobStatus } from '@/src/types/jobs';
import { randomUUID } from 'crypto';

export class JobsRepository {
  constructor(private pool: Pool = getDatabasePool()) {}

  async create(job: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'status' | 'attempts' | 'locked_at' | 'locked_by'>): Promise<JobRow> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.pool.query<JobRow>(
      `INSERT INTO jobs (
        id, type, payload, status, attempts, max_attempts,
        scheduled_for, locked_at, locked_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        job.type,
        JSON.stringify(job.payload || {}),
        'pending',
        0,
        job.max_attempts || 3,
        job.scheduled_for || now,
        null,
        null,
        now,
        now,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<JobRow | null> {
    const result = await this.pool.query<JobRow>(
      'SELECT * FROM jobs WHERE id = $1',
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findPending(limit: number = 10): Promise<JobRow[]> {
    const result = await this.pool.query<JobRow>(
      `SELECT * FROM jobs
       WHERE status = 'pending'
         AND scheduled_for <= now()
         AND (locked_at IS NULL OR locked_at < now() - INTERVAL '5 minutes')
       ORDER BY scheduled_for ASC, created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async findByStatus(status: JobStatus): Promise<JobRow[]> {
    const result = await this.pool.query<JobRow>(
      'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async lock(jobId: string, lockedBy: string): Promise<JobRow | null> {
    const result = await this.pool.query<JobRow>(
      `UPDATE jobs
       SET status = 'running',
           locked_at = now(),
           locked_by = $2,
           updated_at = now()
       WHERE id = $1
         AND status = 'pending'
         AND (locked_at IS NULL OR locked_at < now() - INTERVAL '5 minutes')
       RETURNING *`,
      [jobId, lockedBy]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async complete(jobId: string): Promise<JobRow | null> {
    const result = await this.pool.query<JobRow>(
      `UPDATE jobs
       SET status = 'completed',
           locked_at = null,
           locked_by = null,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [jobId]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async fail(jobId: string, incrementAttempts: boolean = true): Promise<JobRow | null> {
    if (incrementAttempts) {
      const job = await this.findById(jobId);
      if (job && job.attempts >= job.max_attempts) {
        // Mark as failed permanently
        const result = await this.pool.query<JobRow>(
          `UPDATE jobs
           SET status = 'failed',
               locked_at = null,
               locked_by = null,
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [jobId]
        );

        return result.rows[0] ? this.mapRow(result.rows[0]) : null;
      } else {
        // Increment attempts and reschedule
        const result = await this.pool.query<JobRow>(
          `UPDATE jobs
           SET status = 'pending',
               attempts = attempts + 1,
               scheduled_for = now() + (INTERVAL '1 second' * POWER(2, attempts)),
               locked_at = null,
               locked_by = null,
               updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [jobId]
        );

        return result.rows[0] ? this.mapRow(result.rows[0]) : null;
      }
    } else {
      const result = await this.pool.query<JobRow>(
        `UPDATE jobs
         SET status = 'failed',
             locked_at = null,
             locked_by = null,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [jobId]
      );

      return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    }
  }

  async unlock(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE jobs
       SET locked_at = null,
           locked_by = null,
           updated_at = now()
       WHERE id = $1`,
      [jobId]
    );
  }

  async delete(jobId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);

    return result.rowCount ? result.rowCount > 0 : false;
  }

  private mapRow(row: any): JobRow {
    return {
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    };
  }
}

export const jobsRepository = new JobsRepository();

