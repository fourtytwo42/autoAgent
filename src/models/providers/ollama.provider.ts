import { BaseProvider } from './base.provider';
import { IModelProvider, ProviderModel } from '../provider.interface';
import { ModelConfig, ChatMessage, ModelExecutionOptions } from '@/src/types/models';
import { getProviderConfig } from '@/src/config/models';

export class OllamaProvider extends BaseProvider implements IModelProvider {
  private baseUrl: string;

  constructor(timeout: number = 120000) {
    super(timeout);
    const config = getProviderConfig('ollama');
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || timeout;
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;

    // Convert messages to Ollama format
    const ollamaMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const body = {
      model: model.name,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens,
      },
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error: ${error}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    const url = `${this.baseUrl}/api/chat`;

    const ollamaMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const body = {
      model: model.name,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens,
      },
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error: ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content;
            if (content) {
              yield content;
            }
            if (parsed.done) {
              return;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  supportsModality(modality: string): boolean {
    return modality === 'text'; // Ollama is primarily text
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    try {
      const response = await this.withTimeout(
        fetch(`${this.baseUrl}/api/tags`, {
          method: 'GET',
        }),
        this.timeout
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.models || []).map((model: any) => ({
        id: model.name,
        name: model.name,
        display_name: model.name,
        modalities: ['text'],
        context_window: undefined,
        supports_streaming: true,
        supports_vision: false,
        supports_image_gen: false,
      }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  }
}

