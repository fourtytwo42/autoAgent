import { BaseTool } from './base.tool';
import { ToolDefinition, ToolResult, ToolContext } from './types';

export class CustomAPITool extends BaseTool {
  name = 'custom_api';
  description = 'Call a custom API endpoint';

  private baseUrl?: string;
  private apiKey?: string;

  constructor(name: string, description: string, baseUrl?: string, apiKey?: string) {
    super();
    this.name = name;
    this.description = description;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          endpoint: {
            type: 'string',
            description: 'API endpoint path',
          },
          method: {
            type: 'string',
            description: 'HTTP method (GET, POST, etc.)',
          },
          body: {
            type: 'object',
            description: 'Request body (for POST/PUT)',
          },
        },
        required: ['endpoint', 'method'],
      },
    };
  }

  async execute(
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult> {
    const { endpoint, method = 'GET', body } = parameters;

    if (!this.baseUrl) {
      return this.createErrorResult('Base URL not configured');
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        return this.createErrorResult(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return this.createSuccessResult(data);
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'API call failed'
      );
    }
  }
}

