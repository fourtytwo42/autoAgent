export type ProviderType = 'openai' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio';
export type Modality = 'text' | 'vision' | 'image_gen';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  display_name: string;
  modalities: Modality[];
  contextWindow?: number;
  qualityScore: number;
  reliabilityScore: number;
  metadata: Record<string, any>;
  is_enabled?: boolean;
  avg_latency_ms?: number;
  cost_per_1k_tokens?: number;
  last_benchmarked_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface ModelExecutionOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  tools?: ToolDefinition[];
  web_enabled?: boolean; // Enable web search for supported models (OpenAI GPT-5+)
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 encoded images for vision models
}

export interface ChatMessageWithImages extends ChatMessage {
  images: string[];
}

export interface ImageResult {
  url?: string;
  data?: string; // Base64 encoded image data
}

export interface ModelExecutor {
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
}

// Database row types (matches schema)
export interface ModelRow {
  id: string;
  name: string;
  provider: ProviderType;
  display_name: string;
  is_enabled: boolean;
  modalities: string[];
  context_window: number | null;
  avg_latency_ms: number | null;
  cost_per_1k_tokens: number | null;
  quality_score: number | null;
  reliability_score: number | null;
  last_benchmarked_at: Date | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

