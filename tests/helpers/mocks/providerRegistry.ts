import {
  MockProvider,
  createSuccessMock,
  createTimeoutMock,
  createRateLimitMock,
  createNetworkErrorMock,
} from './modelMocks';
import { ModelConfig } from '@/types/models';

export type ProviderType = 'openai' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio';

const mockProviders = new Map<string, MockProvider>();

/**
 * Get or create a mock provider for a model
 */
export function getMockProvider(
  model: ModelConfig,
  scenario: 'success' | 'timeout' | 'rate_limit' | 'network_error' = 'success'
): MockProvider {
  const key = `${model.id}:${scenario}`;
  
  if (!mockProviders.has(key)) {
    let provider: MockProvider;
    switch (scenario) {
      case 'timeout':
        provider = createTimeoutMock();
        break;
      case 'rate_limit':
        provider = createRateLimitMock();
        break;
      case 'network_error':
        provider = createNetworkErrorMock();
        break;
      case 'success':
      default:
        provider = createSuccessMock();
        break;
    }
    mockProviders.set(key, provider);
  }
  
  return mockProviders.get(key)!;
}

/**
 * Check if mock providers should be used
 */
export function useMockProviders(): boolean {
  return process.env.USE_MOCK_PROVIDERS === 'true';
}

/**
 * Clear all mock providers
 */
export function clearMockProviders(): void {
  mockProviders.clear();
}

/**
 * Unified model executor that switches between real and mock providers
 */
export class UnifiedModelExecutor {
  async generateText(
    model: ModelConfig,
    messages: any[],
    options?: any
  ): Promise<string> {
    if (useMockProviders()) {
      const mock = getMockProvider(model);
      return mock.generateText(model, messages, options);
    }
    
    // Real provider implementation would go here
    // For now, throw error if trying to use real providers in test
    throw new Error('Real providers not implemented in test environment');
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: any[],
    options?: any
  ): AsyncIterable<string> {
    if (useMockProviders()) {
      const mock = getMockProvider(model);
      yield* mock.generateTextStream(model, messages, options);
      return;
    }
    
    throw new Error('Real providers not implemented in test environment');
  }
}

export const modelExecutor = new UnifiedModelExecutor();

