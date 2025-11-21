import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import { AgentType, AgentTypeRow } from '@/src/types/agents';

export class AgentTypesRepository {
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

  async create(
    agentType: Omit<AgentType, 'created_at' | 'updated_at'>
  ): Promise<AgentTypeRow> {
    const now = new Date();

    const result = await this.poolInstance.query<AgentTypeRow>(
      `INSERT INTO agent_types (
        id, description, system_prompt, modalities, interests, permissions,
        is_core, is_enabled, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        agentType.id,
        agentType.description,
        agentType.system_prompt,
        agentType.modalities || [],
        JSON.stringify(agentType.interests || {}),
        JSON.stringify(agentType.permissions || {}),
        agentType.is_core || false,
        agentType.is_enabled ?? true,
        now,
        now,
      ]
    );

    return result.rows[0];
  }

  async findById(id: string): Promise<AgentTypeRow | null> {
    const result = await this.poolInstance.query<AgentTypeRow>(
      'SELECT * FROM agent_types WHERE id = $1',
      [id]
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async findAll(filters?: { is_enabled?: boolean; is_core?: boolean }): Promise<AgentTypeRow[]> {
    let query = 'SELECT * FROM agent_types WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.is_enabled !== undefined) {
      query += ` AND is_enabled = $${paramIndex++}`;
      params.push(filters.is_enabled);
    }

    if (filters?.is_core !== undefined) {
      query += ` AND is_core = $${paramIndex++}`;
      params.push(filters.is_core);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.poolInstance.query<AgentTypeRow>(query, params);
    return result.rows.map((row) => this.mapRow(row));
  }

  async findEnabled(): Promise<AgentTypeRow[]> {
    return this.findAll({ is_enabled: true });
  }

  async update(
    id: string,
    updates: Partial<Omit<AgentType, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<AgentTypeRow | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'interests' || key === 'permissions') {
          updateFields.push(`${key} = $${paramIndex++}`);
          params.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      }
    });

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());
    params.push(id);

    const result = await this.poolInstance.query<AgentTypeRow>(
      `UPDATE agent_types SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.poolInstance.query(
      'DELETE FROM agent_types WHERE id = $1',
      [id]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  private mapRow(row: any): AgentTypeRow {
    return {
      ...row,
      interests: typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests,
      permissions:
        typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
    };
  }
}

export const agentTypesRepository = new AgentTypesRepository();

