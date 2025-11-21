import { ModelConfig, ChatMessage, ChatMessageWithImages, ModelExecutionOptions, ImageResult } from '@/src/types/models';

export interface ProviderModel {
  id: string;
  name: string;
  display_name?: string;
  modalities?: string[];
  context_window?: number;
  supports_streaming?: boolean;
  supports_vision?: boolean;
  supports_image_gen?: boolean;
}

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
  
  /**
   * List available models from this provider
   * Returns empty array if provider is not configured or unavailable
   */
  listModels?(): Promise<ProviderModel[]>;
}

