import { describe, expect, it } from 'vitest';
import { nativeExampleSettingsToConfig, normalizeSettingsMessage, settingsMessageToConfigPatch } from '../src/settings-state';

describe('settings state', () => {
  it('normalizes save-and-scan messages and keeps rule toggles', () => {
    const message = normalizeSettingsMessage({
      command: 'runScan',
      scanOnSave: true,
      blockPublishOnError: false,
      includeGitIgnored: true,
      dependencyAudit: true,
      socketDev: false,
      snyk: true,
      scanMode: 'deep',
      severityThreshold: 'warning',
      ignore: [' fixtures/** ', '', 42],
      suppressions: [
        { rule: 'trailing-slash', file: '.gitignore', reason: 'Reviewed warning' },
        { rule: 'jwt-token', reason: '' },
      ],
      rules: {
        'trailing-slash': 'off',
        'jwt-token': 'warning',
        'bad-rule': 'loud',
      },
      exampleFiles: {
        scanGitHistory: true,
        scanUnpublished: false,
        dummySecretSeverity: 'info',
        patterns: [' docs/** ', '', 12],
      },
    });

    expect(message).toEqual({
      command: 'runScan',
      scanOnSave: true,
      blockPublishOnError: false,
      includeGitIgnored: true,
      dependencyAudit: true,
      socketDev: false,
      snyk: true,
      scanMode: 'deep',
      severityThreshold: 'warning',
      ignore: ['fixtures/**'],
      suppressions: [
        { rule: 'trailing-slash', file: '.gitignore', reason: 'Reviewed warning' },
      ],
      rules: {
        'trailing-slash': 'off',
        'jwt-token': 'warning',
      },
      exampleFiles: {
        scanGitHistory: true,
        scanUnpublished: false,
        dummySecretSeverity: 'info',
        patterns: ['docs/**'],
      },
    });
  });

  it('writes scanner toggles into the project config patch', () => {
    const message = normalizeSettingsMessage({
      command: 'saveSettings',
      scanOnSave: false,
      blockPublishOnError: true,
      includeGitIgnored: true,
      dependencyAudit: true,
      socketDev: true,
      snyk: true,
      scanMode: 'quick',
      severityThreshold: 'info',
      ignore: [],
      suppressions: [],
      rules: { 'trailing-slash': 'off' },
      exampleFiles: {
        scanGitHistory: true,
        scanUnpublished: false,
        dummySecretSeverity: 'info',
        patterns: [],
      },
    });

    expect(settingsMessageToConfigPatch(message!)).toMatchObject({
      includeGitIgnored: true,
      scanMode: 'quick',
      dependencyAudit: { enabled: true },
      socketDev: { enabled: true },
      snyk: { enabled: true },
      rules: { 'trailing-slash': 'off' },
    });
  });

  it('converts native example settings into scanner example config', () => {
    expect(nativeExampleSettingsToConfig({
      scanGitHistoryExamples: false,
      scanUnpublishedExamples: true,
      dummySecretSeverity: 'warning',
    })).toEqual({
      scanGitHistory: false,
      scanUnpublished: true,
      dummySecretSeverity: 'warning',
    });
  });
});
