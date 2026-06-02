import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import type { Issue } from '../types';

type PackageJson = Record<string, unknown>;
type CapabilityScanDepth = 'manifest' | 'full' | 'deep';

interface CommandContribution {
  command: string;
  title: string;
}

interface CapabilityProfile {
  name: string;
  displayName: string;
  strong: boolean;
  weak: boolean;
  hasLifecycleCommand: boolean;
  rule: string;
  severity: Issue['severity'];
  message: string;
  suggestion: string;
}

interface SourceSignals {
  diagnostics: boolean;
  languageServer: boolean;
  scm: boolean;
  testing: boolean;
  webview: boolean;
  customEditor: boolean;
  authentication: boolean;
  tasks: boolean;
  notebooks: boolean;
  terminals: boolean;
  webviewHtmlAssignment: boolean;
  webviewContentSecurityPolicy: boolean;
  nodeApiUsage: boolean;
}

const DIAGNOSTIC_TERMS = [
  'diagnostic',
  'diagnostics',
  'linter',
  'linters',
  'lint',
  'problems',
  'problem matcher',
  'problem-matcher',
  'static analysis',
];

const LANGUAGE_SERVER_TERMS = [
  'language server',
  'language-server',
  'lsp',
  'language client',
  'language-client',
];

const SCM_TERMS = [
  'scm',
  'source control',
  'source-control',
  'git',
  'svn',
  'subversion',
  'perforce',
  'mercurial',
];

const FORMATTER_TERMS = [
  'formatter',
  'formatting',
  'format',
  'prettier',
  'beautify',
];

const TEST_TERMS = [
  'test',
  'testing',
  'tests',
  'coverage',
  'unit test',
];

const DEBUGGER_TERMS = [
  'debugger',
  'debug',
  'debugging',
];

const COMMAND_LIFECYCLE_TERMS = [
  'refresh',
  'reload',
  'restart',
  'scan',
  'rescan',
  're-scan',
  'recompute',
  'reindex',
  're-index',
  'clear',
  'reset',
  'sync',
  'synchronize',
  'reconnect',
  'discover',
];

const SERVER_LIFECYCLE_TERMS = [
  'restart',
  'reload',
  'reindex',
  're-index',
  'rescan',
  're-scan',
  'reconnect',
];

const DEBUG_COMMAND_TERMS = [
  'debug',
  'launch',
  'start',
  'attach',
  'configuration',
];

const FORMAT_COMMAND_TERMS = [
  'format',
  'formatter',
  'formatting',
];

const ACCOUNT_COMMAND_TERMS = [
  'sign in',
  'signin',
  'login',
  'log in',
  'sign out',
  'signout',
  'logout',
  'log out',
  'manage account',
  'manage accounts',
  'session',
  'sessions',
  'clear session',
];

const TASK_COMMAND_TERMS = [
  'run',
  'refresh',
  'reload',
  'discover',
  'rescan',
  'scan',
];

const VIEW_COMMAND_TERMS = [
  'refresh',
  'reload',
  'reveal',
  'focus',
  'clear',
  'reset',
];

const WEBVIEW_COMMAND_TERMS = [
  'open',
  'show',
  'preview',
  'reload',
  'refresh',
  'settings',
  'help',
  'reset',
];

const TERMINAL_COMMAND_TERMS = [
  'terminal',
  'shell',
  'profile',
  'connect',
  'reconnect',
  'open',
  'start',
];

export function scanVsCodeCapabilities(
  pkg: PackageJson,
  rootDir?: string,
  scanDepth: CapabilityScanDepth = 'full',
): Issue[] {
  if (!hasVsCodeMarkers(pkg)) return [];

  const commands = getCommands(pkg);
  const searchableText = getSearchableText(pkg);
  const contributionKeys = getContributionKeys(pkg);
  const sourceSignals = rootDir && scanDepth !== 'manifest'
    ? scanSourceSignals(rootDir, scanDepth)
    : emptySourceSignals();
  const issues: Issue[] = [];

  const profiles = getCapabilityProfiles(pkg, searchableText, contributionKeys, commands, sourceSignals);
  for (const profile of profiles) {
    if (profile.strong && !profile.hasLifecycleCommand) {
      issues.push({
        rule: profile.rule,
        severity: profile.severity,
        category: 'manifest',
        file: 'package.json',
        message: profile.message,
        suggestion: profile.suggestion,
      });
    } else if (profile.weak && !profile.strong) {
      issues.push({
        rule: 'vscode-capability-keyword-only',
        severity: 'warning',
        category: 'manifest',
        file: 'package.json',
        message: `package.json keywords or description suggest a ${profile.displayName} extension, but the manifest does not expose matching contribution points. PublishGuard is treating this as advisory to avoid blocking keyword-only helpers.`,
        suggestion: 'If this extension really provides that capability, add the matching VS Code contribution points and user-facing refresh/restart commands. Otherwise remove or narrow the keyword to avoid confusing marketplace users.',
      });
    }
  }

  issues.push(...scanSourceBackedAdvice(pkg, sourceSignals));
  issues.push(...scanCommandActivationCompatibility(pkg, commands));

  return dedupeByRuleAndMessage(issues);
}

function scanSourceBackedAdvice(pkg: PackageJson, sourceSignals: SourceSignals): Issue[] {
  const issues: Issue[] = [];

  if (sourceSignals.webviewHtmlAssignment && !sourceSignals.webviewContentSecurityPolicy) {
    issues.push({
      rule: 'vscode-webview-missing-csp',
      severity: 'warning',
      category: 'manifest',
      file: 'package.json',
      message: 'Source code appears to assign webview HTML, but PublishGuard did not find an obvious Content Security Policy declaration.',
      suggestion: 'Add a webview <meta http-equiv="Content-Security-Policy"> tag, avoid broad script sources, and keep enableScripts disabled unless the webview needs scripts.',
    });
  }

  if (isWebExtension(pkg) && sourceSignals.nodeApiUsage) {
    issues.push({
      rule: 'vscode-web-extension-node-api-usage',
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
      message: 'This extension declares web extension support but source code appears to import Node-only APIs.',
      suggestion: 'Remove Node-only modules from the web extension entrypoint, split browser and desktop entrypoints, or remove "web" from extensionKind if the extension cannot run in VS Code for the Web.',
    });
  }

  return issues;
}

function getCapabilityProfiles(
  pkg: PackageJson,
  searchableText: string,
  contributionKeys: Set<string>,
  commands: CommandContribution[],
  sourceSignals: SourceSignals,
): CapabilityProfile[] {
  const hasProblemMatchers = hasContributionArray(pkg, 'problemMatchers') || hasContributionArray(pkg, 'problemPatterns');
  const hasLanguages = hasContributionArray(pkg, 'languages') || hasLanguageActivation(pkg);
  const hasScmContribution = hasScmMenu(pkg) || hasCategory(pkg, 'SCM Providers');
  const hasDebuggerContribution = hasContributionArray(pkg, 'debuggers');
  const hasFormatterSignal = hasCommandMatching(commands, FORMAT_COMMAND_TERMS) || hasText(searchableText, FORMATTER_TERMS);
  const hasTestingContribution = hasCategory(pkg, 'Testing') || hasTestContribution(pkg);
  const hasViewContribution = hasCustomViewContribution(pkg) || sourceSignals.webview || sourceSignals.customEditor;
  const hasAuthContribution = hasContributionArray(pkg, 'authentication') || sourceSignals.authentication;
  const hasTaskContribution = hasContributionArray(pkg, 'taskDefinitions') || sourceSignals.tasks;
  const hasNotebookContribution = hasContributionArray(pkg, 'notebooks') || sourceSignals.notebooks;
  const hasTerminalContribution = hasTerminalContributionPoint(pkg) || sourceSignals.terminals;

  const diagnosticStrong = hasCategory(pkg, 'Linters') || hasProblemMatchers || sourceSignals.diagnostics || hasText(searchableText, ['diagnostic', 'diagnostics', 'problems']);
  const languageServerStrong = sourceSignals.languageServer || (hasText(searchableText, LANGUAGE_SERVER_TERMS) && hasLanguages);
  const scmStrong = sourceSignals.scm || hasScmContribution || (hasCategory(pkg, 'SCM Providers') && hasText(searchableText, SCM_TERMS));
  const formatterStrong = hasFormatterSignal && (hasLanguages || hasContributionObject(pkg, 'configurationDefaults'));
  const testingStrong = hasTestingContribution || sourceSignals.testing;
  const debuggerStrong = hasDebuggerContribution || hasCategory(pkg, 'Debuggers');

  return [
    {
      name: 'diagnostics',
      displayName: 'diagnostic or linter',
      strong: diagnosticStrong,
      weak: hasText(searchableText, DIAGNOSTIC_TERMS),
      hasLifecycleCommand: hasCommandMatching(commands, COMMAND_LIFECYCLE_TERMS),
      rule: 'vscode-diagnostic-provider-missing-refresh-command',
      severity: 'error',
      message: 'This extension appears to publish diagnostics or linter Problems, but it does not contribute a refresh, restart, rescan, recompute, or clear command. Stale Problems entries must be cleaned up by the diagnostic owner.',
      suggestion: 'Expose a command such as "Refresh Diagnostics", "Restart Language Server", or "Clear Extension Diagnostics" that recomputes and clears this extension\'s own DiagnosticCollection or language server diagnostics.',
    },
    {
      name: 'languageServer',
      displayName: 'language server',
      strong: languageServerStrong,
      weak: hasText(searchableText, LANGUAGE_SERVER_TERMS),
      hasLifecycleCommand: hasCommandMatching(commands, SERVER_LIFECYCLE_TERMS),
      rule: 'vscode-language-server-missing-restart-command',
      severity: 'error',
      message: 'This extension appears to provide a language server, but it does not contribute a restart, reload, reconnect, rescan, or reindex command.',
      suggestion: 'Expose a command such as "Restart Language Server" or "Reload Language Server" so users can recover stale diagnostics, indexes, or server state without restarting the whole Extension Host.',
    },
    {
      name: 'scm',
      displayName: 'source-control',
      strong: scmStrong,
      weak: hasText(searchableText, SCM_TERMS),
      hasLifecycleCommand: hasCommandMatching(commands, COMMAND_LIFECYCLE_TERMS),
      rule: 'vscode-scm-provider-missing-refresh-command',
      severity: 'error',
      message: 'This extension appears to provide source-control integration, but it does not contribute a refresh, sync, rescan, or reconnect command.',
      suggestion: 'Expose a command such as "Refresh Source Control", "Sync Repository", or "Reconnect Repository" so users can recover stale repository state.',
    },
    {
      name: 'formatter',
      displayName: 'formatter',
      strong: formatterStrong,
      weak: hasText(searchableText, FORMATTER_TERMS),
      hasLifecycleCommand: hasCommandMatching(commands, FORMAT_COMMAND_TERMS) || hasCommandMatching(commands, COMMAND_LIFECYCLE_TERMS),
      rule: 'vscode-formatter-missing-command',
      severity: 'warning',
      message: 'This extension appears to provide formatting support, but it does not contribute an obvious format or configuration command.',
      suggestion: 'Expose a discoverable command for formatting or opening formatter settings when the extension has formatter-specific behavior users may need to trigger or configure.',
    },
    {
      name: 'testing',
      displayName: 'testing',
      strong: testingStrong,
      weak: hasText(searchableText, TEST_TERMS),
      hasLifecycleCommand: hasCommandMatching(commands, COMMAND_LIFECYCLE_TERMS),
      rule: 'vscode-test-provider-missing-refresh-command',
      severity: 'warning',
      message: 'This extension appears to provide testing or coverage features, but it does not contribute a refresh, rediscover, or reload command.',
      suggestion: 'Expose a command such as "Refresh Tests", "Rediscover Tests", or "Reload Coverage" so users can recover stale test state.',
    },
    {
      name: 'debugger',
      displayName: 'debugger',
      strong: debuggerStrong,
      weak: hasText(searchableText, DEBUGGER_TERMS),
      hasLifecycleCommand: hasCommandMatching(commands, DEBUG_COMMAND_TERMS),
      rule: 'vscode-debugger-missing-command',
      severity: 'warning',
      message: 'This extension appears to provide debugger support, but it does not contribute an obvious debug, launch, attach, or configuration command.',
      suggestion: 'Expose a discoverable command for launching, attaching, or opening debug configuration when users may need to manually recover or configure debugger state.',
    },
    {
      name: 'views',
      displayName: 'custom view or webview',
      strong: hasViewContribution,
      weak: false,
      hasLifecycleCommand: hasCommandMatching(commands, VIEW_COMMAND_TERMS),
      rule: 'vscode-view-provider-missing-refresh-command',
      severity: 'warning',
      message: 'This extension contributes custom views, webviews, or custom editors, but it does not expose an obvious refresh, reveal, reload, open, or reset command.',
      suggestion: 'Expose a command such as "Refresh View", "Reveal Current Item", "Reload Preview", or "Reset View State" so users can recover stale UI state without reloading VS Code.',
    },
    {
      name: 'authentication',
      displayName: 'authentication provider',
      strong: hasAuthContribution,
      weak: hasText(searchableText, ['authentication', 'auth', 'account', 'login', 'oauth']),
      hasLifecycleCommand: hasCommandMatching(commands, ACCOUNT_COMMAND_TERMS),
      rule: 'vscode-auth-provider-missing-account-command',
      severity: 'warning',
      message: 'This extension contributes or registers an authentication provider, but it does not expose an obvious sign-in, sign-out, session, or account-management command.',
      suggestion: 'Expose commands such as "Sign In", "Sign Out", "Manage Account", or "Clear Session" so users can recover authentication state and intentionally revoke extension-owned sessions.',
    },
    {
      name: 'tasks',
      displayName: 'task provider',
      strong: hasTaskContribution,
      weak: hasText(searchableText, ['task', 'tasks', 'runner', 'build']),
      hasLifecycleCommand: hasCommandMatching(commands, TASK_COMMAND_TERMS),
      rule: 'vscode-task-provider-missing-refresh-command',
      severity: 'warning',
      message: 'This extension appears to provide VS Code tasks, but it does not expose an obvious run, refresh, reload, rescan, or discover command.',
      suggestion: 'Expose a command such as "Run Task", "Refresh Tasks", or "Rediscover Tasks" so users can recover stale task definitions or manually trigger task discovery.',
    },
    {
      name: 'notebooks',
      displayName: 'notebook provider',
      strong: hasNotebookContribution,
      weak: hasText(searchableText, ['notebook', 'notebooks']),
      hasLifecycleCommand: hasCommandMatching(commands, WEBVIEW_COMMAND_TERMS) || hasCommandMatching(commands, COMMAND_LIFECYCLE_TERMS),
      rule: 'vscode-notebook-provider-missing-command',
      severity: 'warning',
      message: 'This extension appears to provide notebook support, but it does not expose an obvious open, reload, refresh, reset, export, or settings command.',
      suggestion: 'Expose a command for opening, reloading, exporting, or resetting notebook state when notebook content or renderers may become stale.',
    },
    {
      name: 'terminal',
      displayName: 'terminal provider',
      strong: hasTerminalContribution,
      weak: hasText(searchableText, ['terminal', 'shell', 'pty']),
      hasLifecycleCommand: hasCommandMatching(commands, TERMINAL_COMMAND_TERMS) || hasCommandMatching(commands, COMMAND_LIFECYCLE_TERMS),
      rule: 'vscode-terminal-provider-missing-command',
      severity: 'warning',
      message: 'This extension appears to provide terminal integration, but it does not expose an obvious open, start, connect, reconnect, or profile command.',
      suggestion: 'Expose a command for opening, starting, reconnecting, or managing terminal profiles so users can recover terminal integration state.',
    },
  ];
}

function scanSourceSignals(rootDir: string, scanDepth: Exclude<CapabilityScanDepth, 'manifest'>): SourceSignals {
  const signals = emptySourceSignals();
  const sourceText = readSourceText(rootDir, scanDepth);
  if (!sourceText) return signals;

  signals.diagnostics = /\bcreateDiagnosticCollection\b|\bDiagnosticCollection\b|\bpublishDiagnostics\b/.test(sourceText);
  signals.languageServer = /\bLanguageClient\b|\bvscode-languageclient\b|\blanguageserver\b|\blanguageServer\b/.test(sourceText);
  signals.scm = /\bcreateSourceControl\b|\bvscode\.scm\b|\bSourceControlResourceState\b/.test(sourceText);
  signals.testing = /\bcreateTestController\b|\bTestController\b|\bTestRun\b/.test(sourceText);
  signals.webview = /\bcreateWebviewPanel\b|\bregisterWebviewViewProvider\b|\bWebviewViewProvider\b|\bwebview\.html\b/.test(sourceText);
  signals.customEditor = /\bregisterCustomEditorProvider\b|\bCustomTextEditorProvider\b|\bCustomReadonlyEditorProvider\b/.test(sourceText);
  signals.authentication = /\bregisterAuthenticationProvider\b|\bAuthenticationProvider\b|\bauthentication\.getSession\b/.test(sourceText);
  signals.tasks = /\bregisterTaskProvider\b|\bTaskProvider\b|\bprovideTasks\b/.test(sourceText);
  signals.notebooks = /\bregisterNotebookSerializer\b|\bNotebookSerializer\b|\bNotebookController\b/.test(sourceText);
  signals.terminals = /\bcreateTerminal\b|\bregisterTerminalProfileProvider\b|\bPseudoterminal\b|\bExtensionTerminalOptions\b/.test(sourceText);
  signals.webviewHtmlAssignment = /\bwebview\.html\s=|\bhtml\s=.+<html|<meta[^>]+http-equiv=["']Content-Security-Policy["']/is.test(sourceText);
  signals.webviewContentSecurityPolicy = /Content-Security-Policy|http-equiv=["']Content-Security-Policy["']/i.test(sourceText);
  signals.nodeApiUsage = /(?:from\s+['"]node:(?:fs|path|os|child_process|net|http|https|crypto)['"]|require\(['"](?:node:)?(?:fs|path|os|child_process|net|http|https|crypto)['"]\))/i.test(sourceText);
  return signals;
}

function isWebExtension(pkg: PackageJson): boolean {
  if (typeof pkg.browser === 'string') return true;
  const extensionKind = pkg.extensionKind;
  if (typeof extensionKind === 'string') return extensionKind === 'web';
  return getStringArray(extensionKind).includes('web');
}

function readSourceText(rootDir: string, scanDepth: Exclude<CapabilityScanDepth, 'manifest'>): string {
  const fullPatterns = [
    'src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
    'extension.{ts,js,mts,cts,mjs,cjs}',
    'server/**/*.{ts,js,mts,cts,mjs,cjs}',
    'client/**/*.{ts,js,mts,cts,mjs,cjs}',
  ];
  const deepPatterns = [
    ...fullPatterns,
    'lib/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
    'app/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
    'packages/*/src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
    'webviews/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,html}',
    'media/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,html}',
  ];
  const patterns = scanDepth === 'deep' ? deepPatterns : fullPatterns;
  const maxFiles = scanDepth === 'deep' ? 300 : 80;
  const maxFileSize = scanDepth === 'deep' ? 512 * 1024 : 256 * 1024;
  const files = Array.from(new Set(patterns.flatMap((pattern) => glob.sync(pattern, {
    cwd: rootDir,
    dot: false,
    nodir: true,
    ignore: [
      'node_modules/**',
      '**/node_modules/**',
      'dist/**',
      '**/dist/**',
      'out/**',
      '**/out/**',
      '.git/**',
      '**/.git/**',
    ],
  })))).slice(0, maxFiles);

  return files.flatMap((file) => {
    try {
      const absolutePath = path.join(rootDir, file);
      const stat = fs.statSync(absolutePath);
      if (stat.size > maxFileSize) return [];
      return [fs.readFileSync(absolutePath, 'utf-8')];
    } catch {
      return [];
    }
  }).join('\n');
}

function scanCommandActivationCompatibility(pkg: PackageJson, commands: CommandContribution[]): Issue[] {
  if (commands.length === 0 || !targetsPre174VsCode(pkg)) return [];

  const activationEvents = getStringArray(pkg.activationEvents);
  if (activationEvents.includes('*')) return [];

  return commands
    .filter((command) => !activationEvents.includes(`onCommand:${command.command}`))
    .map((command) => ({
      rule: 'vscode-command-missing-activation-event',
      severity: 'warning' as const,
      category: 'manifest' as const,
      file: 'package.json',
      message: `Command "${command.command}" targets VS Code versions before 1.74 but is missing an "onCommand:${command.command}" activation event. VS Code 1.74+ activates contributed commands automatically; older supported versions do not.`,
      suggestion: `Add "onCommand:${command.command}" to activationEvents or raise engines.vscode to ^1.74.0 or newer.`,
    }));
}

function targetsPre174VsCode(pkg: PackageJson): boolean {
  const engines = isObject(pkg.engines) ? pkg.engines : {};
  const vscode = typeof engines.vscode === 'string' ? engines.vscode : '';
  const match = vscode.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 0) return true;
  if (major > 1) return false;
  return minor < 74;
}

function getCommands(pkg: PackageJson): CommandContribution[] {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  const rawCommands = Array.isArray(contributes.commands) ? contributes.commands : [];
  return rawCommands.flatMap((entry) => {
    if (!isObject(entry) || typeof entry.command !== 'string') return [];
    return [{
      command: entry.command,
      title: typeof entry.title === 'string' ? entry.title : '',
    }];
  });
}

function getSearchableText(pkg: PackageJson): string {
  return [
    pkg.name,
    pkg.displayName,
    pkg.description,
    ...getStringArray(pkg.categories),
    ...getStringArray(pkg.keywords),
  ].filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function getContributionKeys(pkg: PackageJson): Set<string> {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  return new Set(Object.keys(contributes));
}

function hasCommandMatching(commands: CommandContribution[], terms: string[]): boolean {
  return commands.some((command) => hasText(`${command.command} ${command.title}`.toLowerCase(), terms));
}

function hasText(haystack: string, terms: string[]): boolean {
  return terms.some((term) => termPattern(term).test(haystack));
}

function termPattern(term: string): RegExp {
  const escaped = escapeRegExp(term.toLowerCase()).replace(/(?:\\ |\\-)+/g, '[\\s-]+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasCategory(pkg: PackageJson, category: string): boolean {
  return getStringArray(pkg.categories).some((candidate) => candidate.toLowerCase() === category.toLowerCase());
}

function hasContributionArray(pkg: PackageJson, key: string): boolean {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  return Array.isArray(contributes[key]) && (contributes[key] as unknown[]).length > 0;
}

function hasContributionObject(pkg: PackageJson, key: string): boolean {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  return isObject(contributes[key]);
}

function hasLanguageActivation(pkg: PackageJson): boolean {
  return getStringArray(pkg.activationEvents).some((event) => event === 'onLanguage' || event.startsWith('onLanguage:'));
}

function hasScmMenu(pkg: PackageJson): boolean {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  const menus = isObject(contributes.menus) ? contributes.menus : {};
  return Object.keys(menus).some((key) => key.startsWith('scm/'));
}

function hasTestContribution(pkg: PackageJson): boolean {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  const views = isObject(contributes.views) ? contributes.views : {};
  const menus = isObject(contributes.menus) ? contributes.menus : {};
  return [...Object.keys(views), ...Object.keys(menus)].some((key) => /\btest|coverage/i.test(key));
}

function hasCustomViewContribution(pkg: PackageJson): boolean {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  return hasNonEmptyContributionObject(pkg, 'views') ||
    hasNonEmptyContributionObject(pkg, 'viewsContainers') ||
    hasContributionArray(pkg, 'customEditors') ||
    hasViewMenu(contributes);
}

function hasViewMenu(contributes: Record<string, unknown>): boolean {
  const menus = isObject(contributes.menus) ? contributes.menus : {};
  return Object.keys(menus).some((key) => key.startsWith('view/') || key === 'webview/context');
}

function hasTerminalContributionPoint(pkg: PackageJson): boolean {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  if (isObject(contributes.terminal) && Object.keys(contributes.terminal).length > 0) return true;
  const menus = isObject(contributes.menus) ? contributes.menus : {};
  return Object.keys(menus).some((key) => key.startsWith('terminal/'));
}

function hasNonEmptyContributionObject(pkg: PackageJson, key: string): boolean {
  const contributes = isObject(pkg.contributes) ? pkg.contributes : {};
  return isObject(contributes[key]) && Object.keys(contributes[key]).length > 0;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function hasVsCodeMarkers(pkg: PackageJson): boolean {
  if (isObject(pkg.engines) && pkg.engines.vscode) return true;
  if (pkg.activationEvents) return true;
  if (pkg.contributes) return true;
  if (pkg.publisher) return true;
  if (pkg.categories) return true;
  return false;
}

function dedupeByRuleAndMessage(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.rule}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptySourceSignals(): SourceSignals {
  return {
    diagnostics: false,
    languageServer: false,
    scm: false,
    testing: false,
    webview: false,
    customEditor: false,
    authentication: false,
    tasks: false,
    notebooks: false,
    terminals: false,
    webviewHtmlAssignment: false,
    webviewContentSecurityPolicy: false,
    nodeApiUsage: false,
  };
}
