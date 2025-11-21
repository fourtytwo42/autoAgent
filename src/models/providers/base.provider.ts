import { IModelProvider } from '../provider.interface';
import { ModelConfig, ChatMessage, ModelExecutionOptions } from '@/src/types/models';

export abstract class BaseProvider implements IModelProvider {
  protected timeout: number;

  constructor(timeout: number = 60000) {
    this.timeout = timeout;
  }

  abstract generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string>;

  abstract generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string>;

  abstract supportsModality(modality: string): boolean;

  abstract isAvailable(): boolean | Promise<boolean>;

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number = this.timeout): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  protected buildMessages(systemPrompt: string, userMessages: ChatMessage[]): ChatMessage[] {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push(...userMessages);

    return messages;
  }
}

