import { BaseProvider } from './base.provider';
import { IModelProvider, ProviderModel } from '../provider.interface';
import { ModelConfig, ChatMessage, ModelExecutionOptions } from '@/src/types/models';
import { getProviderConfig } from '@/src/config/models';

export class LMStudioProvider extends BaseProvider implements IModelProvider {
  private baseUrl: string;

  constructor(timeout: number = 120000) {
    super(timeout);
    const config = getProviderConfig('lmstudio');
    this.baseUrl = config.baseUrl || 'http://192.168.50.238:1234';
    this.timeout = config.timeout || 120000; // Default 2 minutes for network
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    // LM Studio uses OpenAI-compatible API
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
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`LM Studio API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;

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
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`LM Studio API error: ${error}`);
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
    return modality === 'text'; // LM Studio is primarily text
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
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
        fetch(`${this.baseUrl}/v1/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        this.timeout
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`LM Studio API error (${response.status}):`, errorText);
        return [];
      }

      const data = await response.json();
      
      // LM Studio uses OpenAI-compatible format: { data: [...] }
      const models = data.data || [];
      
      if (!Array.isArray(models)) {
        console.error('LM Studio API returned invalid response structure:', data);
        return [];
      }

      return models.map((model: any) => ({
        id: model.id || model.name,
        name: model.id || model.name,
        display_name: model.id || model.name,
        modalities: ['text'],
        context_window: undefined,
        supports_streaming: true,
        supports_vision: false,
        supports_image_gen: false,
      }));
    } catch (error) {
      console.error('Error fetching LM Studio models:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
        // Network errors are common with remote LM Studio instances
        if (error.message.includes('fetch') || error.message.includes('network')) {
          console.error('Network error - check if LM Studio is running and accessible at:', this.baseUrl);
        }
      }
      return [];
    }
  }
}

