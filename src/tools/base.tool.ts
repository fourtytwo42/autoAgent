import { ToolDefinition, ToolResult, ToolContext } from './types';

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;

  abstract getDefinition(): ToolDefinition;

  abstract execute(
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult>;

  protected createSuccessResult(output: any): ToolResult {
    return {
      success: true,
      output,
    };
  }

  protected createErrorResult(error: string): ToolResult {
    return {
      success: false,
      error,
    };
  }
}

