import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import { AgentModelPreference, AgentModelPrefRow } from '@/src/types/agents';
import { randomUUID } from 'crypto';

export class AgentModelPrefsRepository {
  constructor(private pool: Pool = getDatabasePool()) {}

  async create(pref: Omit<AgentModelPreference, 'id' | 'created_at'>): Promise<AgentModelPrefRow> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.pool.query<AgentModelPrefRow>(
      `INSERT INTO agent_model_prefs (id, agent_id, model_id, priority, weight, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, pref.agent_id, pref.model_id, pref.priority, pref.weight || 1.0, now]
    );

    return result.rows[0];
  }

  async findByAgentId(agentId: string): Promise<AgentModelPrefRow[]> {
    const result = await this.pool.query<AgentModelPrefRow>(
      'SELECT * FROM agent_model_prefs WHERE agent_id = $1 ORDER BY priority ASC, weight DESC',
      [agentId]
    );

    return result.rows;
  }

  async findByModelId(modelId: string): Promise<AgentModelPrefRow[]> {
    const result = await this.pool.query<AgentModelPrefRow>(
      'SELECT * FROM agent_model_prefs WHERE model_id = $1 ORDER BY priority ASC',
      [modelId]
    );

    return result.rows;
  }

  async find(agentId: string, modelId: string): Promise<AgentModelPrefRow | null> {
    const result = await this.pool.query<AgentModelPrefRow>(
      'SELECT * FROM agent_model_prefs WHERE agent_id = $1 AND model_id = $2',
      [agentId, modelId]
    );

    return result.rows[0] || null;
  }

  async update(
    agentId: string,
    modelId: string,
    updates: Partial<Pick<AgentModelPreference, 'priority' | 'weight'>>
  ): Promise<AgentModelPrefRow | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.priority !== undefined) {
      updateFields.push(`priority = $${paramIndex++}`);
      params.push(updates.priority);
    }

    if (updates.weight !== undefined) {
      updateFields.push(`weight = $${paramIndex++}`);
      params.push(updates.weight);
    }

    if (updateFields.length === 0) {
      return this.find(agentId, modelId);
    }

    params.push(agentId, modelId);

    const result = await this.pool.query<AgentModelPrefRow>(
      `UPDATE agent_model_prefs SET ${updateFields.join(', ')}
       WHERE agent_id = $${paramIndex++} AND model_id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async delete(agentId: string, modelId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM agent_model_prefs WHERE agent_id = $1 AND model_id = $2',
      [agentId, modelId]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteByAgentId(agentId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM agent_model_prefs WHERE agent_id = $1',
      [agentId]
    );

    return result.rowCount || 0;
  }
}

export const agentModelPrefsRepository = new AgentModelPrefsRepository();

