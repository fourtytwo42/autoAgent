import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import { AgentMetrics, AgentMetricsRow } from '@/src/types/agents';

export class AgentMetricsRepository {
  private _pool: Pool | null = null;

  constructor(private pool?: Pool) {}

  private get poolInstance(): Pool {
    if (this.pool) {
      return this.pool;
    }
    if (!this._pool) {
      this._pool = getDatabasePool();
    }
    return this._pool;
  }

  async createOrUpdate(metrics: AgentMetrics): Promise<AgentMetricsRow> {
    const now = new Date();

    const result = await this.poolInstance.query<AgentMetricsRow>(
      `INSERT INTO agent_metrics (
        agent_id, usage_count, avg_score, avg_latency_ms, last_used_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (agent_id) DO UPDATE SET
        usage_count = EXCLUDED.usage_count,
        avg_score = EXCLUDED.avg_score,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        last_used_at = EXCLUDED.last_used_at,
        updated_at = EXCLUDED.updated_at
      RETURNING *`,
      [
        metrics.agent_id,
        metrics.usage_count,
        metrics.avg_score,
        metrics.avg_latency_ms,
        metrics.last_used_at,
        now,
        now,
      ]
    );

    return result.rows[0];
  }

  async findByAgentId(agentId: string): Promise<AgentMetricsRow | null> {
    const result = await this.poolInstance.query<AgentMetricsRow>(
      'SELECT * FROM agent_metrics WHERE agent_id = $1',
      [agentId]
    );

    return result.rows[0] || null;
  }

  async findAll(): Promise<AgentMetricsRow[]> {
    const result = await this.poolInstance.query<AgentMetricsRow>(
      'SELECT * FROM agent_metrics ORDER BY last_used_at DESC NULLS LAST'
    );

    return result.rows;
  }

  async incrementUsage(agentId: string): Promise<AgentMetricsRow> {
    const existing = await this.findByAgentId(agentId);

    if (existing) {
      const result = await this.poolInstance.query<AgentMetricsRow>(
        `UPDATE agent_metrics
         SET usage_count = usage_count + 1,
             last_used_at = now(),
             updated_at = now()
         WHERE agent_id = $1
         RETURNING *`,
        [agentId]
      );

      return result.rows[0];
    } else {
      return this.createOrUpdate({
        agent_id: agentId,
        usage_count: 1,
        avg_score: null,
        avg_latency_ms: null,
        last_used_at: new Date(),
      });
    }
  }

  async updateMetrics(
    agentId: string,
    updates: Partial<Pick<AgentMetrics, 'avg_score' | 'avg_latency_ms'>>
  ): Promise<AgentMetricsRow | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.avg_score !== undefined) {
      updateFields.push(`avg_score = $${paramIndex++}`);
      params.push(updates.avg_score);
    }

    if (updates.avg_latency_ms !== undefined) {
      updateFields.push(`avg_latency_ms = $${paramIndex++}`);
      params.push(updates.avg_latency_ms);
    }

    if (updateFields.length === 0) {
      return this.findByAgentId(agentId);
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());
    params.push(agentId);

    const result = await this.poolInstance.query<AgentMetricsRow>(
      `UPDATE agent_metrics SET ${updateFields.join(', ')} WHERE agent_id = $${paramIndex} RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }
}

export const agentMetricsRepository = new AgentMetricsRepository();

