import type { ExampleFilesConfig, Issue, PublishGuardConfig } from '@publishguard/core';

export interface SettingsMessage {
  command: 'saveSettings' | 'runScan';
  scanOnSave: boolean;
  blockPublishOnError: boolean;
  includeGitIgnored: boolean;
  dependencyAudit: boolean;
  socketDev: boolean;
  snyk: boolean;
  severityThreshold: Issue['severity'];
  ignore: string[];
  suppressions: Array<{ rule?: string; file?: string; fingerprint?: string; reason: string }>;
  rules: Record<string, Issue['severity'] | 'off'>;
  exampleFiles: ExampleFilesConfig;
}

export function normalizeSettingsMessage(value: unknown): SettingsMessage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.command !== 'saveSettings' && candidate.command !== 'runScan') return undefined;

  return {
    command: candidate.command,
    scanOnSave: candidate.scanOnSave === true,
    blockPublishOnError: candidate.blockPublishOnError === true,
    includeGitIgnored: candidate.includeGitIgnored === true,
    dependencyAudit: candidate.dependencyAudit === true,
    socketDev: candidate.socketDev === true,
    snyk: candidate.snyk === true,
    severityThreshold: isReportSeverity(candidate.severityThreshold) ? candidate.severityThreshold : 'info',
    ignore: normalizeStringList(candidate.ignore),
    suppressions: normalizeSuppressions(candidate.suppressions),
    rules: normalizeRuleSettings(candidate.rules),
    exampleFiles: normalizeExampleFiles(candidate.exampleFiles),
  };
}

export function settingsMessageToConfigPatch(message: SettingsMessage): Pick<
  PublishGuardConfig,
  'includeGitIgnored' | 'ignore' | 'suppressions' | 'rules' | 'dependencyAudit' | 'socketDev' | 'snyk' | 'exampleFiles'
> {
  return {
    includeGitIgnored: message.includeGitIgnored,
    ignore: message.ignore,
    suppressions: message.suppressions,
    rules: message.rules,
    dependencyAudit: { enabled: message.dependencyAudit },
    socketDev: { enabled: message.socketDev },
    snyk: { enabled: message.snyk },
    exampleFiles: message.exampleFiles,
  };
}

export function isSuppressionLike(value: unknown): value is { rule?: string; file?: string; fingerprint?: string; reason: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const suppression = value as Record<string, unknown>;
  return (
    typeof suppression.reason === 'string' &&
    suppression.reason.trim().length > 0 &&
    (suppression.rule === undefined || typeof suppression.rule === 'string') &&
    (suppression.file === undefined || typeof suppression.file === 'string') &&
    (suppression.fingerprint === undefined || typeof suppression.fingerprint === 'string')
  );
}

export function mergeRuleSettings(
  defaults: PublishGuardConfig['rules'],
  override: unknown,
): Record<string, PublishGuardConfig['rules'][string]> {
  const rules = { ...defaults };
  if (override && typeof override === 'object' && !Array.isArray(override)) {
    for (const [rule, value] of Object.entries(override as Record<string, unknown>)) {
      if (isRuleSeverity(value)) {
        rules[rule] = value;
      }
    }
  }
  return rules;
}

export function mergeExampleFiles(defaults: ExampleFilesConfig, override: unknown): ExampleFilesConfig {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return defaults;
  const candidate = override as Partial<ExampleFilesConfig>;
  return {
    scanUnpublished: typeof candidate.scanUnpublished === 'boolean' ? candidate.scanUnpublished : defaults.scanUnpublished,
    scanGitHistory: typeof candidate.scanGitHistory === 'boolean' ? candidate.scanGitHistory : defaults.scanGitHistory,
    dummySecretSeverity: isRuleSeverity(candidate.dummySecretSeverity) ? candidate.dummySecretSeverity : defaults.dummySecretSeverity,
    patterns: Array.isArray(candidate.patterns)
      ? normalizeStringList(candidate.patterns)
      : defaults.patterns,
  };
}

export function isRuleSeverity(value: unknown): value is Issue['severity'] | 'off' {
  return isReportSeverity(value) || value === 'off';
}

function isReportSeverity(value: unknown): value is Issue['severity'] {
  return value === 'error' || value === 'warning' || value === 'info';
}

function normalizeRuleSettings(value: unknown): Record<string, Issue['severity'] | 'off'> {
  const rules: Record<string, Issue['severity'] | 'off'> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return rules;
  for (const [rule, severity] of Object.entries(value as Record<string, unknown>)) {
    if (isRuleSeverity(severity)) {
      rules[rule] = severity;
    }
  }
  return rules;
}

function normalizeExampleFiles(value: unknown): ExampleFilesConfig {
  const candidate = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ExampleFilesConfig>
    : {};
  return {
    scanGitHistory: candidate.scanGitHistory === true,
    scanUnpublished: candidate.scanUnpublished === true,
    dummySecretSeverity: isRuleSeverity(candidate.dummySecretSeverity) ? candidate.dummySecretSeverity : 'info',
    patterns: normalizeStringList(candidate.patterns),
  };
}

function normalizeSuppressions(value: unknown): SettingsMessage['suppressions'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeSuppression(item))
    .filter((item): item is SettingsMessage['suppressions'][number] => Boolean(item));
}

function normalizeSuppression(value: unknown): SettingsMessage['suppressions'][number] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.reason !== 'string' || !candidate.reason.trim()) return undefined;
  const suppression: SettingsMessage['suppressions'][number] = { reason: candidate.reason.trim() };
  if (typeof candidate.rule === 'string' && candidate.rule.trim()) suppression.rule = candidate.rule.trim();
  if (typeof candidate.file === 'string' && candidate.file.trim()) suppression.file = candidate.file.trim();
  if (typeof candidate.fingerprint === 'string' && candidate.fingerprint.trim()) suppression.fingerprint = candidate.fingerprint.trim();
  return suppression;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}
