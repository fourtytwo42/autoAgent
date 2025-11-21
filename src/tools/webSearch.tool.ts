import { BaseTool } from './base.tool';
import { ToolDefinition, ToolResult, ToolContext } from './types';

export class WebSearchTool extends BaseTool {
  name = 'web_search';
  description = 'Search the web for information';

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return',
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult> {
    const { query, max_results = 5 } = parameters;

    if (!query || typeof query !== 'string') {
      return this.createErrorResult('Query parameter is required');
    }

    try {
      // For now, return mock results
      // In production, would integrate with a real search API (e.g., SerpAPI, Google Custom Search)
      const mockResults = [
        {
          title: `Search result for: ${query}`,
          url: 'https://example.com/result1',
          snippet: `Information about ${query}`,
        },
        {
          title: `Another result for: ${query}`,
          url: 'https://example.com/result2',
          snippet: `More information about ${query}`,
        },
      ].slice(0, max_results);

      return this.createSuccessResult({
        query,
        results: mockResults,
        count: mockResults.length,
      });
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Web search failed'
      );
    }
  }
}

