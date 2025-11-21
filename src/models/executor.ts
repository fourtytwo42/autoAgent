import { ModelConfig, ChatMessage, ChatMessageWithImages, ModelExecutionOptions, ModelExecutor, ImageResult } from '@/src/types/models';
import { IModelProvider } from './provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { MockModelProvider } from './providers/mock.provider';
import { shouldUseMockProviders } from '@/src/config/models';

export class UnifiedModelExecutor implements ModelExecutor {
  private providers: Map<string, IModelProvider> = new Map();

  private getProvider(model: ModelConfig): IModelProvider {
    const useMock = shouldUseMockProviders();

    if (useMock) {
      if (!this.providers.has('mock')) {
        this.providers.set('mock', new MockModelProvider());
      }
      return this.providers.get('mock')!;
    }

    const providerKey = model.provider;

    if (!this.providers.has(providerKey)) {
      switch (model.provider) {
        case 'openai':
          this.providers.set(providerKey, new OpenAIProvider());
          break;
        default:
          // For other providers, fall back to mock for now
          if (!this.providers.has('mock')) {
            this.providers.set('mock', new MockModelProvider());
          }
          return this.providers.get('mock')!;
      }
    }

    const provider = this.providers.get(providerKey);
    if (!provider || !provider.isAvailable()) {
      // Fall back to mock if provider unavailable
      if (!this.providers.has('mock')) {
        this.providers.set('mock', new MockModelProvider());
      }
      return this.providers.get('mock')!;
    }

    return provider;
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    const provider = this.getProvider(model);
    return provider.generateText(model, messages, options);
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    const provider = this.getProvider(model);
    yield* provider.generateTextStream(model, messages, options);
  }

  async generateVision?(
    model: ModelConfig,
    messages: ChatMessageWithImages[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    const provider = this.getProvider(model);
    if (!provider.generateVision) {
      throw new Error(`Provider ${model.provider} does not support vision`);
    }
    return provider.generateVision(model, messages, options);
  }

  async generateImage?(
    model: ModelConfig,
    prompt: string,
    options?: { size?: string }
  ): Promise<ImageResult> {
    const provider = this.getProvider(model);
    if (!provider.generateImage) {
      throw new Error(`Provider ${model.provider} does not support image generation`);
    }
    return provider.generateImage(model, prompt, options);
  }
}

export const modelExecutor = new UnifiedModelExecutor();

