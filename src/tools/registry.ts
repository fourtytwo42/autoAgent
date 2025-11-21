import { BaseTool } from './base.tool';
import { ToolDefinition } from './types';

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => tool.getDefinition());
  }

  getToolsForAgent(agentId: string, allowedTools: string[]): BaseTool[] {
    if (allowedTools.length === 0) {
      return [];
    }

    return allowedTools
      .map((name) => this.get(name))
      .filter((tool): tool is BaseTool => tool !== undefined);
  }
}

export const toolRegistry = new ToolRegistry();

