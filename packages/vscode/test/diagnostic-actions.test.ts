import { describe, expect, test } from 'vitest';
import type { ScanResult } from '@publishguard/core';
import {
  buildSeverityQuickPickItems,
  filterScanResultBySeverity,
  normalizeExplorerIgnoreTarget,
} from '../src/diagnostic-actions';

function scanResultWithSeverities(): ScanResult {
  return {
    projectRoot: 'E:/workspace/project',
    packageType: 'npm',
    publishedFiles: [],
    issues: [
      {
        rule: 'secret',
        severity: 'error',
        category: 'security',
        file: 'src/secret.ts',
        message: 'Secret found',
      },
      {
        rule: 'ignore',
        severity: 'warning',
        category: 'ignore',
        file: 'src/index.ts',
        message: 'Ignore missing',
      },
      {
        rule: 'metadata',
        severity: 'info',
        category: 'metadata',
        file: 'package.json',
        message: 'Metadata advice',
      },
    ],
    summary: { errors: 1, warnings: 1, infos: 1 },
    durationMs: 12,
  };
}

describe('diagnostic actions', () => {
  test('filters scan results by severity and recomputes summary counts', () => {
    const result = filterScanResultBySeverity(scanResultWithSeverities(), 'warning');

    expect(result.issues.map((issue) => issue.severity)).toEqual(['error', 'warning']);
    expect(result.summary).toEqual({ errors: 1, warnings: 1, infos: 0 });
  });

  test('builds severity choices with the current threshold marked', () => {
    const items = buildSeverityQuickPickItems('warning');

    expect(items).toEqual([
      {
        label: 'Errors only',
        description: 'Hide warnings and info findings',
        severity: 'error',
      },
      {
        label: 'Errors and warnings',
        description: 'Current',
        severity: 'warning',
      },
      {
        label: 'All findings',
        description: 'Includes info, warnings, and errors',
        severity: 'info',
      },
    ]);
  });

  test('normalizes explorer files and folders to PublishGuard ignore globs', () => {
    expect(normalizeExplorerIgnoreTarget('src\\fixtures\\token.txt', false)).toBe('src/fixtures/token.txt');
    expect(normalizeExplorerIgnoreTarget('src\\fixtures', true)).toBe('src/fixtures/**');
  });
});
