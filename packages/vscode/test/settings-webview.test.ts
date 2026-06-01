import { describe, expect, it } from 'vitest';
import { buildSettingsWebviewHtml } from '../src/settings-webview';

describe('settings webview', () => {
  it('renders navigable settings for scanning, examples, rules, and ignored problems', () => {
    const html = buildSettingsWebviewHtml({
      nonce: 'test-nonce',
      scanOnSave: true,
      blockPublishOnError: true,
      includeGitIgnored: true,
      dependencyAudit: false,
      socketDev: false,
      severityThreshold: 'info',
      ignore: ['fixtures/**'],
      suppressions: [{ rule: 'aws-access-key', file: 'docs/**', reason: 'Documented fake key' }],
      rules: {
        'aws-access-key': 'error',
        'jwt-token': 'off',
      },
      exampleFiles: {
        scanUnpublished: false,
        scanGitHistory: true,
        dummySecretSeverity: 'info',
        patterns: ['docs/**', 'examples/**'],
      },
    });

    expect(html).toContain('href="#scan-settings"');
    expect(html).toContain('name="includeGitIgnored" type="checkbox" checked');
    expect(html).toContain('id="example-settings"');
    expect(html).toContain('name="exampleScanGitHistory" type="checkbox" checked');
    expect(html).toContain('name="exampleScanUnpublished" type="checkbox"');
    expect(html).toContain('data-rule="aws-access-key"');
    expect(html).toContain('data-suppression-row');
    expect(html).toContain('addSuppression');
  });
});
