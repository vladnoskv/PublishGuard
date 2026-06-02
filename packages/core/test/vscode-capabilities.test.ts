import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanManifest } from '../src/scanners/manifest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('VS Code capability checks', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-vscode-capabilities-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks strong diagnostic providers that do not expose a refresh or restart command', () => {
    writePackageJson({
      name: 'stale-linter',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      categories: ['Linters'],
      contributes: {
        languages: [{ id: 'example', extensions: ['.example'] }],
        problemMatchers: [{ name: 'example-lint', pattern: '$eslint-stylish' }],
        commands: [
          { command: 'staleLinter.openOutput', title: 'Stale Linter: Open Output' },
        ],
      },
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-diagnostic-provider-missing-refresh-command');

    expect(issue).toMatchObject({
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
    });
    expect(issue?.message).toContain('diagnostics');
    expect(issue?.suggestion?.toLowerCase()).toContain('refresh');
  });

  it('detects diagnostic providers from source API usage even without linter keywords', () => {
    writePackageJson({
      name: 'source-analyzer',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      contributes: {
        commands: [
          { command: 'sourceDiagnostics.openOutput', title: 'Source Diagnostics: Open Output' },
        ],
      },
    });
    writeSourceFile('src/extension.ts', `
      import * as vscode from 'vscode';
      export function activate() {
        vscode.languages.createDiagnosticCollection('source-diagnostics');
      }
    `);

    const result = scanManifest(tmpDir);

    expect(result.issues.some((i) => i.rule === 'vscode-diagnostic-provider-missing-refresh-command')).toBe(true);
  });

  it('does not warn diagnostic providers that expose a refresh command', () => {
    writePackageJson({
      name: 'fresh-linter',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      categories: ['Linters'],
      contributes: {
        problemMatchers: [{ name: 'example-lint', pattern: '$eslint-stylish' }],
        commands: [
          { command: 'freshLinter.refreshDiagnostics', title: 'Fresh Linter: Refresh Diagnostics' },
        ],
      },
    });

    const result = scanManifest(tmpDir);

    expect(result.issues.some((i) => i.rule === 'vscode-diagnostic-provider-missing-refresh-command')).toBe(false);
  });

  it('accepts scan commands as diagnostic provider recompute affordances', () => {
    writePackageJson({
      name: 'scanner-linter',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      categories: ['Linters'],
      contributes: {
        commands: [
          { command: 'scannerLinter.scanProject', title: 'Scanner Linter: Scan Project' },
        ],
      },
    });

    const result = scanManifest(tmpDir);

    expect(result.issues.some((i) => i.rule === 'vscode-diagnostic-provider-missing-refresh-command')).toBe(false);
  });

  it('blocks language server extensions that do not expose a server restart command', () => {
    writePackageJson({
      name: 'example-language-server',
      version: '1.0.0',
      description: 'Language Server Protocol support for Example files',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      keywords: ['lsp', 'language-server'],
      contributes: {
        languages: [{ id: 'example', extensions: ['.example'] }],
        commands: [
          { command: 'exampleLs.showLogs', title: 'Example LS: Show Logs' },
        ],
      },
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-language-server-missing-restart-command');

    expect(issue).toMatchObject({
      severity: 'error',
      category: 'manifest',
    });
    expect(issue?.suggestion).toContain('Restart');
  });

  it('detects language servers from source API usage', () => {
    writePackageJson({
      name: 'source-protocol-client',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      contributes: {
        languages: [{ id: 'example', extensions: ['.example'] }],
        commands: [
          { command: 'sourceLanguageServer.showLogs', title: 'Source LS: Show Logs' },
        ],
      },
    });
    writeSourceFile('src/extension.ts', `
      import { LanguageClient } from 'vscode-languageclient/node';
      export function activate() {
        const client = new LanguageClient('example', 'Example', {}, {});
        client.start();
      }
    `);

    const result = scanManifest(tmpDir);

    expect(result.issues.some((i) => i.rule === 'vscode-language-server-missing-restart-command')).toBe(true);
  });

  it('warns webview providers that assign HTML without an obvious content security policy', () => {
    writePackageJson({
      name: 'preview-panel',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      contributes: {
        commands: [
          { command: 'previewPanel.reload', title: 'Preview Panel: Reload' },
        ],
      },
    });
    writeSourceFile('src/extension.ts', `
      import * as vscode from 'vscode';
      export function activate(context: vscode.ExtensionContext) {
        const panel = vscode.window.createWebviewPanel('preview', 'Preview', vscode.ViewColumn.One, { enableScripts: true });
        panel.webview.html = '<html><body><script>console.log("preview")</script></body></html>';
      }
    `);

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-webview-missing-csp');

    expect(issue).toMatchObject({
      severity: 'warning',
      category: 'manifest',
    });
    expect(issue?.suggestion).toContain('Content-Security-Policy');
  });

  it('blocks web extensions that appear to use Node-only APIs', () => {
    writePackageJson({
      name: 'browser-extension',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      extensionKind: ['web'],
      contributes: {
        commands: [
          { command: 'browserExtension.scan', title: 'Browser Extension: Scan' },
        ],
      },
    });
    writeSourceFile('src/extension.ts', `
      import * as fs from 'node:fs';
      export function activate() {
        fs.readFileSync('package.json', 'utf-8');
      }
    `);

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-web-extension-node-api-usage');

    expect(issue).toMatchObject({
      severity: 'error',
      category: 'manifest',
    });
  });

  it('blocks source-control providers that do not expose a refresh or sync command', () => {
    writePackageJson({
      name: 'example-scm',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      categories: ['SCM Providers'],
      keywords: ['source-control', 'git'],
      contributes: {
        menus: {
          'scm/title': [
            { command: 'exampleScm.openRepository', group: 'navigation' },
          ],
        },
        commands: [
          { command: 'exampleScm.openRepository', title: 'Example SCM: Open Repository' },
        ],
      },
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-scm-provider-missing-refresh-command');

    expect(issue).toMatchObject({
      severity: 'error',
      category: 'manifest',
    });
  });

  it('detects source-control providers from source API usage', () => {
    writePackageJson({
      name: 'source-scm',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      contributes: {
        commands: [
          { command: 'sourceScm.openRepository', title: 'Source SCM: Open Repository' },
        ],
      },
    });
    writeSourceFile('src/extension.ts', `
      import * as vscode from 'vscode';
      export function activate() {
        vscode.scm.createSourceControl('source-scm', 'Source SCM');
      }
    `);

    const result = scanManifest(tmpDir);

    expect(result.issues.some((i) => i.rule === 'vscode-scm-provider-missing-refresh-command')).toBe(true);
  });

  it('warns custom views that do not expose refresh or reveal commands', () => {
    writePackageJson({
      name: 'tree-viewer',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      contributes: {
        views: {
          explorer: [{ id: 'treeViewer.items', name: 'Tree Viewer' }],
        },
        commands: [
          { command: 'treeViewer.openItem', title: 'Tree Viewer: Open Item' },
        ],
      },
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-view-provider-missing-refresh-command');

    expect(issue).toMatchObject({
      severity: 'warning',
      category: 'manifest',
    });
    expect(issue?.suggestion).toContain('Refresh');
  });

  it('warns authentication providers that do not expose sign-in or sign-out commands', () => {
    writePackageJson({
      name: 'account-provider',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      contributes: {
        authentication: [{ id: 'account-provider', label: 'Account Provider' }],
        commands: [
          { command: 'accountProvider.openDashboard', title: 'Account Provider: Open Dashboard' },
        ],
      },
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-auth-provider-missing-account-command');

    expect(issue).toMatchObject({
      severity: 'warning',
      category: 'manifest',
    });
    expect(issue?.message).toContain('authentication');
  });

  it('warns task providers that do not expose task refresh or run commands', () => {
    writePackageJson({
      name: 'task-provider',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      contributes: {
        taskDefinitions: [{ type: 'example', required: ['script'], properties: {} }],
        commands: [
          { command: 'taskProvider.openOutput', title: 'Task Provider: Open Output' },
        ],
      },
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-task-provider-missing-refresh-command');

    expect(issue).toMatchObject({
      severity: 'warning',
      category: 'manifest',
    });
  });

  it('reports weak keyword-only capability matches as advisory warnings', () => {
    writePackageJson({
      name: 'lint-helper',
      version: '1.0.0',
      description: 'Small helper for lint configuration snippets',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      keywords: ['lint'],
      contributes: {
        commands: [
          { command: 'lintHelper.insertSnippet', title: 'Lint Helper: Insert Snippet' },
        ],
      },
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-capability-keyword-only');

    expect(issue).toMatchObject({
      severity: 'warning',
      category: 'manifest',
    });
    expect(issue?.message).toContain('keyword');
  });

  it('does not classify unrelated substring matches as extension capabilities', () => {
    writePackageJson({
      name: 'digital-metadata-helper',
      version: '1.0.0',
      description: 'A widget helper for workspace metadata and productivity.',
      publisher: 'test',
      engines: { vscode: '^1.90.0' },
      keywords: ['digital', 'metadata', 'productivity'],
      contributes: {
        commands: [
          { command: 'digitalMetadata.openWidget', title: 'Digital Metadata: Open Widget' },
        ],
      },
    });

    const result = scanManifest(tmpDir);

    expect(result.issues.some((i) => i.rule === 'vscode-capability-keyword-only')).toBe(false);
  });

  it('warns when a contributed command is not registered in activationEvents for pre-1.74 engines', () => {
    writePackageJson({
      name: 'old-command-extension',
      version: '1.0.0',
      publisher: 'test',
      engines: { vscode: '^1.70.0' },
      contributes: {
        commands: [
          { command: 'oldCommand.run', title: 'Old Command: Run' },
        ],
      },
      activationEvents: [],
    });

    const result = scanManifest(tmpDir);
    const issue = result.issues.find((i) => i.rule === 'vscode-command-missing-activation-event');

    expect(issue).toMatchObject({
      severity: 'warning',
      category: 'manifest',
    });
    expect(issue?.message).toContain('1.74');
  });

  function writePackageJson(pkg: Record<string, unknown>): void {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));
  }

  function writeSourceFile(filePath: string, contents: string): void {
    const absolutePath = path.join(tmpDir, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }
});
