import { env } from './env';
import { ProviderType } from '@/src/types/models';
import { providerConfigsRepository, ProviderConfig } from '@/src/db/providerConfigs.repository';

// Cache for provider configs (refreshed on each get)
let configCache: Map<ProviderType, ProviderConfig | null> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

async function getCachedProviderConfig(provider: ProviderType): Promise<ProviderConfig | null> {
  const now = Date.now();
  
  // Refresh cache if it's empty or expired
  if (!configCache || (now - cacheTimestamp) > CACHE_TTL) {
    try {
      const allConfigs = await providerConfigsRepository.getAll();
      configCache = new Map(Object.entries(allConfigs) as [ProviderType, ProviderConfig | null][]);
      cacheTimestamp = now;
    } catch (error) {
      // If DB is unavailable, fall back to env vars
      console.warn(`[ProviderConfig] DB unavailable, falling back to env vars: ${error}`);
      return null;
    }
  }

  return configCache.get(provider) || null;
}

export interface ModelProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export async function getProviderConfig(provider: ProviderType): Promise<ModelProviderConfig> {
  // Try to get from database first
  const dbConfig = await getCachedProviderConfig(provider);
  
  if (dbConfig) {
    return {
      apiKey: dbConfig.apiKey,
      baseUrl: dbConfig.baseUrl,
      timeout: dbConfig.timeout,
    };
  }

  // Fall back to environment variables if DB config not available
  const envConfigs: Record<ProviderType, ModelProviderConfig> = {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      timeout: env.MODEL_REQUEST_TIMEOUT_MS,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      timeout: env.MODEL_REQUEST_TIMEOUT_MS,
    },
    groq: {
      apiKey: env.GROQ_API_KEY,
      timeout: env.MODEL_REQUEST_TIMEOUT_MS,
    },
    ollama: {
      baseUrl: env.OLLAMA_BASE_URL,
      timeout: env.MODEL_REQUEST_TIMEOUT_MS,
    },
    lmstudio: {
      baseUrl: env.LM_STUDIO_BASE_URL,
      timeout: 120000, // Longer timeout for network LM Studio (2 minutes)
    },
  };

  return envConfigs[provider] || {};
}

// Clear cache when configs are updated
export function clearProviderConfigCache(): void {
  configCache = null;
  cacheTimestamp = 0;
}

export function shouldUseMockProviders(): boolean {
  return env.USE_MOCK_PROVIDERS;
}

