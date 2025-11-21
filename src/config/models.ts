import { env } from './env';
import { ProviderType } from '@/src/types/models';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ModelProviderConfigs {
  [key: string]: ProviderConfig;
}

export function getProviderConfig(provider: ProviderType): ProviderConfig {
  const configs: ModelProviderConfigs = {
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
      timeout: env.MODEL_REQUEST_TIMEOUT_MS,
    },
  };

  return configs[provider] || {};
}

export function shouldUseMockProviders(): boolean {
  return env.USE_MOCK_PROVIDERS;
}

