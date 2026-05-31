import ignore from 'ignore';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Issue, Severity } from '../types';

const SAFE_IGNORE_RULES: Array<{ pattern: string; reason: string; severity: Severity }> = [
  { pattern: '.env', reason: 'Prevents leaking environment variables', severity: 'error' },
  { pattern: '.env.*', reason: 'Prevents leaking env-specific configs', severity: 'error' },
  { pattern: '*.log', reason: 'Prevents publishing debug/error logs', severity: 'warning' },
  { pattern: 'node_modules', reason: 'Prevents publishing dependencies', severity: 'warning' },
  { pattern: '**/node_modules', reason: 'Prevents publishing nested workspace dependencies', severity: 'warning' },
  { pattern: '.git', reason: 'Prevents publishing git metadata', severity: 'error' },
  { pattern: '*.pem', reason: 'Prevents publishing private keys', severity: 'error' },
  { pattern: '*.key', reason: 'Prevents publishing key files', severity: 'error' },
  { pattern: '*.p12', reason: 'Prevents publishing keystores', severity: 'error' },
  { pattern: '*.pfx', reason: 'Prevents publishing keystores', severity: 'error' },
  { pattern: 'credentials*', reason: 'Prevents publishing credential files', severity: 'error' },
  { pattern: 'secrets*', reason: 'Prevents publishing secret files', severity: 'error' },
  { pattern: '*.js.map', reason: 'Prevents publishing source maps', severity: 'warning' },
  { pattern: '*.css.map', reason: 'Prevents publishing CSS source maps', severity: 'warning' },
  { pattern: '*.ts.map', reason: 'Prevents publishing TS source maps', severity: 'warning' },
  { pattern: 'coverage', reason: 'Prevents publishing coverage reports', severity: 'warning' },
  { pattern: '.nyc_output', reason: 'Prevents publishing coverage data', severity: 'warning' },
  { pattern: 'test-data', reason: 'Prevents publishing test data', severity: 'info' },
  { pattern: '__tests__', reason: 'Prevents publishing test directories', severity: 'info' },
  { pattern: '*.test.*', reason: 'Prevents publishing test files', severity: 'info' },
  { pattern: '*.spec.*', reason: 'Prevents publishing test files', severity: 'info' },
  { pattern: '**/.DS_Store', reason: 'Prevents publishing macOS metadata', severity: 'info' },
  { pattern: '**/Thumbs.db', reason: 'Prevents publishing Windows metadata', severity: 'info' },
  { pattern: '.vscode-test', reason: 'Prevents publishing VS Code test data', severity: 'warning' },
  { pattern: '*.vsix', reason: 'Prevents publishing extension packages', severity: 'warning' },
  { pattern: '*.tgz', reason: 'Prevents publishing npm tarballs', severity: 'warning' },
  { pattern: '*.tar.gz', reason: 'Prevents publishing tarballs', severity: 'warning' },
];

export interface IgnoreValidationResult {
  fileResults: Array<{
    fileName: string;
    issues: Issue[];
  }>;
  suggestedRules: Array<{
    file: string;
    rules: string[];
    reasons: string[];
  }>;
}

export interface IgnoreValidationOptions {
  rootDir: string;
  publishedFiles: string[];
  ignoreFiles?: string[];
}

export function validateIgnoreFiles(options: IgnoreValidationOptions): IgnoreValidationResult {
  const { rootDir, publishedFiles } = options;
  const ignoreFileNames = options.ignoreFiles ?? ['.npmignore', '.vscodeignore', '.gitignore'];

  const fileResults: IgnoreValidationResult['fileResults'] = [];
  const suggestedRules: IgnoreValidationResult['suggestedRules'] = [];

  for (const fileName of ignoreFileNames) {
    const filePath = path.join(rootDir, fileName);
    const issues: Issue[] = [];
    const exists = fs.existsSync(filePath);

    if (!exists) {
      if (fileName !== '.gitignore') {
        issues.push({
          rule: 'missing-ignore-file',
          severity: 'warning',
          category: 'ignore-file',
          file: fileName,
          message: `${fileName} does not exist. Without it, sensitive files may be published accidentally.`,
          suggestion: `Run "publishguard init" to generate a safe ${fileName}.`,
        });
      }
      fileResults.push({ fileName, issues });
      continue;
    }

    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const rawLines = rawContent.split(/\r?\n/);

    const nonEmptyLines = rawLines.filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
    if (nonEmptyLines.length === 0) {
      issues.push({
        rule: 'empty-ignore-file',
        severity: 'warning',
        category: 'ignore-file',
        file: fileName,
        message: `${fileName} exists but has no active rules.`,
      });
    }

    const igInstance = ignore().add(rawContent);
    const missingSafeRules: Array<{ pattern: string; reason: string; severity: Severity }> = [];

    for (const safeRule of SAFE_IGNORE_RULES) {
      const matchingFiles = publishedFiles.filter((f) => matchSimpleGlob(f, safeRule.pattern));
      if (matchingFiles.length > 0 && !igInstance.ignores(safeRule.pattern)) {
        missingSafeRules.push(safeRule);
        issues.push({
          rule: `missing-ignore-${safeRule.pattern.replace(/[.*]/g, '').replace(/[^a-zA-Z0-9_-]/g, '-')}`,
          severity: safeRule.severity,
          category: 'ignore-file',
          file: fileName,
          message: `"${safeRule.pattern}" should be in ${fileName}: ${safeRule.reason}. Affected files: ${matchingFiles.join(', ')}`,
          suggestion: `Add "${safeRule.pattern}" to ${fileName}`,
        });
      }
    }

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (line === '' || line.startsWith('#')) continue;
      const lineNum = i + 1;

      if (line.endsWith('/') && !line.startsWith('/')) {
        issues.push({
          rule: 'trailing-slash',
          severity: 'info',
          category: 'ignore-file',
          file: fileName,
          message: `${fileName}:${lineNum} has a trailing slash ("${line}"). A trailing slash matches only directories, which may not be intended.`,
        });
      }

      if (line.startsWith('/') && !line.startsWith('!')) {
        issues.push({
          rule: 'leading-slash',
          severity: 'info',
          category: 'ignore-file',
          file: fileName,
          message: `${fileName}:${lineNum} has a leading slash ("${line}"). Patterns are already relative to project root.`,
        });
      }
    }

    const negationLines = rawLines.filter((l) => l.trim().startsWith('!'));
    for (const negLine of negationLines) {
      const pattern = negLine.trim().slice(1);
      if (pattern === '' || pattern === '*') {
        issues.push({
          rule: 'dangerous-negation',
          severity: 'warning',
          category: 'ignore-file',
          file: fileName,
          message: `"${negLine.trim()}" in ${fileName} negates too broadly and may accidentally include sensitive files.`,
          suggestion: `Use more specific negation patterns, e.g., "!/dist/important-file.js".`,
        });
      }
    }

    if (missingSafeRules.length > 0) {
      suggestedRules.push({
        file: fileName,
        rules: missingSafeRules.map((r) => r.pattern),
        reasons: missingSafeRules.map((r) => r.reason),
      });
    }

    fileResults.push({ fileName, issues });
  }

  return { fileResults, suggestedRules };
}

function matchSimpleGlob(filePath: string, pattern: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  regexStr = `(^|/)${regexStr}($|/)`;
  return new RegExp(regexStr).test(normalized);
}

export const SAFE_DEFAULT_IGNORE_RULES: string[] = [
  '# ---- PublishGuard: auto-generated safe ignore rules ----',
  '.env',
  '.env.*',
  '*.log',
  'node_modules',
  '**/node_modules',
  '.git',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  'credentials*',
  'secrets*',
  '*.js.map',
  '*.css.map',
  '*.ts.map',
  'coverage',
  '.nyc_output',
  'test-data',
  '__tests__',
  '*.test.*',
  '*.spec.*',
  '**/.DS_Store',
  '**/Thumbs.db',
  '.vscode-test',
  '*.vsix',
  '*.tgz',
  '*.tar.gz',
];

export function generateSafeIgnoreFile(rootDir: string, fileName: string): { created: boolean; rulesAdded: string[] } {
  const filePath = path.join(rootDir, fileName);
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    const newRules = SAFE_DEFAULT_IGNORE_RULES.filter(
      (rule) => !rule.startsWith('#') && !existing.includes(rule),
    );
    if (newRules.length === 0) return { created: false, rulesAdded: [] };
    const header = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(filePath, header + '\n# PublishGuard additions\n' + newRules.join('\n') + '\n');
    return { created: false, rulesAdded: newRules };
  }
  fs.writeFileSync(filePath, SAFE_DEFAULT_IGNORE_RULES.join('\n') + '\n');
  const rules = SAFE_DEFAULT_IGNORE_RULES.filter((r) => !r.startsWith('#'));
  return { created: true, rulesAdded: rules };
}
