import * as vscode from 'vscode';
import * as nodeFs from 'node:fs';
import { scan, generateSafeIgnoreFile } from '@publishguard/core';
import type { ScanResult, Issue } from '@publishguard/core';
import { PublishGuardTreeProvider } from './tree-view';
import { PublishGuardQuickFix } from './quick-fix';

let diagnosticCollection: vscode.DiagnosticCollection;
let treeProvider: PublishGuardTreeProvider;
let lastResult: ScanResult | null = null;

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('publishguard');
  context.subscriptions.push(diagnosticCollection);

  treeProvider = new PublishGuardTreeProvider();
  const treeView = vscode.window.createTreeView('publishguard.issues', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const quickFix = new PublishGuardQuickFix();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file', pattern: '**/package.json' },
      quickFix,
    ),
    vscode.languages.registerCodeActionsProvider(
      { pattern: '**/.npmignore' },
      quickFix,
    ),
    vscode.languages.registerCodeActionsProvider(
      { pattern: '**/.vscodeignore' },
      quickFix,
    ),
    vscode.languages.registerCodeActionsProvider(
      { pattern: '**/.gitignore' },
      quickFix,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.scan', () => runScan()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'publishguard'),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.openIssue', (item) => openIssue(getIssueFromCommandArg(item))),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.revealIssue', (item) => revealIssue(getIssueFromCommandArg(item))),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.deleteIssueFile', (item) => deleteIssueFile(getIssueFromCommandArg(item))),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressIssue', (item) => suppressIssue(getIssueFromCommandArg(item))),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.copyIssue', async (item) => {
      const issue = getIssueFromCommandArg(item);
      if (!issue) return;
      await vscode.env.clipboard.writeText(formatIssueMarkdown(issue));
      vscode.window.showInformationMessage('PublishGuard: Issue copied.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.copyMarkdownReport', async () => {
      if (!lastResult) {
        vscode.window.showWarningMessage('PublishGuard: Run a scan before copying a report.');
        return;
      }
      await vscode.env.clipboard.writeText(generateMarkdownReport(lastResult));
      vscode.window.showInformationMessage('PublishGuard: Markdown report copied.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.exportMarkdownReport', exportMarkdownReport),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.installPreCommitHook', installPreCommitHook),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.showIssues', async () => {
      const first = treeProvider.getRootItems()[0];
      if (first) {
        await treeView.reveal(first, { expand: true, focus: true });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.init', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const rootDir = workspaceFolders[0].uri.fsPath;
      const npmResult = generateSafeIgnoreFile(rootDir, '.npmignore');
      const vscodeResult = generateSafeIgnoreFile(rootDir, '.vscodeignore');

      const msg: string[] = [];
      if (npmResult.created) msg.push('Created .npmignore');
      else if (npmResult.rulesAdded.length > 0) msg.push(`Updated .npmignore with ${npmResult.rulesAdded.length} rules`);
      if (vscodeResult.created) msg.push('Created .vscodeignore');
      else if (vscodeResult.rulesAdded.length > 0) msg.push(`Updated .vscodeignore with ${vscodeResult.rulesAdded.length} rules`);

      vscode.window.showInformationMessage(
        msg.length > 0 ? `PublishGuard: ${msg.join(', ')}` : 'PublishGuard: Ignore files already up to date',
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.fix', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      const rootDir = workspaceFolders[0].uri.fsPath;

      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'PublishGuard: fixing issues...' },
        async () => {
          generateSafeIgnoreFile(rootDir, '.npmignore');
          const pkgUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'package.json');
          try {
            const pkgContent = JSON.parse(
              (await vscode.workspace.fs.readFile(pkgUri)).toString(),
            );
            if (pkgContent.engines?.vscode || pkgContent.activationEvents || pkgContent.publisher) {
              generateSafeIgnoreFile(rootDir, '.vscodeignore');
            }
          } catch { /* ignore */ }
          return scan({ projectRoot: rootDir });
        },
      );

      const filteredResult = filterScanResult(result, getSeverityThreshold());
      lastResult = filteredResult;
      updateScanUi(filteredResult);

      if (filteredResult.summary.errors === 0 && filteredResult.summary.warnings === 0) {
        vscode.window.showInformationMessage('PublishGuard: No issues remaining.');
      } else {
        vscode.window.showWarningMessage(
          `PublishGuard: ${filteredResult.summary.errors} errors, ${filteredResult.summary.warnings} warnings remain. Review them in the PublishGuard panel.`,
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const config = vscode.workspace.getConfiguration('publishguard');
      if (!config.get<boolean>('scanOnSave', true)) return;
      if (
        doc.fileName.endsWith('package.json') ||
        doc.fileName.endsWith('.npmignore') ||
        doc.fileName.endsWith('.vscodeignore') ||
        doc.fileName.endsWith('.gitignore')
      ) {
        await runScan();
      }
    }),
  );

  treeProvider.setIdle();
}

async function runScan(): Promise<ScanResult | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage('PublishGuard: Open a workspace folder to scan.');
    return null;
  }

  treeProvider.setScanning('Reading package and ignore rules...');
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'PublishGuard',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Reading package and ignore rules...' });
        treeProvider.setScanning('Reading package and ignore rules...');
        await delay(30);

        progress.report({ message: 'Resolving publish files...' });
        treeProvider.setScanning('Resolving publish files...');
        await delay(30);

        progress.report({ message: 'Scanning secrets and package risks...' });
        treeProvider.setScanning('Scanning secrets and package risks...');
        const scanResult = await scan({ projectRoot: workspaceFolders[0].uri.fsPath });

        progress.report({ message: 'Preparing report...' });
        treeProvider.setScanning('Preparing report...');
        return scanResult;
      },
    );

    const filteredResult = filterScanResult(result, getSeverityThreshold());
    lastResult = filteredResult;
    updateScanUi(filteredResult);

    return filteredResult;
  } catch (e) {
    treeProvider.setFailed((e as Error).message);
    vscode.window.showErrorMessage(`PublishGuard scan failed: ${(e as Error).message}`);
    return null;
  }
}

function getSeverityThreshold(): Issue['severity'] {
  const config = vscode.workspace.getConfiguration('publishguard');
  const severityThreshold = config.get<string>('severityThreshold', 'info');
  if (
    severityThreshold === 'error' ||
    severityThreshold === 'warning' ||
    severityThreshold === 'info'
  ) {
    return severityThreshold;
  }
  return 'info';
}

function filterScanResult(result: ScanResult, threshold: Issue['severity']): ScanResult {
  const severityRank: Record<Issue['severity'], number> = {
    error: 3,
    warning: 2,
    info: 1,
  };
  const issues = result.issues.filter(
    (issue) => severityRank[issue.severity] >= severityRank[threshold],
  );

  return {
    ...result,
    issues,
    summary: {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
      infos: issues.filter((issue) => issue.severity === 'info').length,
    },
  };
}

function updateScanUi(result: ScanResult): void {
  diagnosticCollection.clear();
  updateDiagnostics(result);

  treeProvider.update(result);

  const hasErrors = result.issues.some((i) => i.severity === 'error');

  if (result.issues.length === 0) {
    treeProvider.setStatus('clean');
  } else if (hasErrors) {
    treeProvider.setStatus('error');
  } else {
    treeProvider.setStatus('warning');
  }
}

function updateDiagnostics(result: ScanResult): void {
  const diagMap = new Map<string, vscode.Diagnostic[]>();

  for (const issue of result.issues) {
    const fileUri = issue.file
      ? vscode.Uri.joinPath(vscode.Uri.file(result.projectRoot), issue.file)
      : vscode.Uri.joinPath(vscode.Uri.file(result.projectRoot), 'package.json');

    const key = fileUri.fsPath;
    if (!diagMap.has(key)) {
      diagMap.set(key, []);
    }

    const diag = new vscode.Diagnostic(
      issueToRange(issue),
      `[${issue.rule}] ${issue.message}`,
      issue.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : issue.severity === 'warning'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information,
    );
    diag.source = 'PublishGuard';
    diag.code = issue.rule;
    diagMap.get(key)!.push(diag);
  }

  for (const [fsPath, diags] of diagMap) {
    diagnosticCollection.set(vscode.Uri.file(fsPath), diags);
  }
}

function issueToRange(issue: Issue): vscode.Range {
  if (!issue.location) {
    return new vscode.Range(0, 0, 0, 0);
  }
  const startLine = Math.max(0, issue.location.line - 1);
  const startColumn = Math.max(0, issue.location.column - 1);
  const endLine = Math.max(startLine, (issue.location.endLine ?? issue.location.line) - 1);
  const endColumn = Math.max(startColumn + 1, (issue.location.endColumn ?? issue.location.column + 1) - 1);
  return new vscode.Range(startLine, startColumn, endLine, endColumn);
}

function getIssueFromCommandArg(arg: unknown): Issue | undefined {
  if (arg && typeof arg === 'object' && 'issue' in arg) {
    return (arg as { issue?: Issue }).issue;
  }
  return undefined;
}

async function openIssue(issue: Issue | undefined): Promise<void> {
  const uri = getIssueUri(issue);
  if (!uri) return;
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  if (issue?.location) {
    const range = issueToRange(issue);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }
}

async function revealIssue(issue: Issue | undefined): Promise<void> {
  const uri = getIssueUri(issue);
  if (!uri) return;
  await vscode.commands.executeCommand('revealFileInOS', uri);
}

async function deleteIssueFile(issue: Issue | undefined): Promise<void> {
  const uri = getIssueUri(issue);
  if (!uri || !issue?.file) return;
  const choice = await vscode.window.showWarningMessage(
    `Delete ${issue.file}?`,
    { modal: true },
    'Delete',
  );
  if (choice !== 'Delete') return;
  await vscode.workspace.fs.delete(uri, { useTrash: true });
  await runScan();
}

async function suppressIssue(issue: Issue | undefined): Promise<void> {
  if (!issue) return;
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const reason = await vscode.window.showInputBox({
    prompt: 'Reason for ignoring this PublishGuard problem',
    value: 'Reviewed false positive',
    validateInput: (value) => value.trim() ? undefined : 'A reason is required.',
  });
  if (!reason) return;

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, '.publishguardrc.json');
  const config = await readJsonObject(configUri);
  const suppressions = Array.isArray(config.suppressions) ? config.suppressions : [];
  const entry: Record<string, string> = {
    rule: issue.rule,
    file: issue.file,
    reason: reason.trim(),
  };
  if (issue.fingerprint) {
    entry.fingerprint = issue.fingerprint;
  }
  suppressions.push(entry);
  config.suppressions = suppressions;

  await vscode.workspace.fs.writeFile(configUri, Buffer.from(`${JSON.stringify(config, null, 2)}\n`, 'utf-8'));
  vscode.window.showInformationMessage('PublishGuard: Problem ignored for future scans.');
  await runScan();
}

async function exportMarkdownReport(): Promise<void> {
  if (!lastResult) {
    vscode.window.showWarningMessage('PublishGuard: Run a scan before exporting a report.');
    return;
  }
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const defaultUri = vscode.Uri.joinPath(workspaceFolder.uri, 'publishguard-report.md');
  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { Markdown: ['md'] },
  });
  if (!uri) return;

  await vscode.workspace.fs.writeFile(uri, Buffer.from(generateMarkdownReport(lastResult), 'utf-8'));
  vscode.window.showInformationMessage('PublishGuard: Markdown report exported.');
}

async function installPreCommitHook(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;
  const hookUri = vscode.Uri.joinPath(workspaceFolder.uri, '.git', 'hooks', 'pre-commit');
  const hook = [
    '#!/bin/sh',
    'set -eu',
    'if [ -x "./node_modules/.bin/publishguard" ]; then',
    '  ./node_modules/.bin/publishguard scan --staged --fail-on error',
    'else',
    '  npx --no-install publishguard scan --staged --fail-on error',
    'fi',
    '',
  ].join('\n');
  await vscode.workspace.fs.writeFile(hookUri, Buffer.from(hook, 'utf-8'));
  await nodeFs.promises.chmod(hookUri.fsPath, 0o755).catch(() => undefined);
  vscode.window.showInformationMessage('PublishGuard: Pre-commit hook installed.');
}

function getIssueUri(issue: Issue | undefined): vscode.Uri | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder || !issue?.file) return undefined;
  return vscode.Uri.joinPath(workspaceFolder.uri, ...issue.file.split(/[\\/]/));
}

async function readJsonObject(uri: vscode.Uri): Promise<Record<string, unknown>> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const parsed = JSON.parse(Buffer.from(bytes).toString('utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function generateMarkdownReport(result: ScanResult): string {
  const lines = [
    '# PublishGuard Report',
    '',
    `Project: ${result.projectRoot}`,
    `Package type: ${result.packageType}`,
    `Files to publish: ${result.publishedFiles.length}`,
    `Summary: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.infos} infos`,
    `Duration: ${result.durationMs}ms`,
    '',
  ];

  if (result.issues.length === 0) {
    lines.push('No issues found.');
    return `${lines.join('\n')}\n`;
  }

  lines.push('| Severity | Rule | File | Location | Message |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const issue of result.issues) {
    const location = issue.location
      ? `${issue.location.line}:${issue.location.column}`
      : '';
    lines.push(
      `| ${escapeMarkdown(issue.severity)} | ${escapeMarkdown(issue.rule)} | ${escapeMarkdown(issue.file || 'project')} | ${escapeMarkdown(location)} | ${escapeMarkdown(issue.message)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function formatIssueMarkdown(issue: Issue): string {
  const location = issue.location ? `${issue.location.line}:${issue.location.column}` : '';
  return [
    `Rule: ${issue.rule}`,
    `Severity: ${issue.severity}`,
    `File: ${issue.file || 'project'}`,
    location ? `Location: ${location}` : undefined,
    `Message: ${issue.message}`,
    issue.suggestion ? `Suggestion: ${issue.suggestion}` : undefined,
  ].filter(Boolean).join('\n');
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deactivate() {
  diagnosticCollection?.dispose();
}
