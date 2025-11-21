export type ProviderType = 'openai' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio';
export type Modality = 'text' | 'vision' | 'image_gen';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  modalities: Modality[];
  contextWindow?: number;
  qualityScore: number;
  reliabilityScore: number;
  metadata: Record<string, any>;
}

export interface ModelExecutionOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  tools?: ToolDefinition[];
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

