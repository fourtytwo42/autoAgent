import { BaseProvider } from './base.provider';
import { IModelProvider, ProviderModel } from '../provider.interface';
import { ModelConfig, ChatMessage, ModelExecutionOptions } from '@/src/types/models';
import { getProviderConfig } from '@/src/config/models';

export class GroqProvider extends BaseProvider implements IModelProvider {
  private _apiKey?: string;
  private baseUrl: string = 'https://api.groq.com/openai/v1';

  constructor(timeout: number = 30000) {
    super(timeout);
    this.loadConfig().catch(console.error);
  }

  private async loadConfig(): Promise<void> {
    const config = await getProviderConfig('groq');
    this._apiKey = config.apiKey;
    this.timeout = config.timeout || this.timeout;
  }

  async ensureConfig(): Promise<void> {
    if (!this._apiKey) {
      await this.loadConfig();
    }
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    await this.ensureConfig();
    if (!this._apiKey) {
      throw new Error('Groq API key not configured. Please set it in the configuration page.');
    }

    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model: model.name,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: false,
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this._apiKey}`,
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    await this.ensureConfig();
    if (!this._apiKey) {
      throw new Error('Groq API key not configured. Please set it in the configuration page.');
    }

    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model: model.name,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this._apiKey}`,
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  supportsModality(modality: string): boolean {
    return modality === 'text';
  }

  async isAvailable(): Promise<boolean> {
    await this.ensureConfig();
    return !!this._apiKey;
  }

  async listModels(): Promise<ProviderModel[]> {
    await this.ensureConfig();
    if (!this._apiKey) {
      return [];
    }

    try {
      const response = await this.withTimeout(
        fetch(`${this.baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this._apiKey}`,
          },
        }),
        this.timeout
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.data || []).map((model: any) => ({
        id: model.id,
        name: model.id,
        display_name: model.id,
        modalities: ['text'],
        context_window: undefined,
        supports_streaming: true,
        supports_vision: false,
        supports_image_gen: false,
      }));
    } catch (error) {
      console.error('Error fetching Groq models:', error);
      return [];
    }
  }
}
