import { describe, it, expect } from 'vitest';
import { loadConfig, parseSize } from '../src/config';

const REQUIRED_DEFAULT_RULE_SEVERITIES = {
  'env-file': 'error',
  'private-key': 'error',
  'source-map': 'warning',
  'credentials-file': 'error',
  'log-file': 'warning',
  'test-data': 'warning',
  'oversized-file': 'error',
  'large-file': 'warning',
  'large-package': 'warning',
  'missing-package-json': 'error',
  'invalid-package-json': 'error',
  'missing-readme': 'warning',
  'missing-license': 'warning',
  'missing-license-file': 'warning',
  'missing-repository': 'warning',
  'invalid-repository-url': 'warning',
  'missing-changelog': 'info',
  'missing-description': 'warning',
  'missing-ignore-file': 'warning',
  'empty-ignore-file': 'warning',
  'dangerous-negation': 'warning',
  'trailing-slash': 'info',
  'leading-slash': 'info',
  'missing-publisher': 'error',
  'missing-icon': 'warning',
  'missing-name': 'error',
  'missing-version': 'error',
  'invalid-version': 'error',
  'missing-vscode-engine': 'warning',
  'aws-access-key': 'error',
  'aws-secret-key': 'error',
  'github-token': 'error',
  'github-old-token': 'error',
  'npm-token': 'error',
  'private-key-header': 'error',
  'jwt-token': 'warning',
  'connection-string': 'error',
  'private-doc': 'info',
  'ds-store': 'info',
  'windows-thumbs': 'info',
  'vscode-settings': 'info',
  'coverage': 'warning',
  'temp-file': 'info',
  'missing-ignore-env': 'error',
  'missing-ignore-log': 'warning',
  'missing-ignore-node_modules': 'warning',
  'missing-ignore--node_modules': 'warning',
  'missing-ignore-git': 'error',
  'missing-ignore-pem': 'error',
  'missing-ignore-key': 'error',
  'missing-ignore-p12': 'error',
  'missing-ignore-pfx': 'error',
  'missing-ignore-credentials': 'error',
  'missing-ignore-secrets': 'error',
  'missing-ignore-jsmap': 'warning',
  'missing-ignore-cssmap': 'warning',
  'missing-ignore-tsmap': 'warning',
  'missing-ignore-coverage': 'warning',
  'missing-ignore-nyc_output': 'warning',
  'missing-ignore-test-data': 'info',
  'missing-ignore-__tests__': 'info',
  'missing-ignore-test': 'info',
  'missing-ignore-spec': 'info',
  'missing-ignore--DS_Store': 'info',
  'missing-ignore--Thumbsdb': 'info',
  'missing-ignore-vscode-test': 'warning',
  'missing-ignore-vsix': 'warning',
  'missing-ignore-tgz': 'warning',
  'missing-ignore-targz': 'warning',
  'dependency-floating-version': 'warning',
  'dependency-non-registry-source': 'warning',
  'dependency-vulnerability': 'error',
  'dependency-audit-unavailable': 'warning',
  'dependency-socket-alert': 'error',
  'dependency-socket-unavailable': 'warning',
} as const;

describe('Config', () => {
  it('should return default config when no .publishguardrc exists', () => {
    const config = loadConfig(__dirname);
    expect(config.rules['env-file']).toBe('error');
    expect(config.rules['missing-readme']).toBe('warning');
    expect(config.rules['test-data']).toBe('warning');
    expect(config.fileSize).toBeDefined();
    expect(config.fileSize?.warnThreshold).toBe('5MB');
  });

  it('covers all default scanner rule IDs including generated missing-ignore rules', () => {
    const config = loadConfig(__dirname);

    expect(config.rules).toMatchObject(REQUIRED_DEFAULT_RULE_SEVERITIES);
  });

  it('should return a fresh default config object each time', () => {
    const first = loadConfig(__dirname);
    first.rules['env-file'] = 'off';
    first.suppressions.push({ rule: 'aws-access-key', reason: 'local mutation' });

    const second = loadConfig(__dirname);
    expect(second.rules['env-file']).toBe('error');
    expect(second.suppressions).toEqual([]);
  });

  it('should parse size strings correctly', () => {
    expect(parseSize('1KB')).toBe(1024);
    expect(parseSize('2MB')).toBe(2 * 1024 * 1024);
    expect(parseSize('1GB')).toBe(1024 * 1024 * 1024);
    expect(parseSize('100B')).toBe(100);
  });

  it('should throw on invalid size format', () => {
    expect(() => parseSize('invalid')).toThrow();
  });
});
