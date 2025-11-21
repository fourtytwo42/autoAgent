import { BaseProvider } from './base.provider';
import { IModelProvider, ProviderModel } from '../provider.interface';
import { ModelConfig, ChatMessage, ChatMessageWithImages, ModelExecutionOptions } from '@/src/types/models';
import { getProviderConfig } from '@/src/config/models';

export class OpenAIProvider extends BaseProvider implements IModelProvider {
  private apiKey?: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor(timeout: number = 60000) {
    super(timeout);
    const config = getProviderConfig('openai');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || timeout;
  }

  async generateText(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
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
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
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
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
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

  async generateVision?(
    model: ModelConfig,
    messages: ChatMessageWithImages[],
    options?: ModelExecutionOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const url = `${this.baseUrl}/chat/completions`;

    // Build messages with images
    const formattedMessages = messages.map((msg) => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...msg.images.map((image) => ({
              type: 'image_url',
              image_url: {
                url: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
              },
            })),
          ],
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });

    const body = {
      model: model.name,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    };

    const response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      }),
      this.timeout
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  supportsModality(modality: string): boolean {
    // OpenAI supports text and vision (for vision-capable models)
    return modality === 'text' || modality === 'vision';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async listModels(): Promise<ProviderModel[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await this.withTimeout(
        fetch(`${this.baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
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
        modalities: this.getModalitiesFromModel(model.id),
        context_window: model.context_window,
        supports_streaming: true,
        supports_vision: model.id.includes('vision') || model.id.includes('gpt-4'),
        supports_image_gen: false,
      }));
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      return [];
    }
  }

  private getModalitiesFromModel(modelId: string): string[] {
    const modalities: string[] = ['text'];
    if (modelId.includes('vision') || modelId.includes('gpt-4')) {
      modalities.push('vision');
    }
    return modalities;
  }
}

