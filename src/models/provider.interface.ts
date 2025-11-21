import { ModelConfig, ChatMessage, ChatMessageWithImages, ModelExecutionOptions, ImageResult } from '@/src/types/models';

export interface IModelProvider {
  generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string>;

  generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string>;

  generateVision?(
    model: ModelConfig,
    messages: ChatMessageWithImages[],
    options?: ModelExecutionOptions
  ): Promise<string>;

  generateImage?(
    model: ModelConfig,
    prompt: string,
    options?: { size?: string }
  ): Promise<ImageResult>;

  supportsModality(modality: string): boolean;
  isAvailable(): boolean | Promise<boolean>;
}

