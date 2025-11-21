import { BaseProvider } from './base.provider';
import { IModelProvider, ProviderModel } from '../provider.interface';
import { ModelConfig, ChatMessage, ChatMessageWithImages, ModelExecutionOptions } from '@/src/types/models';
import { getProviderConfig } from '@/src/config/models';

export class AnthropicProvider extends BaseProvider implements IModelProvider {
  private apiKey?: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';

  constructor(timeout: number = 60000) {
    super(timeout);
    const config = getProviderConfig('anthropic');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || timeout;
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const url = `${this.baseUrl}/messages`;

    // Anthropic uses a different message format
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body = {
      model: model.name,
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature ?? 0.7,
      system: systemMessage?.content || '',
      messages: conversationMessages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const url = `${this.baseUrl}/messages`;

    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body = {
      model: model.name,
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature ?? 0.7,
      system: systemMessage?.content || '',
      messages: conversationMessages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
      stream: true,
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
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
              if (parsed.type === 'content_block_delta') {
                const text = parsed.delta?.text;
                if (text) {
                  yield text;
                }
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

  async generateVision?(
    model: ModelConfig,
    messages: ChatMessageWithImages[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const url = `${this.baseUrl}/messages`;

    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Build messages with images
    const formattedMessages = conversationMessages.map((msg) => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: [
            { type: 'text', text: msg.content },
            ...msg.images.map((image) => ({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: image.startsWith('data:') ? image.split(',')[1] : image,
              },
            })),
          ],
        };
      }
      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      };
    });

    const body = {
      model: model.name,
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature ?? 0.7,
      system: systemMessage?.content || '',
      messages: formattedMessages,
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  supportsModality(modality: string): boolean {
    return modality === 'text' || modality === 'vision';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async listModels(): Promise<ProviderModel[]> {
    // Anthropic doesn't have a public models endpoint, return known models
    const knownModels: ProviderModel[] = [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'claude-3-5-sonnet-20241022',
        display_name: 'Claude 3.5 Sonnet',
        modalities: ['text', 'vision'],
        context_window: 200000,
        supports_streaming: true,
        supports_vision: true,
        supports_image_gen: false,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'claude-3-opus-20240229',
        display_name: 'Claude 3 Opus',
        modalities: ['text', 'vision'],
        context_window: 200000,
        supports_streaming: true,
        supports_vision: true,
        supports_image_gen: false,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'claude-3-sonnet-20240229',
        display_name: 'Claude 3 Sonnet',
        modalities: ['text', 'vision'],
        context_window: 200000,
        supports_streaming: true,
        supports_vision: true,
        supports_image_gen: false,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'claude-3-haiku-20240307',
        display_name: 'Claude 3 Haiku',
        modalities: ['text', 'vision'],
        context_window: 200000,
        supports_streaming: true,
        supports_vision: true,
        supports_image_gen: false,
      },
    ];

    return this.apiKey ? knownModels : [];
  }
}

