import { toolRegistry } from './registry';
import { WebSearchTool } from './webSearch.tool';
import { FilesystemTool } from './filesystem.tool';
import { env } from '@/src/config/env';

/**
 * Initialize and register all tools
 */
export function initializeTools(): void {
  // Register web search tool
  toolRegistry.register(new WebSearchTool());

  // Register filesystem tool with workspace path
  const workspacePath = env.FILESYSTEM_WORKSPACE_PATH || './workspace';
  toolRegistry.register(new FilesystemTool(workspacePath));

  console.log(`✅ Tools initialized. Filesystem workspace: ${workspacePath}`);
}

// Auto-initialize on import
initializeTools();

