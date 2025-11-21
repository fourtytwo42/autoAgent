import { ModelConfig } from '@/types/models';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MockProviderConfig {
  delay?: number; // Simulated latency in ms
  shouldFail?: boolean;
  failureType?: 'timeout' | 'rate_limit' | 'network_error' | 'invalid_json';
  errorMessage?: string;
}

export class MockProvider {
  private config: MockProviderConfig;

  constructor(config: MockProviderConfig = {}) {
    this.config = {
      delay: config.delay ?? 100,
      shouldFail: config.shouldFail ?? false,
      failureType: config.failureType ?? 'network_error',
      errorMessage: config.errorMessage,
    };
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    await this.simulateDelay();

    if (this.config.shouldFail) {
      throw this.createError();
    }

    // Generate deterministic response based on input
    return this.createMockResponse(model, messages, options);
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): AsyncIterable<string> {
    await this.simulateDelay();

    if (this.config.shouldFail) {
      throw this.createError();
    }

    const fullResponse = this.createMockResponse(model, messages, options);
    
    // Stream response token by token (simulate streaming)
    const tokens = fullResponse.split(' ');
    for (const token of tokens) {
      await new Promise(resolve => setTimeout(resolve, 10));
      yield token + ' ';
    }
  }

  async generateVision(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Vision models return similar text but acknowledge image content
    const textResponse = await this.generateText(model, messages, options);
    return `[Vision] ${textResponse}`;
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.delay && this.config.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }
  }

  private createError(): Error {
    const error = new Error(
      this.config.errorMessage || `Mock ${this.config.failureType} error`
    );
    
    switch (this.config.failureType) {
      case 'timeout':
        (error as any).code = 'ETIMEDOUT';
        break;
      case 'rate_limit':
        (error as any).statusCode = 429;
        (error as any).code = 'RATE_LIMIT';
        break;
      case 'network_error':
        (error as any).code = 'ENOTFOUND';
        break;
      case 'invalid_json':
        // Return a response that looks valid but contains invalid JSON
        return new Error('Invalid JSON response from provider');
    }
    
    return error;
  }

  private createMockResponse(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): string {
    // Create deterministic response based on model and messages
    const lastMessage = messages[messages.length - 1];
    const modelName = model.name.toLowerCase();
    
    // Deterministic hash of input for consistent responses
    const inputHash = this.simpleHash(JSON.stringify(messages));
    
    // Generate response based on model characteristics
    if (modelName.includes('reasoning') || modelName.includes('gpt-4')) {
      return `[${model.name}] Here is a detailed and well-reasoned response to your request: "${lastMessage.content.substring(0, 50)}..." (hash: ${inputHash})`;
    } else if (modelName.includes('creative')) {
      return `[${model.name}] Creative response: ${lastMessage.content.substring(0, 30)}... [hash: ${inputHash}]`;
    } else {
      return `[${model.name}] Response to: ${lastMessage.content.substring(0, 50)}... [hash: ${inputHash}]`;
    }
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Factory functions for common scenarios
export function createSuccessMock(delay = 100): MockProvider {
  return new MockProvider({ delay, shouldFail: false });
}

export function createTimeoutMock(timeout = 5000): MockProvider {
  return new MockProvider({
    delay: timeout,
    shouldFail: true,
    failureType: 'timeout',
  });
}

export function createRateLimitMock(): MockProvider {
  return new MockProvider({
    shouldFail: true,
    failureType: 'rate_limit',
    errorMessage: 'Rate limit exceeded',
  });
}

export function createNetworkErrorMock(): MockProvider {
  return new MockProvider({
    shouldFail: true,
    failureType: 'network_error',
    errorMessage: 'Network connection failed',
  });
}

export function createInvalidJsonMock(): MockProvider {
  return new MockProvider({
    shouldFail: true,
    failureType: 'invalid_json',
    errorMessage: 'Invalid JSON in response',
  });
}

