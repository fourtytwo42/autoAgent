import { ModelConfig } from '@/src/types/models';
import { modelRegistry } from './registry';
import { agentModelPrefsRepository } from '@/src/db/repositories/agentModelPrefs.repository';

export interface ModelSelectionOptions {
  agentId?: string;
  requiredModalities?: string[];
  maxCost?: number;
  minQuality?: number;
  preferLocal?: boolean;
  excludeIds?: string[];
}

export class ModelRouter {
  async selectModel(options: ModelSelectionOptions = {}): Promise<ModelConfig | null> {
    let candidates = await modelRegistry.getEnabledModels();

    // Exclude specific model IDs
    if (options.excludeIds && options.excludeIds.length > 0) {
      candidates = candidates.filter((model) => !options.excludeIds!.includes(model.id));
    }

    // Filter by required modalities
    if (options.requiredModalities && options.requiredModalities.length > 0) {
      candidates = candidates.filter((model) =>
        options.requiredModalities!.every((mod) => model.modalities.includes(mod as any))
      );
    }

    // Filter by quality
    if (options.minQuality !== undefined) {
      candidates = candidates.filter((model) => model.qualityScore >= options.minQuality!);
    }

    // Filter by cost
    if (options.maxCost !== undefined) {
      candidates = candidates.filter(
        (model) => !model.cost_per_1k_tokens || model.cost_per_1k_tokens <= options.maxCost!
      );
    }

    // Prefer local models if requested
    if (options.preferLocal) {
      candidates.sort((a, b) => {
        const aLocal = a.provider === 'ollama' || a.provider === 'lmstudio' ? 1 : 0;
        const bLocal = b.provider === 'ollama' || b.provider === 'lmstudio' ? 1 : 0;
        return bLocal - aLocal;
      });
    }

    // If agent ID provided, use agent preferences
    if (options.agentId) {
      const prefs = await agentModelPrefsRepository.findByAgentId(options.agentId);

      if (prefs.length > 0) {
        // Sort by priority and filter to only enabled models
        const prefModelIds = prefs.map((p) => p.model_id);
        const prefCandidates = candidates.filter((c) => prefModelIds.includes(c.id));

        if (prefCandidates.length > 0) {
          // Sort by preference priority
          prefCandidates.sort((a, b) => {
            const aPref = prefs.find((p) => p.model_id === a.id);
            const bPref = prefs.find((p) => p.model_id === b.id);

            if (!aPref || !bPref) return 0;

            // Lower priority number = higher priority
            if (aPref.priority !== bPref.priority) {
              return aPref.priority - bPref.priority;
            }

            // If same priority, use weight
            return bPref.weight - aPref.weight;
          });

          candidates = prefCandidates;
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Rank by quality and reliability (weighted)
    candidates.sort((a, b) => {
      const aScore = a.qualityScore * 0.7 + a.reliabilityScore * 0.3;
      const bScore = b.qualityScore * 0.7 + b.reliabilityScore * 0.3;
      return bScore - aScore;
    });

    return candidates[0];
  }

  async selectMultipleModels(count: number, options: ModelSelectionOptions = {}): Promise<ModelConfig[]> {
    const models: ModelConfig[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < count; i++) {
      // Create a temporary options object excluding already selected models
      const filteredOptions: ModelSelectionOptions = {
        ...options,
        excludeIds: Array.from(usedIds),
      };

      const model = await this.selectModel(filteredOptions);
      if (!model || usedIds.has(model.id)) {
        break;
      }

      models.push(model);
      usedIds.add(model.id);
    }

    return models;
  }
}

export const modelRouter = new ModelRouter();
