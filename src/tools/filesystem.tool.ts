import { BaseTool } from './base.tool';
import { ToolDefinition, ToolResult, ToolContext } from './types';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

export class FilesystemTool extends BaseTool {
  name = 'filesystem';
  description = 'Read and write files, list directories';

  private allowedPaths: string[] = [];

  constructor(allowedPaths: string[] = []) {
    super();
    this.allowedPaths = allowedPaths;
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Operation: read, write, list, stat',
          },
          path: {
            type: 'string',
            description: 'File or directory path',
          },
          content: {
            type: 'string',
            description: 'Content to write (for write operation)',
          },
        },
        required: ['operation', 'path'],
      },
    };
  }

  private isPathAllowed(path: string): boolean {
    if (this.allowedPaths.length === 0) {
      return false; // No paths allowed by default for security
    }

    const resolvedPath = require('path').resolve(path);
    return this.allowedPaths.some((allowed) =>
      resolvedPath.startsWith(require('path').resolve(allowed))
    );
  }

  async execute(
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult> {
    const { operation, path, content } = parameters;

    if (!this.isPathAllowed(path)) {
      return this.createErrorResult('Path not allowed');
    }

    try {
      switch (operation) {
        case 'read':
          const fileContent = await readFile(path, 'utf-8');
          return this.createSuccessResult({ content: fileContent });

        case 'write':
          if (!content) {
            return this.createErrorResult('Content is required for write operation');
          }
          await writeFile(path, content, 'utf-8');
          return this.createSuccessResult({ success: true });

        case 'list':
          const entries = await readdir(path);
          const stats = await Promise.all(
            entries.map(async (entry) => {
              const entryPath = join(path, entry);
              const entryStat = await stat(entryPath);
              return {
                name: entry,
                type: entryStat.isDirectory() ? 'directory' : 'file',
                size: entryStat.size,
              };
            })
          );
          return this.createSuccessResult({ entries: stats });

        case 'stat':
          const fileStat = await stat(path);
          return this.createSuccessResult({
            exists: true,
            isDirectory: fileStat.isDirectory(),
            isFile: fileStat.isFile(),
            size: fileStat.size,
            modified: fileStat.mtime,
          });

        default:
          return this.createErrorResult(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Filesystem operation failed'
      );
    }
  }
}

