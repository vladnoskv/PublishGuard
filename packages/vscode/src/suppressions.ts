import * as path from 'node:path';
import type { Issue } from '@publishguard/core';

export type SuppressionScope =
  | 'exact'
  | 'rule-file'
  | 'file'
  | 'rule-folder'
  | 'folder'
  | 'rule';

export const SUPPRESSION_SCOPES: readonly SuppressionScope[] = [
  'exact',
  'rule-file',
  'file',
  'rule-folder',
  'folder',
  'rule',
];

export interface SuppressionEntry {
  rule?: string;
  file?: string;
  fingerprint?: string;
  reason: string;
}

export interface ProblemSuppressionAction {
  title: string;
  scope: SuppressionScope;
}

export function addIgnoreGlob(config: Record<string, unknown>, glob: string): Record<string, unknown> {
  const normalized = normalizeIssueFile(glob);
  const ignore = Array.isArray(config.ignore)
    ? config.ignore.filter((item): item is string => typeof item === 'string')
    : [];
  if (!ignore.includes(normalized)) {
    ignore.push(normalized);
  }
  return {
    ...config,
    ignore,
  };
}

export function buildSuppressionEntry(
  issue: Pick<Issue, 'rule' | 'file' | 'fingerprint'>,
  scope: SuppressionScope,
  reason: string,
): SuppressionEntry {
  const entry: SuppressionEntry = { reason: reason.trim() };
  const file = normalizeIssueFile(issue.file);

  if (scope === 'exact' || scope === 'rule-file' || scope === 'rule-folder' || scope === 'rule') {
    entry.rule = issue.rule;
  }
  if (scope === 'exact' && issue.fingerprint) {
    entry.fingerprint = issue.fingerprint;
  }
  if (scope === 'exact' || scope === 'rule-file' || scope === 'file') {
    entry.file = file;
  }
  if (scope === 'rule-folder' || scope === 'folder') {
    entry.file = getFolderGlob(file);
  }

  return entry;
}

export function getFolderGlob(file: string): string {
  const normalized = normalizeIssueFile(file);
  const dir = path.posix.dirname(normalized);
  return dir === '.' ? '**' : `${dir}/**`;
}

export function buildProblemSuppressionActions(rule: string, file: string): ProblemSuppressionAction[] {
  const normalizedRule = rule || 'issue';
  return [
    {
      title: `PublishGuard: Ignore ${normalizedRule} in this file`,
      scope: 'rule-file',
    },
    {
      title: 'PublishGuard: Ignore all PublishGuard issues in this file',
      scope: 'file',
    },
    {
      title: `PublishGuard: Ignore ${normalizedRule} in this folder`,
      scope: 'rule-folder',
    },
    {
      title: 'PublishGuard: Ignore all PublishGuard issues in this folder',
      scope: 'folder',
    },
    {
      title: `PublishGuard: Ignore ${normalizedRule} everywhere`,
      scope: 'rule',
    },
  ];
}

export function normalizeIssueFile(file: string | undefined): string {
  return (file || 'package.json').replace(/\\/g, '/').replace(/^\.\//, '');
}

export function isSuppressionScope(value: unknown): value is SuppressionScope {
  return typeof value === 'string' && SUPPRESSION_SCOPES.includes(value as SuppressionScope);
}
