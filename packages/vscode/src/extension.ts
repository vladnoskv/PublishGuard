import * as vscode from 'vscode';
import * as nodeFs from 'node:fs';
import { scan, generateSafeIgnoreFile, getDefaultConfig } from '@publishguard/core';
import type { ExampleFilesConfig, PublishGuardConfig, ScanMode, ScanResult, Issue } from '@publishguard/core';
import { PublishGuardTreeProvider } from './tree-view';
import { PublishGuardQuickFix } from './quick-fix';
import { buildSettingsWebviewHtml } from './settings-webview';
import { buildSeverityQuickPickItems, filterScanResultBySeverity, normalizeExplorerIgnoreTarget } from './diagnostic-actions';
import { addIgnoreGlob, buildSuppressionEntry, getFolderGlob, isSuppressionScope, normalizeIssueFile, type SuppressionScope } from './suppressions';
import {
  isRuleSeverity,
  isSuppressionLike,
  mergeExampleFiles,
  mergeRuleSettings,
  nativeExampleSettingsToConfig,
  normalizeSettingsMessage,
  settingsMessageToConfigPatch,
  type SettingsMessage,
} from './settings-state';

let diagnosticCollection: vscode.DiagnosticCollection;
let treeProvider: PublishGuardTreeProvider;
let lastResult: ScanResult | null = null;
let lastRawResult: ScanResult | null = null;

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
      { scheme: 'file' },
      quickFix,
      { providedCodeActionKinds: PublishGuardQuickFix.providedCodeActionKinds },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.scan', () => runScan()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.quickScan', () => runScan('quick')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.deepScan', () => runScan('deep')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.refreshIssues', () => runScan()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.refreshDiagnostics', () => runScan()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.clearDiagnostics', clearPublishGuardDiagnostics),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.setSeverityThreshold', setSeverityThreshold),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.openSettings', () => openSettingsWebview(context)),
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
    vscode.commands.registerCommand('publishguard.suppressIssue', (item) => suppressIssue(getIssueFromCommandArg(item), 'exact')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressDiagnostic', (issue, scope) => {
      if (!isSuppressionScope(scope)) return;
      return suppressIssue(getIssueFromCommandArg(issue), scope);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.manageDiagnostic', (issue) =>
      manageDiagnostic(getIssueFromCommandArg(issue) ?? getActivePublishGuardIssue()),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressRuleInFile', (item) => suppressIssue(getIssueFromCommandArg(item), 'rule-file')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressFile', (item) => suppressIssue(getIssueFromCommandArg(item), 'file')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressRuleInFolder', (item) => suppressIssue(getIssueFromCommandArg(item), 'rule-folder')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressFolder', (item) => suppressIssue(getIssueFromCommandArg(item), 'folder')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressRuleEverywhere', (item) => suppressIssue(getIssueFromCommandArg(item), 'rule')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.addToPublishGuardIgnore', addToPublishGuardIgnore),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.ignoreExplorerFile', (uri, selectedUris) =>
      addExplorerPathsToPublishGuardIgnore(uri, selectedUris, false),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.ignoreExplorerFolder', (uri, selectedUris) =>
      addExplorerPathsToPublishGuardIgnore(uri, selectedUris, true),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.excludeIssueFile', (item) => excludeIssuePath(getIssueFromCommandArg(item), 'file')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.excludeIssueFolder', (item) => excludeIssuePath(getIssueFromCommandArg(item), 'folder')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressActiveIssue', () => suppressIssue(getActivePublishGuardIssue(), 'exact')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.suppressActiveRuleEverywhere', () => suppressIssue(getActivePublishGuardIssue(), 'rule')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.excludeActiveFile', () => excludeIssuePath(getActivePublishGuardIssue(), 'file')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.excludeActiveFolder', () => excludeIssuePath(getActivePublishGuardIssue(), 'folder')),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.addToNpmignore', addToPublishGuardIgnore),
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

      lastRawResult = result;
      const filteredResult = filterScanResultBySeverity(result, getSeverityThreshold());
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
        doc.fileName.endsWith('package.json')
      ) {
        await runScan('quick');
      }
    }),
  );

  treeProvider.setIdle();
}

async function runScan(scanMode?: ScanMode): Promise<ScanResult | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage('PublishGuard: Open a workspace folder to scan.');
    return null;
  }
  const resolvedScanMode = scanMode ?? await getScanMode(workspaceFolders[0].uri);

  treeProvider.setScanning('Reading package and ignore rules...');
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `PublishGuard: ${resolvedScanMode} scan`,
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
        const scanResult = await scan({
          projectRoot: workspaceFolders[0].uri.fsPath,
          scanMode: resolvedScanMode,
          includeGitIgnored: await getIncludeGitIgnoredEnabled(workspaceFolders[0].uri),
          dependencyAudit: await getDependencyAuditEnabled(workspaceFolders[0].uri),
          socketDev: await getSocketDevEnabled(workspaceFolders[0].uri),
          snyk: await getSnykEnabled(workspaceFolders[0].uri),
        });

        progress.report({ message: 'Preparing report...' });
        treeProvider.setScanning('Preparing report...');
        return scanResult;
      },
    );

    lastRawResult = result;
    const filteredResult = filterScanResultBySeverity(result, getSeverityThreshold());
    lastResult = filteredResult;
    updateScanUi(filteredResult);

    return filteredResult;
  } catch (e) {
    treeProvider.setFailed((e as Error).message);
    vscode.window.showErrorMessage(`PublishGuard scan failed: ${(e as Error).message}`);
    return null;
  }
}

async function getScanMode(workspaceUri?: vscode.Uri): Promise<ScanMode> {
  const config = vscode.workspace.getConfiguration('publishguard');
  const inspected = config.inspect<string>('scanMode');
  const configuredValue = inspected?.workspaceFolderValue
    ?? inspected?.workspaceValue
    ?? inspected?.globalValue;
  const configuredMode = normalizeScanMode(configuredValue);
  if (configuredMode) return configuredMode;

  if (workspaceUri) {
    const rc = await readJsonObject(vscode.Uri.joinPath(workspaceUri, '.publishguardrc.json'));
    const rcMode = normalizeScanMode(rc.scanMode);
    if (rcMode) return rcMode;
  }

  return normalizeScanMode(config.get<string>('scanMode', 'full')) ?? 'full';
}

function normalizeScanMode(value: unknown): ScanMode | undefined {
  if (value === 'quick' || value === 'full' || value === 'deep') return value;
  return undefined;
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
  if (arg && typeof arg === 'object' && 'rule' in arg) {
    const candidate = arg as { rule?: unknown; file?: unknown; message?: unknown; fingerprint?: unknown };
    if (typeof candidate.rule === 'string') {
      return {
        rule: candidate.rule,
        severity: 'info',
        category: 'unknown',
        file: typeof candidate.file === 'string' ? normalizeIssueFile(candidate.file) : '',
        message: typeof candidate.message === 'string' ? candidate.message : candidate.rule,
        fingerprint: typeof candidate.fingerprint === 'string' ? candidate.fingerprint : undefined,
      };
    }
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

async function suppressIssue(issue: Issue | undefined, scope: SuppressionScope): Promise<void> {
  if (!issue) return;
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const defaultReason = scope === 'exact' ? 'Reviewed false positive' : `Reviewed ${scope} suppression`;
  const reason = await vscode.window.showInputBox({
    prompt: getSuppressionPrompt(issue, scope),
    value: defaultReason,
    validateInput: (value) => value.trim() ? undefined : 'A reason is required.',
  });
  if (!reason) return;

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, '.publishguardrc.json');
  const config = await readJsonObject(configUri);
  const suppressions = Array.isArray(config.suppressions) ? config.suppressions : [];
  suppressions.push(buildSuppressionEntry(issue, scope, reason));
  config.suppressions = suppressions;

  await vscode.workspace.fs.writeFile(configUri, Buffer.from(`${JSON.stringify(config, null, 2)}\n`, 'utf-8'));
  vscode.window.showInformationMessage('PublishGuard: Ignore rule added for future scans. Run a new scan to update the UI.');
}

async function manageDiagnostic(issue: Issue | undefined): Promise<void> {
  if (!issue) return;
  const file = normalizeIssueFile(issue.file);
  const choices = [
    {
      label: 'Open finding',
      description: file,
      run: () => openIssue(issue),
    },
    {
      label: 'Reveal in file explorer',
      description: file,
      run: () => revealIssue(issue),
    },
    {
      label: 'Ignore this warning',
      description: `Suppress this ${issue.rule} finding`,
      run: () => suppressIssue(issue, 'exact'),
    },
    {
      label: 'Ignore rule in this file',
      description: `${issue.rule} in ${file}`,
      run: () => suppressIssue(issue, 'rule-file'),
    },
    {
      label: 'Ignore all issues in this file',
      description: file,
      run: () => suppressIssue(issue, 'file'),
    },
    {
      label: 'Ignore rule in this folder',
      description: issue.rule,
      run: () => suppressIssue(issue, 'rule-folder'),
    },
    {
      label: 'Exclude this file from PublishGuard scans',
      description: file,
      run: () => excludeIssuePath(issue, 'file'),
    },
    {
      label: 'Exclude this folder from PublishGuard scans',
      description: getFolderGlob(file),
      run: () => excludeIssuePath(issue, 'folder'),
    },
    {
      label: 'Refresh diagnostics',
      description: 'Run PublishGuard again',
      run: () => runScan(),
    },
    {
      label: 'Set severity filter',
      description: 'Choose which severities are shown',
      run: () => setSeverityThreshold(),
    },
    {
      label: 'Clear diagnostics',
      description: 'Remove current PublishGuard findings from Problems',
      run: () => clearPublishGuardDiagnostics(),
    },
  ];
  const choice = await vscode.window.showQuickPick(choices, {
    placeHolder: `Manage PublishGuard finding: ${issue.rule}`,
  });
  if (!choice) return;
  await choice.run();
}

function clearPublishGuardDiagnostics(): void {
  diagnosticCollection.clear();
  lastResult = null;
  lastRawResult = null;
  treeProvider.setIdle();
  vscode.window.showInformationMessage('PublishGuard: Diagnostics cleared.');
}

async function setSeverityThreshold(): Promise<void> {
  const current = getSeverityThreshold();
  const choice = await vscode.window.showQuickPick(buildSeverityQuickPickItems(current), {
    placeHolder: 'Show PublishGuard findings at this severity or higher',
  });
  if (!choice) return;

  await vscode.workspace
    .getConfiguration('publishguard')
    .update('severityThreshold', choice.severity, vscode.ConfigurationTarget.Workspace);

  if (lastRawResult) {
    const filteredResult = filterScanResultBySeverity(lastRawResult, choice.severity);
    lastResult = filteredResult;
    updateScanUi(filteredResult);
  }

  vscode.window.showInformationMessage(`PublishGuard: Severity filter set to ${choice.label}.`);
}

function getSuppressionPrompt(issue: Issue, scope: SuppressionScope): string {
  const file = normalizeIssueFile(issue.file);
  if (scope === 'exact') return `Reason for ignoring this ${issue.rule} finding`;
  if (scope === 'rule-file') return `Reason for ignoring ${issue.rule} in ${file}`;
  if (scope === 'file') return `Reason for ignoring all PublishGuard issues in ${file}`;
  if (scope === 'rule-folder') return `Reason for ignoring ${issue.rule} in this folder`;
  if (scope === 'folder') return 'Reason for ignoring all PublishGuard issues in this folder';
  return `Reason for ignoring ${issue.rule} everywhere`;
}

async function addToPublishGuardIgnore(fileName?: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;
  if (!fileName) {
    fileName = await vscode.window.showInputBox({
      prompt: 'File or folder glob to add to .publishguardrc.json ignore',
      placeHolder: 'fixtures/**',
      validateInput: (value) => value.trim() ? undefined : 'Enter a file path or glob.',
    });
  }
  if (!fileName) return;
  const relativeFile = toWorkspaceRelativeFile(fileName);
  await addPublishGuardIgnoreGlob(relativeFile);
}

async function addExplorerPathsToPublishGuardIgnore(
  uri: vscode.Uri | undefined,
  selectedUris: vscode.Uri[] | undefined,
  isFolder: boolean,
): Promise<void> {
  const targets = Array.isArray(selectedUris) && selectedUris.length > 0
    ? selectedUris
    : uri
      ? [uri]
      : [];
  if (targets.length === 0) return;

  const globs = targets.map((target) =>
    normalizeExplorerIgnoreTarget(vscode.workspace.asRelativePath(target, false), isFolder),
  );
  await addPublishGuardIgnoreGlobs(globs);
}

async function excludeIssuePath(issue: Issue | undefined, scope: 'file' | 'folder'): Promise<void> {
  if (!issue?.file) return;
  const file = normalizeIssueFile(issue.file);
  await addPublishGuardIgnoreGlob(scope === 'folder' ? getFolderGlob(file) : file);
}

async function addPublishGuardIgnoreGlob(glob: string): Promise<void> {
  await addPublishGuardIgnoreGlobs([glob]);
}

async function addPublishGuardIgnoreGlobs(globs: string[]): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;
  const normalizedGlobs = Array.from(new Set(globs.map(normalizeIssueFile).filter(Boolean)));
  if (normalizedGlobs.length === 0) return;

  const configUri = vscode.Uri.joinPath(workspaceFolder.uri, '.publishguardrc.json');
  let config = await readJsonObject(configUri);
  for (const glob of normalizedGlobs) {
    config = addIgnoreGlob(config, glob);
  }
  await vscode.workspace.fs.writeFile(
    configUri,
    Buffer.from(`${JSON.stringify(config, null, 2)}\n`, 'utf-8'),
  );
  const label = normalizedGlobs.length === 1 ? normalizedGlobs[0] : `${normalizedGlobs.length} paths`;
  vscode.window.showInformationMessage(
    `PublishGuard: Added ${label} to .publishguardrc.json ignore. Run a new scan to update the UI.`,
  );
}

function toWorkspaceRelativeFile(fileName: string): string {
  if (/^(?:[a-zA-Z]:[\\/]|[\\/]{2}|[\\/])/.test(fileName)) {
    return normalizeIssueFile(vscode.workspace.asRelativePath(vscode.Uri.file(fileName), false));
  }
  return normalizeIssueFile(fileName);
}

function getActivePublishGuardIssue(): Issue | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const diagnostics = diagnosticCollection.get(editor.document.uri) ?? [];
  const active = editor.selection.active;
  const diagnostic = diagnostics.find((item) => item.source === 'PublishGuard' && item.range.contains(active))
    ?? diagnostics.find((item) => item.source === 'PublishGuard' && item.range.start.line === active.line);
  if (!diagnostic) return undefined;
  return getIssueFromCommandArg({
    rule: diagnostic.code,
    file: vscode.workspace.asRelativePath(editor.document.uri, false),
    message: diagnostic.message,
  });
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

async function openSettingsWebview(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage('PublishGuard: Open a workspace folder to edit settings.');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'publishguardSettings',
    'PublishGuard Settings',
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  const render = async () => {
    const config = vscode.workspace.getConfiguration('publishguard');
    const rc = await readJsonObject(vscode.Uri.joinPath(workspaceFolder.uri, '.publishguardrc.json'));
    const defaults = getDefaultConfig();
    const nativeExampleFiles = nativeExampleSettingsToConfig({
      scanGitHistoryExamples: config.get<boolean>('scanGitHistoryExamples', defaults.exampleFiles.scanGitHistory),
      scanUnpublishedExamples: config.get<boolean>('scanUnpublishedExamples', defaults.exampleFiles.scanUnpublished),
      dummySecretSeverity: config.get<string>('dummySecretSeverity', defaults.exampleFiles.dummySecretSeverity),
    });
    panel.webview.html = buildSettingsWebviewHtml({
      nonce: createNonce(),
      scanOnSave: config.get<boolean>('scanOnSave', true),
      blockPublishOnError: config.get<boolean>('blockPublishOnError', true),
      dependencyAudit: await getDependencyAuditEnabled(workspaceFolder.uri),
      includeGitIgnored: await getIncludeGitIgnoredEnabled(workspaceFolder.uri),
      socketDev: await getSocketDevEnabled(workspaceFolder.uri),
      snyk: await getSnykEnabled(workspaceFolder.uri),
      scanMode: await getScanMode(workspaceFolder.uri),
      severityThreshold: getSeverityThreshold(),
      ignore: Array.isArray(rc.ignore) ? rc.ignore.filter((item): item is string => typeof item === 'string') : [],
      suppressions: Array.isArray(rc.suppressions)
        ? rc.suppressions.filter(isSuppressionLike)
        : [],
      rules: mergeRuleSettings(defaults.rules, rc.rules),
      exampleFiles: mergeExampleFiles(
        mergeExampleFiles(defaults.exampleFiles, nativeExampleFiles),
        rc.exampleFiles,
      ),
    });
  };

  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    const settingsMessage = normalizeSettingsMessage(message);
    if (!settingsMessage) {
      vscode.window.showErrorMessage('PublishGuard: Settings could not be saved because the form payload was invalid.');
      return;
    }

    try {
      await saveSettingsMessage(workspaceFolder.uri, settingsMessage);
      vscode.window.showInformationMessage(
        settingsMessage.command === 'runScan'
          ? 'PublishGuard: Settings saved.'
          : 'PublishGuard: Settings saved. Run a new scan to update the UI.',
      );
      await render();
      if (settingsMessage.command === 'runScan') {
        await runScan();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`PublishGuard: Settings save failed: ${(error as Error).message}`);
    }
  }, undefined, context.subscriptions);

  await render();
}

async function saveSettingsMessage(workspaceUri: vscode.Uri, message: SettingsMessage): Promise<void> {
  const workspaceConfig = vscode.workspace.getConfiguration('publishguard');
  await workspaceConfig.update('scanOnSave', message.scanOnSave, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('blockPublishOnError', message.blockPublishOnError, vscode.ConfigurationTarget.Workspace);
  await updateWorkspaceSetting(workspaceConfig, 'includeGitIgnored', message.includeGitIgnored, { allowUnregistered: true });
  await workspaceConfig.update('severityThreshold', message.severityThreshold, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('dependencyAudit', message.dependencyAudit, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('socketDev', message.socketDev, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('snyk', message.snyk, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('scanMode', message.scanMode, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('scanGitHistoryExamples', message.exampleFiles.scanGitHistory, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('scanUnpublishedExamples', message.exampleFiles.scanUnpublished, vscode.ConfigurationTarget.Workspace);
  await workspaceConfig.update('dummySecretSeverity', message.exampleFiles.dummySecretSeverity, vscode.ConfigurationTarget.Workspace);

  const configUri = vscode.Uri.joinPath(workspaceUri, '.publishguardrc.json');
  const rc = await readJsonObject(configUri);
  Object.assign(rc, settingsMessageToConfigPatch(message));
  await vscode.workspace.fs.writeFile(configUri, Buffer.from(`${JSON.stringify(rc, null, 2)}\n`, 'utf-8'));
}

async function getDependencyAuditEnabled(workspaceUri?: vscode.Uri): Promise<boolean> {
  return getScannerEnabled('dependencyAudit', workspaceUri);
}

async function getIncludeGitIgnoredEnabled(workspaceUri?: vscode.Uri): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('publishguard');
  const inspected = config.inspect<boolean>('includeGitIgnored');
  const configuredValue = inspected?.workspaceFolderValue
    ?? inspected?.workspaceValue
    ?? inspected?.globalValue;
  if (typeof configuredValue === 'boolean') return configuredValue;

  if (workspaceUri) {
    const rc = await readJsonObject(vscode.Uri.joinPath(workspaceUri, '.publishguardrc.json'));
    if (typeof rc.includeGitIgnored === 'boolean') return rc.includeGitIgnored;
  }

  return config.get<boolean>('includeGitIgnored', false);
}

async function getSocketDevEnabled(workspaceUri?: vscode.Uri): Promise<boolean> {
  return getScannerEnabled('socketDev', workspaceUri);
}

async function getSnykEnabled(workspaceUri?: vscode.Uri): Promise<boolean> {
  return getScannerEnabled('snyk', workspaceUri);
}

async function getScannerEnabled(
  key: 'dependencyAudit' | 'socketDev' | 'snyk',
  workspaceUri?: vscode.Uri,
): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('publishguard');
  const inspected = config.inspect<boolean>(key);
  const configuredValue = inspected?.workspaceFolderValue
    ?? inspected?.workspaceValue
    ?? inspected?.globalValue;
  if (typeof configuredValue === 'boolean') return configuredValue;

  if (workspaceUri) {
    const rc = await readJsonObject(vscode.Uri.joinPath(workspaceUri, '.publishguardrc.json'));
    const scannerConfig = rc[key];
    if (
      scannerConfig &&
      typeof scannerConfig === 'object' &&
      !Array.isArray(scannerConfig) &&
      typeof (scannerConfig as { enabled?: unknown }).enabled === 'boolean'
    ) {
      return (scannerConfig as { enabled: boolean }).enabled;
    }
  }

  return config.get<boolean>(key, false);
}

async function updateWorkspaceSetting<T>(
  config: vscode.WorkspaceConfiguration,
  key: string,
  value: T,
  options?: { allowUnregistered?: boolean },
): Promise<void> {
  try {
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  } catch (error) {
    const message = (error as Error).message;
    if (options?.allowUnregistered && message.includes('not a registered configuration')) {
      return;
    }
    throw error;
  }
}

function isExampleFilesConfig(value: unknown): value is ExampleFilesConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ExampleFilesConfig>;
  return (
    typeof candidate.scanUnpublished === 'boolean' &&
    typeof candidate.scanGitHistory === 'boolean' &&
    isRuleSeverity(candidate.dummySecretSeverity) &&
    Array.isArray(candidate.patterns) &&
    candidate.patterns.every((item) => typeof item === 'string')
  );
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 24; i++) {
    nonce += chars[Math.floor(Math.random() * chars.length)];
  }
  return nonce;
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
