import { ModelConfig, ModelRow } from '@/src/types/models';
import { modelsRepository } from '@/src/db/repositories/models.repository';

export class ModelRegistry {
  private cache: Map<string, ModelConfig> = new Map();
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  async getModel(id: string): Promise<ModelConfig | null> {
    // Check cache first
    if (this.cache.has(id)) {
      const cached = this.cache.get(id)!;
      if (Date.now() - this.cacheTimestamp < this.cacheTTL) {
        return cached;
      }
    }

    // Load from database
    const row = await modelsRepository.findById(id);
    if (!row) {
      return null;
    }

    const model = this.mapRowToConfig(row);
    this.cache.set(id, model);
    this.cacheTimestamp = Date.now();

    return model;
  }

  async getEnabledModels(): Promise<ModelConfig[]> {
    const rows = await modelsRepository.findEnabled();
    return rows.map((row) => this.mapRowToConfig(row));
  }

  async getAllModels(): Promise<ModelConfig[]> {
    const rows = await modelsRepository.findAll();
    return rows.map((row) => this.mapRowToConfig(row));
  }

  async getModelsByProvider(provider: ModelConfig['provider']): Promise<ModelConfig[]> {
    const rows = await modelsRepository.findAll({ provider });
    return rows.map((row) => this.mapRowToConfig(row));
  }

  async getModelsWithModality(modality: string): Promise<ModelConfig[]> {
    const rows = await modelsRepository.findAll({ hasModality: modality as any });
    return rows.map((row) => this.mapRowToConfig(row));
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }

  private mapRowToConfig(row: ModelRow): ModelConfig {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      display_name: row.display_name,
      modalities: row.modalities as any[],
      contextWindow: row.context_window || undefined,
      qualityScore: row.quality_score || 0,
      reliabilityScore: row.reliability_score || 0,
      metadata: row.metadata,
      is_enabled: row.is_enabled,
      avg_latency_ms: row.avg_latency_ms || undefined,
      cost_per_1k_tokens: row.cost_per_1k_tokens || undefined,
      last_benchmarked_at: row.last_benchmarked_at || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const modelRegistry = new ModelRegistry();

