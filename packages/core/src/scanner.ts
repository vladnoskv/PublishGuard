import * as path from 'node:path';
import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';
import { glob } from 'glob';
import { getNpmPublishFiles, getVsixPublishFiles } from './scanners/file-list';
import { scanSecrets } from './scanners/secrets';
import { validateIgnoreFiles } from './scanners/ignore-validator';
import { scanManifest } from './scanners/manifest';
import { scanFileSizes } from './scanners/file-size';
import { scanDependencies } from './scanners/dependencies';
import { loadConfig, parseSize } from './config';
import type { ScanResult, Issue } from './types';
import type { ExampleFilesConfig, ScanOptions, SuppressionConfig } from './config';

const micromatch = require('micromatch') as {
  isMatch(input: string, pattern: string | string[], options?: { dot?: boolean }): boolean;
};

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  const { projectRoot } = options;
  const config = loadConfig(projectRoot);
  const allIssues: Issue[] = [];

  const packageType = options.packageType ?? detectPackageType(projectRoot);

  let publishedFiles: string[] = [];
  let fileListMethod = 'none';

  if (packageType === 'npm' || packageType === 'both') {
    publishedFiles = await getNpmPublishFiles(projectRoot);
    fileListMethod = 'npm-cli';
  }
  if (packageType === 'vscode' || packageType === 'both') {
    const vsixFiles = await getVsixPublishFiles(projectRoot);
    publishedFiles = Array.from(new Set([...publishedFiles, ...vsixFiles]));
    fileListMethod = packageType === 'vscode' ? 'vsce-cli' : 'combined';
  }
  publishedFiles = Array.from(new Set(publishedFiles.map((file) => normalizeFile(file)))).sort();
  const scanFiles = applyIgnoreGlobs(getScanFiles({
    projectRoot,
    publishedFiles,
    stagedFiles: options.stagedFiles,
    includeGitIgnored: options.includeGitIgnored ?? config.includeGitIgnored,
    exampleFiles: config.exampleFiles,
  }), config.ignore);

  if (!options.skip?.includes('manifest')) {
    const manifestResult = await scanManifest(projectRoot);
    allIssues.push(...filterByConfig(manifestResult.issues, config));
  }

  if (!options.skip?.includes('ignore-validation')) {
    const ignoreFileNames =
      packageType === 'vscode' || packageType === 'both'
        ? ['.vscodeignore', '.npmignore', '.gitignore']
        : ['.npmignore', '.gitignore'];

    const ignoreResult = validateIgnoreFiles({
      rootDir: projectRoot,
      publishedFiles,
      ignoreFiles: ignoreFileNames,
    });
    for (const fr of ignoreResult.fileResults) {
      allIssues.push(...filterByConfig(fr.issues, config));
    }
  }

  if (!options.skip?.includes('secrets')) {
    const secretIssues = await scanSecrets({
      files: scanFiles,
      rootDir: projectRoot,
    });
    allIssues.push(...filterByConfig(secretIssues, config));
  }

  if (!options.skip?.includes('file-size')) {
    const cfgWarn = config.fileSize?.warnThreshold ?? '5MB';
    const cfgError = config.fileSize?.errorThreshold ?? '50MB';
    const sizeIssues = scanFileSizes({
      files: scanFiles,
      rootDir: projectRoot,
      warnThreshold: parseSize(cfgWarn),
      errorThreshold: parseSize(cfgError),
    });
    allIssues.push(...filterByConfig(sizeIssues, config));
  }

  if (!options.skip?.includes('dependencies')) {
    allIssues.push(...filterByConfig(await scanDependencies(projectRoot, {
      npmAudit: options.dependencyAudit ?? config.dependencyAudit?.enabled ?? false,
      socketDev: options.socketDev ?? config.socketDev?.enabled ?? false,
    }), config));
  }

  const uniqueIssues = filterSuppressedIssues(
    applyExampleFilePolicy(
      applyIssueIgnoreGlobs(deduplicateIssues(allIssues.map(withFingerprint)), config.ignore),
      config.exampleFiles,
    ),
    config.suppressions,
  );

  const severityOrder = { error: 0, warning: 1, info: 2 };
  uniqueIssues.sort((a, b) => {
    const sDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sDiff !== 0) return sDiff;
    return a.rule.localeCompare(b.rule);
  });

  const errors = uniqueIssues.filter((i) => i.severity === 'error').length;
  const warnings = uniqueIssues.filter((i) => i.severity === 'warning').length;
  const infos = uniqueIssues.filter((i) => i.severity === 'info').length;

  return {
    projectRoot,
    packageType,
    publishedFiles,
    fileListMethod,
    issues: uniqueIssues,
    summary: { errors, warnings, infos },
    durationMs: Date.now() - startTime,
  };
}

function detectPackageType(rootDir: string): 'npm' | 'vscode' | 'both' | 'unknown' {
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return 'unknown';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.engines?.vscode || pkg.activationEvents || pkg.contributes || pkg.publisher) {
      return 'both';
    }
    return 'npm';
  } catch {
    return 'unknown';
  }
}

function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.rule}::${i.file}::${i.message}::${i.fingerprint ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getScanFiles(options: {
  projectRoot: string;
  publishedFiles: string[];
  stagedFiles?: string[];
  includeGitIgnored?: boolean;
  exampleFiles: ExampleFilesConfig;
}): string[] {
  const publishedSet = new Set(options.publishedFiles.map((file) => normalizeFile(file, options.projectRoot)));
  const filesSet = new Set(publishedSet);

  if (options.includeGitIgnored) {
    for (const file of getGitIgnoredWorkspaceFiles(options.projectRoot)) {
      filesSet.add(file);
    }
  }

  if (options.exampleFiles.scanUnpublished) {
    for (const file of getExampleFiles(options.projectRoot, options.exampleFiles.patterns)) {
      filesSet.add(file);
    }
  } else if (options.exampleFiles.scanGitHistory) {
    for (const file of getGitHistoryExampleFiles(options.projectRoot, options.exampleFiles.patterns)) {
      filesSet.add(file);
    }
  }

  let files = Array.from(filesSet);

  if (options.stagedFiles) {
    const stagedSet = new Set(options.stagedFiles.map((file) => normalizeFile(file, options.projectRoot)));
    files = files.filter((file) => stagedSet.has(file));
  }

  // Published/exposed files are the authority for content scans. Gitignored
  // files are added only when explicitly requested for local workspace sweeps.
  return files;
}

function getGitIgnoredWorkspaceFiles(projectRoot: string): string[] {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];

  const ig = require('ignore')().add(fs.readFileSync(gitignorePath, 'utf-8'));
  return Array.from(new Set(glob.sync('**/*', {
    cwd: projectRoot,
    dot: true,
    nodir: true,
    ignore: ['.git/**', '**/.git/**', 'node_modules/**', '**/node_modules/**'],
  })
    .map((file) => normalizeFile(file))
    .filter((file) => ig.ignores(file))));
}

function getExampleFiles(projectRoot: string, patterns: readonly string[]): string[] {
  return Array.from(new Set(patterns.flatMap((pattern) => glob.sync(pattern, {
    cwd: projectRoot,
    dot: true,
    nodir: true,
    ignore: ['node_modules/**', '**/node_modules/**', '.git/**', '**/.git/**'],
  }).map((file) => normalizeFile(file)))));
}

function getGitHistoryExampleFiles(projectRoot: string, patterns: readonly string[]): string[] {
  const historyFiles = getGitHistoryFiles(projectRoot);
  if (historyFiles.length === 0) return [];
  return historyFiles.filter((file) => (
    fs.existsSync(path.join(projectRoot, file)) &&
    micromatch.isMatch(normalizeIssuePath(file), Array.from(patterns), { dot: true })
  ));
}

function getGitHistoryFiles(projectRoot: string): string[] {
  try {
    const stdout = childProcess.execFileSync('git', ['log', '--name-only', '--pretty=format:'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return Array.from(new Set(stdout
      .split(/\r?\n/)
      .map((line) => normalizeFile(line.trim(), projectRoot))
      .filter(Boolean)));
  } catch {
    return [];
  }
}

function normalizeFile(file: string, projectRoot?: string): string {
  const relativeFile = projectRoot && path.isAbsolute(file) ? path.relative(projectRoot, file) : file;
  return relativeFile.replace(/\\/g, '/').replace(/^\.\//, '');
}

function applyIgnoreGlobs(files: string[], ignoreGlobs: readonly string[]): string[] {
  if (ignoreGlobs.length === 0) return files;
  const patterns = Array.from(ignoreGlobs);
  return files.filter((file) => !micromatch.isMatch(normalizeIssuePath(file), patterns, { dot: true }));
}

function applyIssueIgnoreGlobs(issues: Issue[], ignoreGlobs: readonly string[]): Issue[] {
  if (ignoreGlobs.length === 0) return issues;
  const patterns = Array.from(ignoreGlobs);
  return issues.filter((issue) => {
    if (!issue.file) return true;
    return !micromatch.isMatch(normalizeIssuePath(issue.file), patterns, { dot: true });
  });
}

function withFingerprint(issue: Issue): Issue {
  const line = issue.location?.line ?? 1;
  const column = issue.location?.column ?? 1;
  return {
    ...issue,
    fingerprint: `${issue.rule}:${issue.file}:${line}:${column}`,
  };
}

function applyExampleFilePolicy(issues: Issue[], config: ExampleFilesConfig): Issue[] {
  return issues.flatMap((issue) => {
    if (!isExampleFile(issue.file, config.patterns) || !isDummySecretIssue(issue)) {
      return [issue];
    }
    if (config.dummySecretSeverity === 'off') return [];
    return [{
      ...issue,
      severity: config.dummySecretSeverity,
      suggestion: [
        issue.suggestion,
        'This looks like an example or documentation false positive. Keep git-tracked or published examples reviewed, or add an issue suppression if it is intentionally safe.',
      ].filter(Boolean).join(' '),
    }];
  });
}

function isExampleFile(file: string, patterns: readonly string[]): boolean {
  return micromatch.isMatch(normalizeIssuePath(file), Array.from(patterns), { dot: true });
}

function isDummySecretIssue(issue: Issue): boolean {
  if (issue.category !== 'secrets') return false;
  const haystack = [
    issue.file,
    issue.message,
    issue.location?.excerpt,
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(dummy|example|fake|fixture|placeholder|sample|synthetic|test)\b/.test(haystack);
}

function filterSuppressedIssues(issues: Issue[], suppressions: readonly unknown[]): Issue[] {
  if (suppressions.length === 0) return issues;
  return issues.filter((issue) => !suppressions.some((suppression) => matchesSuppression(issue, suppression)));
}

function matchesSuppression(issue: Issue, suppression: unknown): boolean {
  if (!isSuppressionObject(suppression)) return false;
  if (typeof suppression.reason !== 'string' || !suppression.reason.trim()) return false;

  const fingerprint = typeof suppression.fingerprint === 'string' ? nonBlank(suppression.fingerprint) : undefined;
  const rule = typeof suppression.rule === 'string' ? nonBlank(suppression.rule) : undefined;
  const file = typeof suppression.file === 'string' ? nonBlank(suppression.file) : undefined;
  if (!fingerprint && !rule && !file) return false;

  if (fingerprint && issue.fingerprint !== fingerprint) return false;
  if (rule && issue.rule !== rule) return false;
  if (file && !micromatch.isMatch(normalizeIssuePath(issue.file), normalizeIssuePath(file), { dot: true })) {
    return false;
  }

  return true;
}

function isSuppressionObject(value: unknown): value is Partial<Record<keyof SuppressionConfig, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeIssuePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function filterByConfig(issues: Issue[], config: ReturnType<typeof loadConfig>): Issue[] {
  return issues.flatMap((issue) => {
    const ruleConfig = config.rules[issue.rule];
    if (ruleConfig === undefined) {
      // Unknown rules pass through at their default severity
      return [issue];
    }
    if (ruleConfig === 'off') return [];
    const configuredSeverity = typeof ruleConfig === 'string' ? ruleConfig : ruleConfig[0];
    // Update severity to match config
    return [{ ...issue, severity: configuredSeverity as Issue['severity'] }];
  });
}
