import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Severity } from './types';

export interface ScanOptions {
  projectRoot: string;
  packageType?: 'npm' | 'vscode' | 'both';
  scanMode?: ScanMode;
  skip?: string[];
  failFast?: boolean;
  stagedFiles?: string[];
  includeGitIgnored?: boolean;
  dependencyAudit?: boolean;
  socketDev?: boolean;
  snyk?: boolean;
}

export type ScanMode = 'quick' | 'full' | 'deep';

export interface ExampleFilesConfig {
  scanUnpublished: boolean;
  scanGitHistory: boolean;
  dummySecretSeverity: Severity | 'off';
  patterns: string[];
}

export interface SuppressionConfig {
  rule?: string;
  file?: string;
  fingerprint?: string;
  reason: string;
}

export interface PublishGuardConfig {
  includeGitIgnored: boolean;
  scanMode: ScanMode;
  rules: Record<string, Severity | 'off' | [Severity, Record<string, unknown>]>;
  ignore: string[];
  suppressions: SuppressionConfig[];
  secretPatterns?: {
    custom?: Array<{ name: string; regex: string; severity?: Severity }>;
  };
  fileSize?: {
    warnThreshold: string;
    errorThreshold: string;
  };
  dependencyAudit?: {
    enabled: boolean;
  };
  socketDev?: {
    enabled: boolean;
  };
  snyk?: {
    enabled: boolean;
  };
  exampleFiles: ExampleFilesConfig;
}

const DEFAULT_CONFIG: PublishGuardConfig = {
  includeGitIgnored: false,
  scanMode: 'full',
  rules: {
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
    'vscode-diagnostic-provider-missing-refresh-command': 'error',
    'vscode-language-server-missing-restart-command': 'error',
    'vscode-scm-provider-missing-refresh-command': 'error',
    'vscode-formatter-missing-command': 'warning',
    'vscode-test-provider-missing-refresh-command': 'warning',
    'vscode-debugger-missing-command': 'warning',
    'vscode-view-provider-missing-refresh-command': 'warning',
    'vscode-auth-provider-missing-account-command': 'warning',
    'vscode-task-provider-missing-refresh-command': 'warning',
    'vscode-notebook-provider-missing-command': 'warning',
    'vscode-terminal-provider-missing-command': 'warning',
    'vscode-webview-missing-csp': 'warning',
    'vscode-web-extension-node-api-usage': 'error',
    'vscode-command-missing-activation-event': 'warning',
    'vscode-capability-keyword-only': 'warning',
    'aws-access-key': 'error',
    'aws-secret-key': 'error',
    'github-token': 'error',
    'github-old-token': 'error',
    'npm-token': 'error',
    'gitlab-token': 'error',
    'slack-token': 'error',
    'stripe-secret-key': 'error',
    'google-api-key': 'error',
    'sendgrid-api-key': 'error',
    'openai-api-key': 'error',
    'digitalocean-token': 'error',
    'private-key-header': 'error',
    'jwt-token': 'warning',
    'connection-string': 'error',
    'private-doc': 'info',
    'ds-store': 'info',
    'windows-thumbs': 'info',
    'vscode-settings': 'info',
    'coverage': 'warning',
    'temp-file': 'info',
    'dependency-floating-version': 'warning',
    'dependency-non-registry-source': 'warning',
    'dependency-vulnerability': 'error',
    'dependency-audit-unavailable': 'warning',
    'dependency-socket-alert': 'error',
    'dependency-socket-unavailable': 'warning',
    'dependency-snyk-vulnerability': 'error',
    'dependency-snyk-unavailable': 'warning',
  },
  ignore: [],
  suppressions: [],
  fileSize: {
    warnThreshold: '5MB',
    errorThreshold: '50MB',
  },
  dependencyAudit: {
    enabled: false,
  },
  socketDev: {
    enabled: false,
  },
  snyk: {
    enabled: false,
  },
  exampleFiles: {
    scanUnpublished: false,
    scanGitHistory: true,
    dummySecretSeverity: 'info',
    patterns: [
      'docs/**',
      'doc/**',
      'examples/**',
      'example/**',
      'samples/**',
      'sample/**',
      '**/*.example.*',
      '**/*.sample.*',
    ],
  },
};

export function loadConfig(projectRoot: string): PublishGuardConfig {
  const rcPath = path.join(projectRoot, '.publishguardrc.json');
  if (fs.existsSync(rcPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(rcPath, 'utf-8')) as Partial<PublishGuardConfig>;
      return mergeConfig(DEFAULT_CONFIG, userConfig);
    } catch {
      return mergeConfig(DEFAULT_CONFIG, {});
    }
  }
  return mergeConfig(DEFAULT_CONFIG, {});
}

function mergeConfig(base: PublishGuardConfig, override: Partial<PublishGuardConfig>): PublishGuardConfig {
  const defaultFileSize = { warnThreshold: '5MB', errorThreshold: '50MB' };
  const baseFS = base.fileSize ?? defaultFileSize;
  const overrideFS = (override.fileSize ?? {}) as Partial<typeof defaultFileSize>;
  const baseAudit = base.dependencyAudit ?? { enabled: false };
  const overrideAudit = (override.dependencyAudit ?? {}) as Partial<{ enabled: boolean }>;
  const baseSocketDev = base.socketDev ?? { enabled: false };
  const overrideSocketDev = (override.socketDev ?? {}) as Partial<{ enabled: boolean }>;
  const baseSnyk = base.snyk ?? { enabled: false };
  const overrideSnyk = (override.snyk ?? {}) as Partial<{ enabled: boolean }>;
  const baseExampleFiles = base.exampleFiles ?? DEFAULT_CONFIG.exampleFiles;
  const overrideExampleFiles = (override.exampleFiles ?? {}) as Partial<ExampleFilesConfig>;
  return {
    includeGitIgnored: override.includeGitIgnored ?? base.includeGitIgnored,
    scanMode: normalizeScanMode(override.scanMode ?? base.scanMode),
    rules: { ...base.rules, ...override.rules },
    ignore: [...base.ignore, ...(override.ignore ?? [])],
    suppressions: [...base.suppressions, ...(override.suppressions ?? [])],
    secretPatterns: override.secretPatterns ?? base.secretPatterns,
    fileSize: {
      warnThreshold: overrideFS.warnThreshold ?? baseFS.warnThreshold,
      errorThreshold: overrideFS.errorThreshold ?? baseFS.errorThreshold,
    },
    dependencyAudit: {
      enabled: overrideAudit.enabled ?? baseAudit.enabled,
    },
    socketDev: {
      enabled: overrideSocketDev.enabled ?? baseSocketDev.enabled,
    },
    snyk: {
      enabled: overrideSnyk.enabled ?? baseSnyk.enabled,
    },
    exampleFiles: {
      scanUnpublished: overrideExampleFiles.scanUnpublished ?? baseExampleFiles.scanUnpublished,
      scanGitHistory: overrideExampleFiles.scanGitHistory ?? baseExampleFiles.scanGitHistory,
      dummySecretSeverity: overrideExampleFiles.dummySecretSeverity ?? baseExampleFiles.dummySecretSeverity,
      patterns: [
        ...baseExampleFiles.patterns,
        ...(overrideExampleFiles.patterns ?? []),
      ],
    },
  };
}

function normalizeScanMode(scanMode: unknown): ScanMode {
  if (scanMode === 'quick' || scanMode === 'full' || scanMode === 'deep') return scanMode;
  return 'full';
}

export function getDefaultConfig(): PublishGuardConfig {
  return mergeConfig(DEFAULT_CONFIG, {});
}

export function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  if (!match) throw new Error(`Invalid size format: ${sizeStr}`);
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  return value * multipliers[unit];
}
