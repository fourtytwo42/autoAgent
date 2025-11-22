import { BaseProvider } from './base.provider';
import { IModelProvider, ProviderModel } from '../provider.interface';
import { ModelConfig, ChatMessage, ModelExecutionOptions } from '@/src/types/models';
import { getProviderConfig } from '@/src/config/models';

export class OllamaProvider extends BaseProvider implements IModelProvider {
  private _baseUrl?: string;

  constructor(timeout: number = 120000) {
    super(timeout);
    this.loadConfig().catch(console.error);
  }

  private async loadConfig(): Promise<void> {
    const config = await getProviderConfig('ollama');
    this._baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || this.timeout;
  }

  async ensureConfig(): Promise<void> {
    if (!this._baseUrl) {
      await this.loadConfig();
    }
  }

  private get baseUrl(): string {
    return this._baseUrl || 'http://localhost:11434';
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    await this.ensureConfig();
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
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        this.timeout
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Ollama API error (${response.status}):`, errorText);
        return [];
      }

      const data = await response.json();
      
      // Ollama returns { models: [...] } directly
      const models = data.models || [];
      
      if (!Array.isArray(models)) {
        console.error('Ollama API returned invalid response structure:', data);
        return [];
      }

      return models.map((model: any) => ({
        id: model.name || model.id,
        name: model.name || model.id,
        display_name: model.name || model.id,
        modalities: ['text'],
        context_window: model.size ? undefined : undefined, // Ollama doesn't provide context window in tags
        supports_streaming: true,
        supports_vision: false,
        supports_image_gen: false,
      }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      return [];
    }
  }
}

