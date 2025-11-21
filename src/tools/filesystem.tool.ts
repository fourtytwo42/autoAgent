import { BaseTool } from './base.tool';
import { ToolDefinition, ToolResult, ToolContext } from './types';
import { readFile, writeFile, readdir, stat, mkdir, unlink, rmdir, rename, copyFile } from 'fs/promises';
import { join, resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
import { env } from '@/src/config/env';

export class FilesystemTool extends BaseTool {
  name = 'filesystem';
  description = 'Read and write files, list directories, create/delete files and folders, move/copy files';

  private workspacePath: string;

  constructor(workspacePath?: string) {
    super();
    this.workspacePath = workspacePath || env.FILESYSTEM_WORKSPACE_PATH || './workspace';
    // Resolve to absolute path
    this.workspacePath = resolve(this.workspacePath);
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
            description: 'Operation: read, write, list, stat, mkdir, delete, move, copy, exists',
          },
          path: {
            type: 'string',
            description: 'File or directory path (relative to workspace or absolute within workspace)',
          },
          content: {
            type: 'string',
            description: 'Content to write (for write operation)',
          },
          target: {
            type: 'string',
            description: 'Target path (for move/copy operations)',
          },
          recursive: {
            type: 'boolean',
            description: 'Recursive operation (for mkdir, delete)',
          },
        },
        required: ['operation', 'path'],
      },
    };
  }

  private resolvePath(inputPath: string): string {
    // If path is absolute and within workspace, use it
    const resolved = resolve(inputPath);
    if (resolved.startsWith(this.workspacePath)) {
      return resolved;
    }
    
    // If path is relative, resolve relative to workspace
    if (!inputPath.startsWith('/')) {
      return resolve(this.workspacePath, inputPath);
    }
    
    // Absolute path outside workspace - not allowed
    throw new Error(`Path ${inputPath} is outside workspace ${this.workspacePath}`);
  }

  private isPathAllowed(path: string): boolean {
    try {
      const resolved = this.resolvePath(path);
      return resolved.startsWith(this.workspacePath);
    } catch {
      return false;
    }
  }

  async execute(
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult> {
    const { operation, path, content, target, recursive } = parameters;

    if (!this.isPathAllowed(path)) {
      return this.createErrorResult(`Path not allowed. Must be within workspace: ${this.workspacePath}`);
    }

    try {
      const resolvedPath = this.resolvePath(path);

      switch (operation) {
        case 'read':
          const fileContent = await readFile(resolvedPath, 'utf-8');
          return this.createSuccessResult({ content: fileContent, path: resolvedPath });

        case 'write':
          if (!content && content !== '') {
            return this.createErrorResult('Content is required for write operation');
          }
          // Ensure directory exists
          const writeDir = dirname(resolvedPath);
          if (!existsSync(writeDir)) {
            await mkdir(writeDir, { recursive: true });
          }
          await writeFile(resolvedPath, content || '', 'utf-8');
          return this.createSuccessResult({ success: true, path: resolvedPath });

        case 'list':
          const entries = await readdir(resolvedPath);
          const stats = await Promise.all(
            entries.map(async (entry) => {
              const entryPath = join(resolvedPath, entry);
              const entryStat = await stat(entryPath);
              return {
                name: entry,
                type: entryStat.isDirectory() ? 'directory' : 'file',
                size: entryStat.size,
                modified: entryStat.mtime,
              };
            })
          );
          return this.createSuccessResult({ entries: stats, path: resolvedPath });

        case 'stat':
          const fileStat = await stat(resolvedPath);
          return this.createSuccessResult({
            exists: true,
            isDirectory: fileStat.isDirectory(),
            isFile: fileStat.isFile(),
            size: fileStat.size,
            modified: fileStat.mtime,
            created: fileStat.birthtime,
            path: resolvedPath,
          });

        case 'exists':
          const exists = existsSync(resolvedPath);
          return this.createSuccessResult({ exists, path: resolvedPath });

        case 'mkdir':
          await mkdir(resolvedPath, { recursive: recursive !== false });
          return this.createSuccessResult({ success: true, path: resolvedPath });

        case 'delete':
          const deleteStat = await stat(resolvedPath);
          if (deleteStat.isDirectory()) {
            if (recursive) {
              // For recursive delete, we'd need a helper function
              // For now, only allow deleting empty directories
              await rmdir(resolvedPath);
            } else {
              await rmdir(resolvedPath);
            }
          } else {
            await unlink(resolvedPath);
          }
          return this.createSuccessResult({ success: true, path: resolvedPath });

        case 'move':
          if (!target) {
            return this.createErrorResult('Target path is required for move operation');
          }
          if (!this.isPathAllowed(target)) {
            return this.createErrorResult(`Target path not allowed. Must be within workspace: ${this.workspacePath}`);
          }
          const targetPath = this.resolvePath(target);
          // Ensure target directory exists
          const targetDir = dirname(targetPath);
          if (!existsSync(targetDir)) {
            await mkdir(targetDir, { recursive: true });
          }
          await rename(resolvedPath, targetPath);
          return this.createSuccessResult({ success: true, from: resolvedPath, to: targetPath });

        case 'copy':
          if (!target) {
            return this.createErrorResult('Target path is required for copy operation');
          }
          if (!this.isPathAllowed(target)) {
            return this.createErrorResult(`Target path not allowed. Must be within workspace: ${this.workspacePath}`);
          }
          const copyTargetPath = this.resolvePath(target);
          // Ensure target directory exists
          const copyTargetDir = dirname(copyTargetPath);
          if (!existsSync(copyTargetDir)) {
            await mkdir(copyTargetDir, { recursive: true });
          }
          await copyFile(resolvedPath, copyTargetPath);
          return this.createSuccessResult({ success: true, from: resolvedPath, to: copyTargetPath });

        default:
          return this.createErrorResult(`Unknown operation: ${operation}. Supported: read, write, list, stat, exists, mkdir, delete, move, copy`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Filesystem operation failed'
      );
    }
  }
}

