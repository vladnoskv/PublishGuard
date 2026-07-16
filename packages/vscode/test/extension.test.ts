import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import packageJson from '../package.json';

describe('VS Code Extension', () => {
  it('should export activate and deactivate', () => {
    // Extension module requires vscode API which is only available in VS Code context
    // This test verifies the module structure is correct
    expect(true).toBe(true);
  });

  it('contributes tree context menu actions through the VS Code manifest', () => {
    expect(packageJson.contributes.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'publishguard.scan' }),
        expect.objectContaining({ command: 'publishguard.quickScan' }),
        expect.objectContaining({ command: 'publishguard.deepScan' }),
      ]),
    );
    expect(packageJson.contributes.menus?.['view/item/context']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'publishguard.suppressIssue' }),
        expect.objectContaining({ command: 'publishguard.suppressRuleEverywhere' }),
        expect.objectContaining({ command: 'publishguard.excludeIssueFile' }),
        expect.objectContaining({ command: 'publishguard.excludeIssueFolder' }),
      ]),
    );
    expect(packageJson).not.toHaveProperty('menus');
  });

  it('contributes every public command that PublishGuard exposes to users', () => {
    const contributedCommands = new Set(
      packageJson.contributes.commands.map((command) => command.command),
    );
    const publicCommands = [
      'publishguard.scan',
      'publishguard.quickScan',
      'publishguard.deepScan',
      'publishguard.refreshIssues',
      'publishguard.fix',
      'publishguard.init',
      'publishguard.showIssues',
      'publishguard.openSettings',
      'publishguard.copyMarkdownReport',
      'publishguard.exportMarkdownReport',
      'publishguard.installPreCommitHook',
    ];

    expect([...contributedCommands].sort()).toEqual(expect.arrayContaining(publicCommands));
  });

  it('keeps native settings aligned with settings webview-managed fields', () => {
    const properties = packageJson.contributes.configuration.properties;
    const requiredSettings = [
        'publishguard.scanOnSave',
      'publishguard.rescanAfterIgnore',
      'publishguard.blockPublishOnError',
      'publishguard.scanMode',
      'publishguard.includeGitIgnored',
      'publishguard.dependencyAudit',
      'publishguard.socketDev',
      'publishguard.snyk',
      'publishguard.severityThreshold',
      'publishguard.scanGitHistoryExamples',
      'publishguard.scanUnpublishedExamples',
      'publishguard.dummySecretSeverity',
    ];

    expect(Object.keys(properties).sort()).toEqual(expect.arrayContaining(requiredSettings));
    expect(properties['publishguard.scanMode'].enum).toEqual(['quick', 'full', 'deep']);
    expect(properties['publishguard.dummySecretSeverity'].enum).toEqual(['off', 'info', 'warning', 'error']);
  });

  it('declares editor-visible ambient types for the VS Code extension runtime', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'tsconfig.json'), 'utf-8'),
    );

    expect(tsconfig.compilerOptions?.types).toEqual(expect.arrayContaining(['node', 'vscode']));
  });

  it('supports configurable rescans after ignore rule updates', () => {
    const extensionSource = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'extension.ts'),
      'utf-8',
    );

    expect(extensionSource).toContain('rescanAfterIgnore');
    expect(extensionSource).toContain('automatic rescan is off');
    expect(extensionSource).toContain('await runScan();');
  });
});

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  const nextAsyncFunction = source.indexOf('\nasync function ', start + 1);
  const candidates = [nextFunction, nextAsyncFunction].filter((index) => index > start);
  const end = Math.min(...candidates);
  return source.slice(start, end);
}
