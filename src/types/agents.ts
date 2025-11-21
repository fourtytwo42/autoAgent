export interface AgentType {
  id: string;
  description: string;
  system_prompt: string;
  modalities: string[];
  interests: Record<string, any>;
  permissions: Record<string, any>;
  is_core: boolean;
  is_enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface AgentMetrics {
  agent_id: string;
  usage_count: number;
  avg_score: number | null;
  avg_latency_ms: number | null;
  last_used_at: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface AgentModelPreference {
  id: string;
  agent_id: string;
  model_id: string;
  priority: number;
  weight: number;
  created_at?: Date;
}

export interface AgentExecutionContext {
  agent_id: string;
  model_id: string;
  input: Record<string, any>;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AgentOutput {
  agent_id: string;
  model_id: string;
  input_summary: string;
  output: string;
  latency_ms: number;
  metadata?: Record<string, any>;
}

// Database row types (matches schema)
export interface AgentTypeRow {
  id: string;
  description: string;
  system_prompt: string;
  modalities: string[];
  interests: Record<string, any>;
  permissions: Record<string, any>;
  is_core: boolean;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AgentMetricsRow {
  agent_id: string;
  usage_count: number;
  avg_score: number | null;
  avg_latency_ms: number | null;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AgentModelPrefRow {
  id: string;
  agent_id: string;
  model_id: string;
  priority: number;
  weight: number;
  created_at: Date;
}

