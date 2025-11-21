import { BaseProvider } from './base.provider';
import { IModelProvider } from '../provider.interface';
import { ModelConfig, ChatMessage, ChatMessageWithImages, ModelExecutionOptions } from '@/src/types/models';
import { MockProvider, createSuccessMock } from '@/tests/helpers/mocks/modelMocks';

export class MockModelProvider extends BaseProvider implements IModelProvider {
  private mockProvider: MockProvider;

  constructor(timeout: number = 100) {
    super(timeout);
    this.mockProvider = createSuccessMock(timeout);
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    return this.mockProvider.generateText(model, messages, options);
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    yield* this.mockProvider.generateTextStream(model, messages, options);
  }

  async generateVision?(
    model: ModelConfig,
    messages: ChatMessageWithImages[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    return this.mockProvider.generateVision(model, messages, options);
  }

  supportsModality(modality: string): boolean {
    return true; // Mock supports all modalities
  }

  isAvailable(): boolean {
    return true; // Mock is always available
  }
}

