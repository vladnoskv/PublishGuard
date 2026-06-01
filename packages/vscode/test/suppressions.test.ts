import { describe, expect, it } from 'vitest';
import type { Issue } from '@publishguard/core';
import {
  addIgnoreGlob,
  buildProblemSuppressionActions,
  buildSuppressionEntry,
  getFolderGlob,
  isSuppressionScope,
} from '../src/suppressions';

const issue: Issue = {
  rule: 'aws-access-key',
  severity: 'error',
  category: 'secrets',
  file: 'src/config/secrets.ts',
  message: 'AWS key detected',
  fingerprint: 'aws-access-key:src/config/secrets.ts:3:12',
};

describe('suppression helpers', () => {
  it('builds exact fingerprint suppressions for a single finding', () => {
    expect(buildSuppressionEntry(issue, 'exact', 'Reviewed false positive')).toEqual({
      rule: 'aws-access-key',
      file: 'src/config/secrets.ts',
      fingerprint: 'aws-access-key:src/config/secrets.ts:3:12',
      reason: 'Reviewed false positive',
    });
  });

  it('builds scoped suppressions for rule, file, folder, and file-only ignores', () => {
    expect(buildSuppressionEntry(issue, 'rule-file', 'Accepted in this file')).toEqual({
      rule: 'aws-access-key',
      file: 'src/config/secrets.ts',
      reason: 'Accepted in this file',
    });
    expect(buildSuppressionEntry(issue, 'file', 'Ignore generated file')).toEqual({
      file: 'src/config/secrets.ts',
      reason: 'Ignore generated file',
    });
    expect(buildSuppressionEntry(issue, 'rule-folder', 'Accepted in config folder')).toEqual({
      rule: 'aws-access-key',
      file: 'src/config/**',
      reason: 'Accepted in config folder',
    });
    expect(buildSuppressionEntry(issue, 'rule', 'Rule disabled for this project')).toEqual({
      rule: 'aws-access-key',
      reason: 'Rule disabled for this project',
    });
  });

  it('builds stable folder globs for root files and nested files', () => {
    expect(getFolderGlob('README.md')).toBe('**');
    expect(getFolderGlob('src/config/secrets.ts')).toBe('src/config/**');
  });

  it('describes Problems quick-fix suppression actions by file, folder, and rule scope', () => {
    expect(buildProblemSuppressionActions('aws-access-key', 'src/config/secrets.ts')).toEqual([
      {
        title: 'PublishGuard: Ignore aws-access-key in this file',
        scope: 'rule-file',
      },
      {
        title: 'PublishGuard: Ignore all PublishGuard issues in this file',
        scope: 'file',
      },
      {
        title: 'PublishGuard: Ignore aws-access-key in this folder',
        scope: 'rule-folder',
      },
      {
        title: 'PublishGuard: Ignore all PublishGuard issues in this folder',
        scope: 'folder',
      },
      {
        title: 'PublishGuard: Ignore aws-access-key everywhere',
        scope: 'rule',
      },
    ]);
  });

  it('validates suppression scope command arguments', () => {
    expect(isSuppressionScope('rule-folder')).toBe(true);
    expect(isSuppressionScope('everything')).toBe(false);
    expect(isSuppressionScope(undefined)).toBe(false);
  });

  it('adds unique PublishGuard ignore globs to config objects', () => {
    const config = { ignore: ['dist/**'], suppressions: [] };
    expect(addIgnoreGlob(config, 'src/config/secrets.ts')).toEqual({
      ignore: ['dist/**', 'src/config/secrets.ts'],
      suppressions: [],
    });
    expect(addIgnoreGlob(config, 'dist/**')).toEqual(config);
    expect(addIgnoreGlob({ ignore: 'bad' }, 'logs/**')).toEqual({
      ignore: ['logs/**'],
    });
  });
});
