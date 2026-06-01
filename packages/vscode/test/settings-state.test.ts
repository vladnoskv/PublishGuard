import { describe, expect, it } from 'vitest';
import { normalizeSettingsMessage, settingsMessageToConfigPatch } from '../src/settings-state';

describe('settings state', () => {
  it('normalizes save-and-scan messages and keeps rule toggles', () => {
    const message = normalizeSettingsMessage({
      command: 'runScan',
      scanOnSave: true,
      blockPublishOnError: false,
      includeGitIgnored: true,
      dependencyAudit: true,
      socketDev: false,
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
      includeGitIgnored: false,
      dependencyAudit: true,
      socketDev: true,
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
      dependencyAudit: { enabled: true },
      socketDev: { enabled: true },
      rules: { 'trailing-slash': 'off' },
    });
  });
});
