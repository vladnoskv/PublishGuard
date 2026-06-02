import type { Issue, ScanResult } from '@publishguard/core';
import { normalizeIssueFile } from './suppressions';

export interface SeverityQuickPickItem {
  label: string;
  description: string;
  severity: Issue['severity'];
}

const severityRank: Record<Issue['severity'], number> = {
  error: 3,
  warning: 2,
  info: 1,
};

export function filterScanResultBySeverity(result: ScanResult, threshold: Issue['severity']): ScanResult {
  const issues = result.issues.filter(
    (issue) => severityRank[issue.severity] >= severityRank[threshold],
  );

  return {
    ...result,
    issues,
    summary: {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
      infos: issues.filter((issue) => issue.severity === 'info').length,
    },
  };
}

export function buildSeverityQuickPickItems(current: Issue['severity']): SeverityQuickPickItem[] {
  return [
    {
      label: 'Errors only',
      description: current === 'error' ? 'Current' : 'Hide warnings and info findings',
      severity: 'error',
    },
    {
      label: 'Errors and warnings',
      description: current === 'warning' ? 'Current' : 'Hide info findings',
      severity: 'warning',
    },
    {
      label: 'All findings',
      description: current === 'info' ? 'Current' : 'Includes info, warnings, and errors',
      severity: 'info',
    },
  ];
}

export function normalizeExplorerIgnoreTarget(relativePath: string, isFolder: boolean): string {
  const normalized = normalizeIssueFile(relativePath);
  if (!isFolder) return normalized;
  return normalized === '.' ? '**' : `${normalized.replace(/\/+$/, '')}/**`;
}
