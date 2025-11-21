import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import { ModelConfig, ModelRow, ProviderType, Modality } from '@/src/types/models';
import { randomUUID } from 'crypto';

export class ModelsRepository {
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

  async create(model: Omit<ModelConfig, 'id' | 'created_at' | 'updated_at'>): Promise<ModelRow> {
    const id = randomUUID();
    const now = new Date();

    const result = await this.poolInstance.query<ModelRow>(
      `INSERT INTO models (
        id, name, provider, display_name, is_enabled, modalities,
        context_window, avg_latency_ms, cost_per_1k_tokens,
        quality_score, reliability_score, last_benchmarked_at, metadata,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        model.name,
        model.provider,
        model.display_name || model.name,
        model.is_enabled ?? true,
        model.modalities,
        model.contextWindow || null,
        model.avg_latency_ms || null,
        model.cost_per_1k_tokens || null,
        model.qualityScore,
        model.reliabilityScore,
        model.last_benchmarked_at || null,
        JSON.stringify(model.metadata || {}),
        now,
        now,
      ]
    );

    return result.rows[0];
  }

  async findById(id: string): Promise<ModelRow | null> {
    const result = await this.poolInstance.query<ModelRow>(
      'SELECT * FROM models WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  async findAll(filters?: {
    provider?: ProviderType;
    is_enabled?: boolean;
    hasModality?: Modality;
  }): Promise<ModelRow[]> {
    let query = 'SELECT * FROM models WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.provider) {
      query += ` AND provider = $${paramIndex++}`;
      params.push(filters.provider);
    }

    if (filters?.is_enabled !== undefined) {
      query += ` AND is_enabled = $${paramIndex++}`;
      params.push(filters.is_enabled);
    }

    if (filters?.hasModality) {
      query += ` AND $${paramIndex++} = ANY(modalities)`;
      params.push(filters.hasModality);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.poolInstance.query<ModelRow>(query, params);
    return result.rows;
  }

  async findEnabled(): Promise<ModelRow[]> {
    return this.findAll({ is_enabled: true });
  }

  async update(
    id: string,
    updates: Partial<Omit<ModelConfig, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<ModelRow | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'contextWindow') {
          updateFields.push(`context_window = $${paramIndex++}`);
          params.push(value);
        } else if (key === 'qualityScore') {
          updateFields.push(`quality_score = $${paramIndex++}`);
          params.push(value);
        } else if (key === 'reliabilityScore') {
          updateFields.push(`reliability_score = $${paramIndex++}`);
          params.push(value);
        } else if (key === 'last_benchmarked_at') {
          updateFields.push(`last_benchmarked_at = $${paramIndex++}`);
          params.push(value);
        } else if (key === 'metadata') {
          updateFields.push(`metadata = $${paramIndex++}`);
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

    const result = await this.poolInstance.query<ModelRow>(
      `UPDATE models SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.poolInstance.query(
      'DELETE FROM models WHERE id = $1',
      [id]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  async enable(id: string): Promise<ModelRow | null> {
    return this.update(id, { is_enabled: true });
  }

  async disable(id: string): Promise<ModelRow | null> {
    return this.update(id, { is_enabled: false });
  }
}

export const modelsRepository = new ModelsRepository();

