import { Pool } from 'pg';
import { getDatabasePool } from '@/src/config/database';
import { ProviderType } from '@/src/types/models';

export interface ProviderConfigRow {
  id: string;
  provider: ProviderType;
  api_key: string | null;
  base_url: string | null;
  timeout_ms: number;
  is_enabled: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  isEnabled?: boolean;
  metadata?: Record<string, any>;
}

export class ProviderConfigsRepository {
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

  async get(provider: ProviderType): Promise<ProviderConfig | null> {
    const result = await this.poolInstance.query<ProviderConfigRow>(
      `SELECT * FROM provider_configs WHERE provider = $1`,
      [provider]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      apiKey: row.api_key || undefined,
      baseUrl: row.base_url || undefined,
      timeout: row.timeout_ms,
      isEnabled: row.is_enabled,
      metadata: row.metadata,
    };
  }

  async getAll(): Promise<Record<ProviderType, ProviderConfig | null>> {
    const result = await this.poolInstance.query<ProviderConfigRow>(
      `SELECT * FROM provider_configs ORDER BY provider`
    );

    const configs: Record<string, ProviderConfig | null> = {};
    for (const row of result.rows) {
      configs[row.provider] = {
        apiKey: row.api_key || undefined,
        baseUrl: row.base_url || undefined,
        timeout: row.timeout_ms,
        isEnabled: row.is_enabled,
        metadata: row.metadata,
      };
    }

    return configs as Record<ProviderType, ProviderConfig | null>;
  }

  async update(provider: ProviderType, config: Partial<ProviderConfig>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (config.apiKey !== undefined) {
      updates.push(`api_key = $${paramIndex++}`);
      values.push(config.apiKey || null);
    }

    if (config.baseUrl !== undefined) {
      updates.push(`base_url = $${paramIndex++}`);
      values.push(config.baseUrl || null);
    }

    if (config.timeout !== undefined) {
      updates.push(`timeout_ms = $${paramIndex++}`);
      values.push(config.timeout);
    }

    if (config.isEnabled !== undefined) {
      updates.push(`is_enabled = $${paramIndex++}`);
      values.push(config.isEnabled);
    }

    if (config.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(config.metadata));
    }

    if (updates.length === 0) {
      return;
    }

    updates.push(`updated_at = now()`);
    values.push(provider);

    await this.poolInstance.query(
      `UPDATE provider_configs 
       SET ${updates.join(', ')} 
       WHERE provider = $${paramIndex}`,
      values
    );
  }

  async upsert(provider: ProviderType, config: ProviderConfig): Promise<void> {
    await this.poolInstance.query(
      `INSERT INTO provider_configs (provider, api_key, base_url, timeout_ms, is_enabled, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (provider) DO UPDATE
       SET api_key = EXCLUDED.api_key,
           base_url = EXCLUDED.base_url,
           timeout_ms = EXCLUDED.timeout_ms,
           is_enabled = EXCLUDED.is_enabled,
           metadata = EXCLUDED.metadata,
           updated_at = now()`,
      [
        provider,
        config.apiKey || null,
        config.baseUrl || null,
        config.timeout || 60000,
        config.isEnabled !== undefined ? config.isEnabled : true,
        JSON.stringify(config.metadata || {}),
      ]
    );
  }
}

export const providerConfigsRepository = new ProviderConfigsRepository();
