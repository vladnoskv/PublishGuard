import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Issue } from '../types';

export interface FileSizeOptions {
  files: string[];
  rootDir: string;
  warnThreshold?: number;
  errorThreshold?: number;
}

export function scanFileSizes(options: FileSizeOptions): Issue[] {
  const {
    files,
    rootDir,
    warnThreshold = 5 * 1024 * 1024,
    errorThreshold = 50 * 1024 * 1024,
  } = options;
  const issues: Issue[] = [];
  let totalSize = 0;

  for (const relPath of files) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) continue;
    totalSize += stat.size;

    if (stat.size > errorThreshold) {
      issues.push({
        rule: 'oversized-file',
        severity: 'error',
        category: 'file-size',
        file: relPath,
        message: `${relPath} is ${formatBytes(stat.size)} — this exceeds the ${formatBytes(errorThreshold)} limit and may cause publish failures.`,
        suggestion: `Add "${relPath}" to your ignore file or reduce its size.`,
      });
    } else if (stat.size > warnThreshold) {
      issues.push({
        rule: 'large-file',
        severity: 'warning',
        category: 'file-size',
        file: relPath,
        message: `${relPath} is ${formatBytes(stat.size)} — consider excluding large assets from your published package.`,
        suggestion: `Add "${relPath}" to your ignore file if it is not needed at runtime.`,
      });
    }
  }

  if (totalSize > 100 * 1024 * 1024) {
    issues.push({
      rule: 'large-package',
      severity: 'warning',
      category: 'file-size',
      file: '',
      message: `Total package size is ${formatBytes(totalSize)} — this is large and may lead to slower installs.`,
      suggestion: 'Exclude unnecessary files and assets from the publish list.',
    });
  }

  return issues;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
