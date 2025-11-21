export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
}

export interface ToolContext {
  agent_id: string;
  task_id?: string;
  metadata?: Record<string, any>;
}

