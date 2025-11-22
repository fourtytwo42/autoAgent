import { BaseProvider } from './base.provider';
import { IModelProvider, ProviderModel } from '../provider.interface';
import { ModelConfig, ChatMessage, ChatMessageWithImages, ModelExecutionOptions } from '@/src/types/models';
import { getProviderConfig } from '@/src/config/models';

export class OpenAIProvider extends BaseProvider implements IModelProvider {
  private _apiKey?: string;
  private baseUrl: string = 'https://api.openai.com/v1';
  
  constructor(timeout: number = 60000) {
    super(timeout);
    this.loadConfig().catch(console.error); // Load async, don't block constructor
  }

  private async loadConfig(): Promise<void> {
    const config = await getProviderConfig('openai');
    this._apiKey = config.apiKey;
    this.timeout = config.timeout || this.timeout;
  }

  get apiKey(): string | undefined {
    return this._apiKey;
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
      throw new Error('OpenAI API key not configured. Please set it in the configuration page.');
    }

    // Check if web search is enabled and model supports it (GPT-5+ OpenAI models)
    const webEnabled = options?.web_enabled === true;
    const supportsWebSearch = this.supportsWebSearch(model.name);
    
    // Use Responses API for GPT-5+ models when web search is enabled
    const useResponsesAPI = webEnabled && supportsWebSearch;
    const url = useResponsesAPI 
      ? `${this.baseUrl}/responses` 
      : `${this.baseUrl}/chat/completions`;

    // Build base body
    const body: any = {
      model: model.name,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: false,
    };

    // Add tools for Responses API when web search is enabled
    if (useResponsesAPI) {
      body.tools = [
        {
          type: 'web_search',
        },
      ];
    }

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
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Handle Responses API format
    if (useResponsesAPI) {
      // Responses API returns content differently
      return data.content?.[0]?.text || data.choices?.[0]?.message?.content || '';
    }
    
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Check if a model supports web search (GPT-5+ models)
   */
  private supportsWebSearch(modelName: string): boolean {
    // GPT-5+ models support web search
    return modelName.includes('gpt-5') || modelName.includes('gpt-4-turbo') || modelName.includes('gpt-4o');
  }

  async *generateTextStream(
    model: ModelConfig,
    messages: ChatMessage[],
    options?: ModelExecutionOptions
  ): AsyncIterable<string> {
    await this.ensureConfig();
    if (!this._apiKey) {
      throw new Error('OpenAI API key not configured. Please set it in the configuration page.');
    }

    // Check if web search is enabled and model supports it
    const webEnabled = options?.web_enabled === true;
    const supportsWebSearch = this.supportsWebSearch(model.name);
    
    // Use Responses API for GPT-5+ models when web search is enabled
    const useResponsesAPI = webEnabled && supportsWebSearch;
    const url = useResponsesAPI 
      ? `${this.baseUrl}/responses` 
      : `${this.baseUrl}/chat/completions`;

    // Build base body
    const body: any = {
      model: model.name,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    };

    // Add tools for Responses API when web search is enabled
    if (useResponsesAPI) {
      body.tools = [
        {
          type: 'web_search',
        },
      ];
    }

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
              // Handle both Responses API and Chat Completions format
              const content = parsed.content?.[0]?.text || parsed.choices?.[0]?.delta?.content;
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
          Authorization: `Bearer ${this._apiKey}`,
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

