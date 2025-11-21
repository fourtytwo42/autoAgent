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
  domain?: string; // 'code', 'design', 'math', 'creative', 'reasoning', etc.
  maxLatency?: number; // Maximum acceptable latency in ms
  fallbackChain?: boolean; // Return multiple models in fallback order
}

export interface DomainRouting {
  [domain: string]: {
    preferredProviders?: string[];
    minQuality?: number;
    maxCost?: number;
    preferLocal?: boolean;
  };
}

// Domain-specific routing configuration
const DOMAIN_ROUTING: DomainRouting = {
  code: {
    preferredProviders: ['openai', 'anthropic', 'groq'],
    minQuality: 0.8,
    preferLocal: false,
  },
  design: {
    preferredProviders: ['openai', 'anthropic'],
    minQuality: 0.75,
    preferLocal: false,
  },
  math: {
    preferredProviders: ['openai', 'anthropic'],
    minQuality: 0.85,
    preferLocal: false,
  },
  creative: {
    preferredProviders: ['openai', 'anthropic', 'ollama'],
    minQuality: 0.7,
    preferLocal: true,
  },
  reasoning: {
    preferredProviders: ['openai', 'anthropic'],
    minQuality: 0.9,
    preferLocal: false,
  },
};

export class ModelRouter {
  async selectModel(options: ModelSelectionOptions = {}): Promise<ModelConfig | null> {
    let candidates = await modelRegistry.getEnabledModels();

    // Exclude specific model IDs
    if (options.excludeIds && options.excludeIds.length > 0) {
      candidates = candidates.filter((model) => !options.excludeIds!.includes(model.id));
    }

    // Apply domain-specific routing if domain is specified
    if (options.domain && DOMAIN_ROUTING[options.domain]) {
      const domainConfig = DOMAIN_ROUTING[options.domain];
      
      if (domainConfig.preferredProviders) {
        // Prefer models from preferred providers
        candidates.sort((a, b) => {
          const aIndex = domainConfig.preferredProviders!.indexOf(a.provider);
          const bIndex = domainConfig.preferredProviders!.indexOf(b.provider);
          
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }
      
      // Apply domain-specific quality threshold
      if (domainConfig.minQuality !== undefined) {
        const threshold = Math.max(domainConfig.minQuality, options.minQuality || 0);
        candidates = candidates.filter((model) => model.qualityScore >= threshold);
      }
      
      // Apply domain-specific cost limit
      if (domainConfig.maxCost !== undefined) {
        const costLimit = options.maxCost !== undefined 
          ? Math.min(domainConfig.maxCost, options.maxCost) 
          : domainConfig.maxCost;
        candidates = candidates.filter(
          (model) => !model.cost_per_1k_tokens || model.cost_per_1k_tokens <= costLimit
        );
      }
      
      // Apply domain-specific local preference
      if (domainConfig.preferLocal !== undefined) {
        const preferLocal = domainConfig.preferLocal || options.preferLocal || false;
        if (preferLocal) {
          candidates.sort((a, b) => {
            const aLocal = a.provider === 'ollama' || a.provider === 'lmstudio' ? 1 : 0;
            const bLocal = b.provider === 'ollama' || b.provider === 'lmstudio' ? 1 : 0;
            return bLocal - aLocal;
          });
        }
      }
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

    // Filter by latency
    if (options.maxLatency !== undefined) {
      candidates = candidates.filter(
        (model) => !model.avg_latency_ms || model.avg_latency_ms <= options.maxLatency!
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
    // Also consider latency and cost
    candidates.sort((a, b) => {
      // Primary: Quality and reliability score
      const aScore = a.qualityScore * 0.5 + a.reliabilityScore * 0.3;
      const bScore = b.qualityScore * 0.5 + b.reliabilityScore * 0.3;
      
      if (Math.abs(aScore - bScore) > 0.1) {
        return bScore - aScore;
      }
      
      // Secondary: Latency (prefer lower)
      const aLatency = a.avg_latency_ms || 10000;
      const bLatency = b.avg_latency_ms || 10000;
      if (Math.abs(aLatency - bLatency) > 1000) {
        return aLatency - bLatency;
      }
      
      // Tertiary: Cost (prefer lower)
      const aCost = a.cost_per_1k_tokens || 0;
      const bCost = b.cost_per_1k_tokens || 0;
      if (aCost !== bCost) {
        return aCost - bCost;
      }
      
      return 0;
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

  async selectWithFallback(options: ModelSelectionOptions = {}): Promise<ModelConfig[]> {
    // Return models in fallback order (best to worst)
    const models: ModelConfig[] = [];
    const usedIds = new Set<string>();
    const allModels = await modelRegistry.getEnabledModels();

    // Apply all filters
    let candidates = allModels;

    if (options.excludeIds) {
      candidates = candidates.filter((m) => !options.excludeIds!.includes(m.id));
    }

    if (options.requiredModalities) {
      candidates = candidates.filter((m) =>
        options.requiredModalities!.every((mod) => m.modalities.includes(mod as any))
      );
    }

    if (options.minQuality !== undefined) {
      candidates = candidates.filter((m) => m.qualityScore >= options.minQuality!);
    }

    // Sort by quality/reliability
    candidates.sort((a, b) => {
      const aScore = a.qualityScore * 0.7 + a.reliabilityScore * 0.3;
      const bScore = b.qualityScore * 0.7 + b.reliabilityScore * 0.3;
      return bScore - aScore;
    });

    return candidates;
  }
}

export const modelRouter = new ModelRouter();
