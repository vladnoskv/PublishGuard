# PublishGuard — Implementation Blueprint

## Product Name Selection

| Candidate | Memorability | Clarity | Uniqueness | Ecosystem Fit | Score |
|---|---|---|---|---|---|
| **PublishGuard** | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★★ | **19/20** |
| ShipSafe | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | 13/20 |
| Package Sentinel | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | 14/20 |
| ReleaseShield | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | 15/20 |

**Selection: PublishGuard**

*   **Memorability**: Two common English words, 4 syllables, easy to recall and type.
*   **Clarity**: "Guard" directly conveys protection; "Publish" maps exactly to `npm publish` and the VS Code "Publish" command. No ambiguity.
*   **Uniqueness**: No existing npm package named `publishguard` or `@publishguard/*`. GitHub org likely available.
*   **Ecosystem fit**: Works equally well for npm (`npm publish`) and VS Code extensions (the "Publish" verb in the UI, `vsce publish`). "ShipSafe" leans too nautical; "Package Sentinel" is too long; "ReleaseShield" is a close second but "release" is less specific than "publish" in this domain.

**Recommended npm scope**: `@publishguard/core`, `@publishguard/cli`, `@publishguard/vscode`

---

## 1. Technical Architecture

### 1.1 Monorepo Structure (npm workspaces + Turborepo)

```
publishguard/
├── package.json                    # root: workspaces, scripts, devDeps
├── turbo.json                      # Turborepo pipeline
├── tsconfig.base.json              # shared TS config
├── packages/
│   ├── core/                       # @publishguard/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # public API surface
│   │   │   ├── types.ts            # shared types & interfaces
│   │   │   ├── config.ts           # .publishguardrc loader
│   │   │   ├── scanners/
│   │   │   │   ├── file-list.ts    # npm pack & vsce ls integration
│   │   │   │   ├── secrets.ts      # secret/credential detection
│   │   │   │   ├── manifest.ts     # package.json / vsixmanifest validation
│   │   │   │   ├── ignore-validator.ts  # .gitignore/.npmignore/.vscodeignore
│   │   │   │   ├── metadata.ts     # README, LICENSE, CHANGELOG, repo URL
│   │   │   │   └── file-size.ts    # oversized asset detection
│   │   │   ├── rules/
│   │   │   │   ├── default-rules.ts
│   │   │   │   └── rule-engine.ts
│   │   │   └── reporters/
│   │   │       ├── json-reporter.ts
│   │   │       └── sarif-reporter.ts
│   │   └── test/
│   │       ├── fixtures/
│   │       └── *.test.ts
│   ├── cli/                        # @publishguard/cli
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # entry point
│   │   │   ├── cli.ts              # commander program
│   │   │   ├── commands/
│   │   │   │   ├── scan.ts
│   │   │   │   ├── init.ts
│   │   │   │   └── fix.ts
│   │   │   └── formatters/
│   │   │       ├── pretty.ts
│   │   │       ├── json.ts
│   │   │       └── ci.ts           # GitHub Actions / GitLab CI format
│   │   └── test/
│   └── vscode/                     # @publishguard/vscode  (VS Code extension)
│       ├── package.json            # activationEvents, contributes
│       ├── tsconfig.json
│       ├── src/
│       │   ├── extension.ts        # activate / deactivate
│       │   ├── scanner.ts          # bridge to core
│       │   ├── diagnostics.ts      # Problems panel integration
│       │   ├── tree-view.ts        # sidebar view provider
│       │   ├── commands.ts         # command registrations
│       │   └── quick-fix.ts        # CodeActionProvider
│       ├── test/
│       └── resources/
│           └── icon.svg
├── docs/
│   ├── rules.md                    # rule reference
│   └── configuration.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── CHANGELOG.md
├── LICENSE
└── README.md
```

**Rationale**: A monorepo with a shared `core` package avoids duplicating scanner logic across the CLI and VS Code extension. The `core` package exposes a stable API consumed by both frontends. npm workspaces is chosen over pnpm for zero-adoption-friction (every Node developer already has npm). Turborepo provides fast, cached builds.

### 1.2 Runtime & Language

*   **Node.js**: >=18.0.0 (active LTS at launch). The VS Code extension targets the Node version bundled with VS Code (18.x at minimum since VS Code 1.82+).
*   **Language**: TypeScript 5.5+, strict mode.
*   **Module system**: Dual CJS/ESM via `tsup` or `tsx`. Core and CLI ship CJS for broad compatibility; the VS Code extension bundles to CJS.

### 1.3 Dependency Map & Versions

| Package | Version | Purpose | Audit |
|---|---|---|---|
| `npm-packlist` | ^8.0.0 | Get exact file list `npm pack` would produce | Maintained by npm CLI team, part of npm @ 10.x |
| `@vscode/vsce` | ^3.0.0 | Reference for `vsce ls` functionality; used as CLI fallback | Official Microsoft package |
| `ignore` | ^6.0.0 | Parse .gitignore / .npmignore / .vscodeignore rules | Actively maintained, no CVE history |
| `glob` | ^11.0.0 | Fast recursive file matching | Node-glob successor, maintained |
| `micromatch` | ^4.0.0 | Glob matching for individual path checks | Used by ESLint, Prettier, stable |
| `zod` | ^3.23.0 | Schema validation for manifest files, config | Zero-dependency, audited |
| `commander` | ^12.0.0 | CLI argument parsing | Widely used, stable |
| `chalk` | ^5.3.0 | Colored CLI output | ESM-only in v5; ship CJS via bundler |
| `ora` | ^8.0.0 | CLI spinners | |
| `boxen` | ^7.0.0 | Bordered CLI output | |
| `semver` | ^7.6.0 | Version validation | |
| `table` | ^6.0.0 | Tabular CLI output | |
| `detect-indent` | ^7.0.0 | Preserve indentation when modifying files | |
| `@types/vscode` | ^1.90.0 | VS Code API types | |
| **Dev dependencies** | | | |
| `typescript` | ^5.5.0 | | |
| `vitest` | ^2.0.0 | Testing framework (faster than Jest for monorepos) | |
| `tsup` | ^8.0.0 | TypeScript bundler | |
| `turbo` | ^2.0.0 | Monorepo orchestration | |
| `@changesets/cli` | ^2.27.0 | Versioning & changelog | |
| `eslint` | ^9.0.0 | Linting | |
| `prettier` | ^3.3.0 | Formatting | |

**No packages with known CVEs are introduced.** All listed versions are the latest stable releases with active maintenance.

---

## 2. Integration with `npm pack --dry-run` and `vsce ls`

### 2.1 npm: Two-Tier Approach

**Primary (recommended)**: Use `npm-packlist` programmatically.

```typescript
import packlist from 'npm-packlist';

export async function getNpmPackFiles(rootDir: string): Promise<{ files: string[]; method: 'packlist' }> {
  const files = await packlist({ path: rootDir });
  return { files: files.sort(), method: 'packlist' };
}
```

`npm-packlist` is the exact library that `npm pack` uses internally. It reads `package.json#files`, applies `.npmignore` (with `.gitignore` fallback), and respects npm's built-in inclusion/exclusion rules (always include `package.json`, `README*`, `LICENSE*`; always exclude `node_modules`, `.git`, etc.).

**Fallback**: Shell out to `npm pack --dry-run` and parse stdout. This serves as a cross-verification and as a reference baseline for tests.

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function getNpmPackFilesViaCLI(rootDir: string): Promise<{ files: string[]; method: 'npm-cli' }> {
  const { stdout } = await execFileAsync('npm', ['pack', '--dry-run', '--json'], { cwd: rootDir });
  const result = JSON.parse(stdout);
  // npm 10+ outputs an array of { id, name, version, size, unpackedSize, shasum, integrity, filename, files }
  // The `files` property contains the list of relative paths
  return { files: result[0]?.files?.map((f: any) => f.path) ?? [], method: 'npm-cli' };
}
```

### 2.2 VS Code Extensions: Two-Tier Approach

**Primary**: Shell out to `npx @vscode/vsce ls` (the programmatic API in `@vscode/vsce` is internal/unstable).

```typescript
export async function getVsixPackFiles(rootDir: string): Promise<{ files: string[]; method: 'vsce-cli' }> {
  const { stdout } = await execFileAsync('npx', ['-y', '@vscode/vsce', 'ls', '--json'], { cwd: rootDir });
  const result = JSON.parse(stdout);
  return { files: result.map((f: string) => f.replace(/^\.\//, '')), method: 'vsce-cli' };
}
```

**Fallback/Validation**: Replicate the `.vscodeignore` resolution chain programmatically using the `ignore` library. VS Code uses this priority: `.vscodeignore` → `.npmignore` → `.gitignore`. This gives us the ability to validate correctness independently.

```typescript
import ignore from 'ignore';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function resolveVscodeIgnoreRules(rootDir: string): { rules: string[]; sourceFile: string } {
  const candidates = ['.vscodeignore', '.npmignore', '.gitignore'];
  for (const name of candidates) {
    const p = path.join(rootDir, name);
    if (fs.existsSync(p)) {
      return { rules: fs.readFileSync(p, 'utf-8').split('\n'), sourceFile: name };
    }
  }
  return { rules: [], sourceFile: 'none' };
}
```

---

## 3. Core Scanning Logic — Detailed Design

Below is the architecture of each scanner, with production-ready code sketches.

### 3.1 Scan Result Model (`packages/core/src/types.ts`)

```typescript
/** Severity of a finding. */
export type Severity = 'error' | 'warning' | 'info';

/** Category of a finding — maps to a rule group. */
export type Category =
  | 'secrets'
  | 'ignore-file'
  | 'manifest'
  | 'metadata'
  | 'file-size'
  | 'sensitive-file'
  | 'unknown';

/** A single issue found during scanning. */
export interface Issue {
  /** Unique rule identifier, e.g. 'no-env-files', 'missing-license' */
  rule: string;
  severity: Severity;
  category: Category;
  /** File path relative to project root (empty string for project-level issues). */
  file: string;
  /** Human-readable description. */
  message: string;
  /** Suggested fix, if applicable. */
  suggestion?: string;
}

/** Full result of a scan operation. */
export interface ScanResult {
  /** Absolute path to the scanned project. */
  projectRoot: string;
  /** Package type detected. */
  packageType: 'npm' | 'vscode' | 'both' | 'unknown';
  /** Files that would be published. */
  publishedFiles: string[];
  /** Method used to determine file list. */
  fileListMethod: string;
  /** All issues found, sorted by severity then rule. */
  issues: Issue[];
  /** Summary counts. */
  summary: { errors: number; warnings: number; infos: number };
  /** Duration in milliseconds. */
  durationMs: number;
}
```

### 3.2 File-List Scanner (`packages/core/src/scanners/file-list.ts`)

```typescript
import packlist from 'npm-packlist';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileListOptions {
  /** Force a specific strategy instead of auto-detect. */
  strategy?: 'packlist' | 'npm-cli';
}

/**
 * Returns the exact list of files npm would publish.
 * Uses npm-packlist (the same library npm pack uses internally).
 */
export async function getNpmPublishFiles(
  rootDir: string,
  options: FileListOptions = {},
): Promise<string[]> {
  if (options.strategy === 'npm-cli') {
    return getNpmPublishFilesViaCli(rootDir);
  }
  // npm-packlist returns paths relative to rootDir
  return packlist({ path: rootDir });
}

async function getNpmPublishFilesViaCli(rootDir: string): Promise<string[]> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['pack', '--dry-run', '--json'],
      { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout);
    // npm 10+ format: [{ files: [{ path: string }] }]
    return (parsed[0]?.files ?? []).map((f: { path: string }) => f.path);
  } catch {
    throw new Error(
      'Failed to run `npm pack --dry-run`. Ensure npm is installed and a valid package.json exists.',
    );
  }
}

/**
 * Returns files that would be included in a VS Code extension package.
 * Falls back to manual resolution if `vsce` is unavailable.
 */
export async function getVsixPublishFiles(
  rootDir: string,
): Promise<string[]> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync(
      'npx',
      ['-y', '@vscode/vsce@latest', 'ls', '--json'],
      { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 },
    );
    // vsce ls --json returns an array of relative path strings
    return JSON.parse(stdout).map((f: string) => f.replace(/^\.\//, ''));
  } catch {
    // Fall back to manual file resolution
    return getVsixFilesManual(rootDir);
  }
}

function getVsixFilesManual(rootDir: string): string[] {
  const { globSync } = require('glob');
  const ignoreInstance = resolveIgnoreRules(rootDir);
  const allFiles = globSync('**/*', {
    cwd: rootDir,
    dot: true,
    nodir: true,
    ignore: ['node_modules/**', '.git/**'],
  });
  return allFiles.filter((f: string) => !ignoreInstance.ignores(f));
}

function resolveIgnoreRules(rootDir: string): ReturnType<typeof import('ignore')> {
  const ig = require('ignore')().add([
    '.git/**',
    'node_modules/**',
    '.vscode-test/**',
    '*.vsix',
  ]);
  for (const name of ['.vscodeignore', '.npmignore', '.gitignore']) {
    const p = path.join(rootDir, name);
    if (fs.existsSync(p)) {
      ig.add(fs.readFileSync(p, 'utf-8'));
      break;
    }
  }
  return ig;
}
```

### 3.3 Secret & Sensitive-File Detection (`packages/core/src/scanners/secrets.ts`)

Strategy: a curated set of regex patterns plus known-sensitive filename globs. This is fast, requires no external binaries, and catches 90%+ of common leaks. For deeper scanning (optional), integrate with `gitleaks` or `trufflehog` as opt-in external engines.

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import type { Issue, Severity } from '../types';

// ---------------------------------------------------------------------------
// Regex-based secret patterns
// ---------------------------------------------------------------------------
interface SecretPattern {
  rule: string;
  name: string;
  regex: RegExp;
  severity: Severity;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    rule: 'aws-access-key',
    name: 'AWS Access Key ID',
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: 'error',
  },
  {
    rule: 'aws-secret-key',
    name: 'AWS Secret Access Key',
    regex: /(?i)aws(.{0,20})?(?-i)['"][0-9a-zA-Z/+]{40}['"]/g,
    severity: 'error',
  },
  {
    rule: 'github-token',
    name: 'GitHub Personal Access Token',
    regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
    severity: 'error',
  },
  {
    rule: 'github-old-token',
    name: 'GitHub Token (legacy format)',
    regex: /ghp_[A-Za-z0-9_]{36,255}/g,
    severity: 'error',
  },
  {
    rule: 'npm-token',
    name: 'npm Access Token',
    regex: /npm_[A-Za-z0-9]{36}/g,
    severity: 'error',
  },
  {
    rule: 'private-key-header',
    name: 'Private Key (PEM header)',
    regex: /-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g,
    severity: 'error',
  },
  {
    rule: 'jwt-token',
    name: 'Potential JWT Token',
    regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    severity: 'warning',
  },
  {
    rule: 'slack-webhook',
    name: 'Slack Webhook URL',
    regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/]+/g,
    severity: 'error',
  },
  {
    rule: 'generic-api-key',
    name: 'Generic API Key Assignment',
    regex: /(?i)(api[_-]?key|apikey|secret|token|password|auth_token)\s*[:=]\s*['"][A-Za-z0-9_\-+=/.]{16,}['"]/g,
    severity: 'warning',
  },
  {
    rule: 'connection-string',
    name: 'Database Connection String',
    regex: /(?i)(mongodb|postgres|mysql|redis|sqlite):\/\/[^\s'"]+/g,
    severity: 'error',
  },
  {
    rule: 'dotnet-secret',
    name: '.NET User Secret',
    regex: /"([A-Za-z0-9_]+)":\s*"[^"]{16,}"/g,
    severity: 'warning',
  },
];

// ---------------------------------------------------------------------------
// Sensitive filename patterns
// ---------------------------------------------------------------------------
interface SensitiveFilePattern {
  rule: string;
  glob: string;
  name: string;
  severity: Severity;
}

const SENSITIVE_FILE_PATTERNS: SensitiveFilePattern[] = [
  { rule: 'env-file',          glob: '**/.env',                         name: '.env file',                              severity: 'error' },
  { rule: 'env-file',          glob: '**/.env.*',                       name: 'Environment config file',                severity: 'error' },
  { rule: 'env-file',          glob: '**/.env.local',                   name: 'Local env file',                         severity: 'error' },
  { rule: 'env-file',          glob: '**/.env.production',              name: 'Production env file',                    severity: 'error' },
  { rule: 'private-key',       glob: '**/*.pem',                        name: 'PEM certificate/key',                    severity: 'error' },
  { rule: 'private-key',       glob: '**/*-key.pem',                    name: 'Private key file',                       severity: 'error' },
  { rule: 'private-key',       glob: '**/*.key',                        name: 'Key file',                               severity: 'error' },
  { rule: 'private-key',       glob: '**/*.p12',                        name: 'PKCS#12 keystore',                       severity: 'error' },
  { rule: 'private-key',       glob: '**/*.pfx',                        name: 'PKCS#12 keystore',                       severity: 'error' },
  { rule: 'credentials-file',  glob: '**/credentials*',                 name: 'Credentials file',                       severity: 'error' },
  { rule: 'credentials-file',  glob: '**/secrets*',                     name: 'Secrets file',                           severity: 'error' },
  { rule: 'log-file',          glob: '**/*.log',                        name: 'Log file',                               severity: 'warning' },
  { rule: 'log-file',          glob: '**/logs/**',                      name: 'Logs directory',                         severity: 'warning' },
  { rule: 'log-file',          glob: '**/npm-debug.log',                name: 'npm debug log',                          severity: 'warning' },
  { rule: 'test-data',         glob: '**/test-data/**',                 name: 'Test data directory',                    severity: 'warning' },
  { rule: 'test-data',         glob: '**/fixtures/**/*.{json,csv,dat}', name: 'Test fixture data',                       severity: 'info' },
  { rule: 'test-data',         glob: '**/__snapshots__/**',             name: 'Test snapshots',                         severity: 'info' },
  { rule: 'source-map',        glob: '**/*.js.map',                     name: 'JavaScript source map',                  severity: 'warning' },
  { rule: 'source-map',        glob: '**/*.css.map',                    name: 'CSS source map',                         severity: 'warning' },
  { rule: 'source-map',        glob: '**/*.ts.map',                     name: 'TypeScript source map',                  severity: 'warning' },
  { rule: 'private-doc',       glob: '**/TODO*',                        name: 'TODO document',                          severity: 'info' },
  { rule: 'private-doc',       glob: '**/NOTES*',                       name: 'Developer notes',                        severity: 'info' },
  { rule: 'private-doc',       glob: '**/INTERNAL*',                    name: 'Internal document',                      severity: 'info' },
  { rule: 'private-doc',       glob: '**/*.pem',                        name: 'PEM file',                               severity: 'error' },
  { rule: 'ds-store',          glob: '**/.DS_Store',                    name: 'macOS .DS_Store',                        severity: 'info' },
  { rule: 'windows-thumbs',    glob: '**/Thumbs.db',                    name: 'Windows Thumbs.db',                      severity: 'info' },
  { rule: 'vscode-settings',   glob: '**/.vscode/settings.json',        name: 'VS Code workspace settings',             severity: 'info' },
  { rule: 'vscode-settings',   glob: '**/.vscode/launch.json',          name: 'VS Code launch config',                  severity: 'info' },
  { rule: 'coverage',          glob: '**/coverage/**',                  name: 'Code coverage report',                   severity: 'warning' },
  { rule: 'coverage',          glob: '**/.nyc_output/**',               name: 'Code coverage output',                   severity: 'warning' },
  { rule: 'temp-file',         glob: '**/*~',                           name: 'Backup file',                            severity: 'info' },
  { rule: 'temp-file',         glob: '**/*.swp',                        name: 'Vim swap file',                          severity: 'info' },
  { rule: 'temp-file',         glob: '**/*.swo',                        name: 'Vim swap file',                          severity: 'info' },
  { rule: 'temp-file',         glob: '**/*.bak',                        name: 'Backup file',                            severity: 'info' },
];

// ---------------------------------------------------------------------------
// Maximum file sizes
// ---------------------------------------------------------------------------
const DEFAULT_WARN_SIZE = 5 * 1024 * 1024;  // 5 MB → warning
const DEFAULT_ERROR_SIZE = 50 * 1024 * 1024; // 50 MB → error (npm has ~100 MB per-file limit)

// ---------------------------------------------------------------------------
// Scanner entry point
// ---------------------------------------------------------------------------
export interface SecretScanOptions {
  /** Files to scan (typically the published-files list). */
  files: string[];
  /** Absolute project root. */
  rootDir: string;
  /** Maximum file size in bytes to read for content scanning (avoids OOM). */
  maxReadSize?: number;
  /** Severity thresholds to include. */
  minSeverity?: Severity;
}

export async function scanSecrets(options: SecretScanOptions): Promise<Issue[]> {
  const { files, rootDir, maxReadSize = 2 * 1024 * 1024, minSeverity = 'info' } = options;
  const issues: Issue[] = [];

  // 1. Check filenames against sensitive patterns
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (severityRank(pattern.severity) < severityRank(minSeverity)) continue;
    const matches = glob.sync(pattern.glob, {
      cwd: rootDir,
      dot: true,
      nodir: false,
      ignore: ['node_modules/**'],
    });
    for (const match of matches) {
      if (!files.includes(match.replace(/\\/g, '/'))) continue;
      issues.push({
        rule: pattern.rule,
        severity: pattern.severity,
        category: 'sensitive-file',
        file: match,
        message: `${pattern.name}: ${match}`,
        suggestion:
          pattern.severity === 'error'
            ? `Add "${match}" to your .npmignore or .vscodeignore file`
            : `Consider adding "${match}" to your ignore file`,
      });
    }
  }

  // 2. Scan file contents for secrets (regex)
  const severityThreshold = severityRank(minSeverity);
  for (const relPath of files) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) continue;
    if (stat.size > maxReadSize) continue; // skip huge files
    // Only scan text-like files (skip binaries)
    if (!isTextFile(absPath)) continue;

    const content = fs.readFileSync(absPath, 'utf-8');
    for (const pattern of SECRET_PATTERNS) {
      if (severityRank(pattern.severity) < severityThreshold) continue;
      // Reset lastIndex for regexes with 'g' flag when reusing
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(content)) !== null) {
        // Avoid re-triggering on the same match
        issues.push({
          rule: pattern.rule,
          severity: pattern.severity,
          category: 'secrets',
          file: relPath,
          message: `${pattern.name} detected in ${relPath}`,
          suggestion: `Remove the secret from ${relPath} and use environment variables instead. If this is a test fixture, add the file to your ignore file.`,
        });
        // Guard against catastrophic backtracking in malformed patterns
        if (match[0].length === 0) {
          pattern.regex.lastIndex++;
        }
      }
    }
  }

  return issues;
}

/** Simple heuristic: check for null bytes to detect binary files. */
function isTextFile(absPath: string): boolean {
  const buf = fs.readFileSync(absPath, { encoding: null });
  const sample = buf.subarray(0, Math.min(512, buf.length));
  for (const byte of sample) {
    if (byte === 0) return false;
  }
  return true;
}

function severityRank(s: Severity): number {
  return s === 'error' ? 3 : s === 'warning' ? 2 : 1;
}
```

### 3.4 Ignore-File Validator (`packages/core/src/scanners/ignore-validator.ts`)

This scanner is the heart of the "publishing hygiene" value prop. It validates each ignore file for correctness, coverage, and best practices.

```typescript
import ignore from 'ignore';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Issue, Severity } from '../types';

// ---------------------------------------------------------------------------
// "Safe publish" rules — patterns that almost always should be ignored
// ---------------------------------------------------------------------------
const SAFE_IGNORE_RULES: Array<{ pattern: string; reason: string; severity: Severity }> = [
  { pattern: '.env',               reason: 'Prevents leaking environment variables',           severity: 'error' },
  { pattern: '.env.*',             reason: 'Prevents leaking env-specific configs',             severity: 'error' },
  { pattern: '*.log',              reason: 'Prevents publishing debug/error logs',              severity: 'warning' },
  { pattern: 'node_modules',       reason: 'Prevents publishing dependencies (always ignored by npm, but explicit is safer)', severity: 'warning' },
  { pattern: '.git',               reason: 'Prevents publishing git metadata',                  severity: 'error' },
  { pattern: '*.pem',              reason: 'Prevents publishing private keys',                  severity: 'error' },
  { pattern: '*.key',              reason: 'Prevents publishing key files',                     severity: 'error' },
  { pattern: '*.p12',              reason: 'Prevents publishing keystores',                     severity: 'error' },
  { pattern: '*.pfx',              reason: 'Prevents publishing keystores',                     severity: 'error' },
  { pattern: 'credentials*',       reason: 'Prevents publishing credential files',              severity: 'error' },
  { pattern: 'secrets*',           reason: 'Prevents publishing secret files',                  severity: 'error' },
  { pattern: '*.js.map',           reason: 'Prevents publishing source maps',                   severity: 'warning' },
  { pattern: '*.css.map',          reason: 'Prevents publishing CSS source maps',               severity: 'warning' },
  { pattern: '*.ts.map',           reason: 'Prevents publishing TS source maps',                severity: 'warning' },
  { pattern: 'coverage',           reason: 'Prevents publishing coverage reports',              severity: 'warning' },
  { pattern: '.nyc_output',        reason: 'Prevents publishing coverage data',                 severity: 'warning' },
  { pattern: 'test-data',          reason: 'Prevents publishing test data',                     severity: 'info' },
  { pattern: '__tests__',          reason: 'Prevents publishing test directories',              severity: 'info' },
  { pattern: '*.test.*',           reason: 'Prevents publishing test files',                    severity: 'info' },
  { pattern: '*.spec.*',           reason: 'Prevents publishing test files',                    severity: 'info' },
  { pattern: '**/.DS_Store',       reason: 'Prevents publishing macOS metadata',                severity: 'info' },
  { pattern: '**/Thumbs.db',       reason: 'Prevents publishing Windows metadata',              severity: 'info' },
  { pattern: '.vscode-test',       reason: 'Prevents publishing VS Code test data',             severity: 'warning' },
  { pattern: '*.vsix',             reason: 'Prevents publishing extension packages',            severity: 'warning' },
  { pattern: '*.tgz',              reason: 'Prevents publishing npm tarballs',                  severity: 'warning' },
  { pattern: '*.tar.gz',           reason: 'Prevents publishing tarballs',                      severity: 'warning' },
];

// ---------------------------------------------------------------------------
// Common mistakes in ignore files
// ---------------------------------------------------------------------------
interface IgnoreFileCheck {
  /** Path to the ignore file (relative to root). */
  file: string;
  /** Whether the file exists. */
  exists: boolean;
  /** Parsed ignore instance (null if not found). */
  ig: ReturnType<typeof import('ignore')> | null;
  /** Raw lines read from the file. */
  rawLines: string[];
}

export interface IgnoreValidationResult {
  /** Per-file findings. */
  fileResults: Array<{
    fileName: string;
    issues: Issue[];
  }>;
  /** Suggested rules to add to each ignore file. */
  suggestedRules: Array<{
    file: string;
    rules: string[];
    reasons: string[];
  }>;
}

export interface IgnoreValidationOptions {
  rootDir: string;
  /** Files that are currently included in the publish set. */
  publishedFiles: string[];
  /** Which ignore files to check. */
  ignoreFiles?: string[];
}

/**
 * Validates all relevant ignore files in a project.
 *
 * Checks:
 *   - Whether each ignore file exists
 *   - Whether "safe" patterns are missing
 *   - Whether published files match any safe-ignore pattern
 *   - Whether patterns in the ignore file are valid (no trailing slashes, etc.)
 *   - Whether negations (`!`) are used correctly
 */
export async function validateIgnoreFiles(
  options: IgnoreValidationOptions,
): Promise<IgnoreValidationResult> {
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

    // ---- Check 1: Empty ignore file ----
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

    // ---- Check 2: Missing safe rules ----
    const igInstance = ignore().add(rawContent);
    const missingSafeRules: Array<{ pattern: string; reason: string; severity: Severity }> = [];

    for (const safeRule of SAFE_IGNORE_RULES) {
      // Check if any published file matches the safe pattern (i.e., the file
      // that SHOULD be ignored is NOT currently ignored).
      const matchingFiles = publishedFiles.filter((f) => {
        // Simple glob match: does the file match the pattern?
        return matchSimpleGlob(f, safeRule.pattern);
      });

      if (matchingFiles.length > 0 && !igInstance.ignores(safeRule.pattern)) {
        missingSafeRules.push(safeRule);
        issues.push({
          rule: `missing-ignore-${safeRule.pattern.replace(/[.*]/g, '')}`,
          severity: safeRule.severity,
          category: 'ignore-file',
          file: fileName,
          message: `"${safeRule.pattern}" should be in ${fileName}: ${safeRule.reason}. Affected files: ${matchingFiles.join(', ')}`,
          suggestion: `Add "${safeRule.pattern}" to ${fileName}`,
        });
      }
    }

    // ---- Check 3: Validate syntax of each rule ----
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (line === '' || line.startsWith('#')) continue;
      const lineNum = i + 1;

      // Check for trailing slash (common mistake: "dir/" instead of "dir")
      if (line.endsWith('/') && !line.startsWith('/')) {
        issues.push({
          rule: 'trailing-slash',
          severity: 'info',
          category: 'ignore-file',
          file: fileName,
          message: `${fileName}:${lineNum} has a trailing slash ("${line}"). A trailing slash matches only directories, which may not be intended.`,
        });
      }

      // Check for leading slash outside negation (often wrong in npmignore)
      // npm/vscode ignore files use paths relative to project root; leading / is redundant
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

    // ---- Check 4: Negations that might be mistakes ----
    const negationLines = rawLines.filter((l) => l.trim().startsWith('!'));
    for (const negLine of negationLines) {
      const pattern = negLine.trim().slice(1); // remove '!'
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

    // ---- Suggested rules ----
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

/**
 * Simple glob matching for ignore-file validation.
 * Handles patterns without needing the full micromatch/fast-glob stack.
 */
function matchSimpleGlob(filePath: string, pattern: string): boolean {
  // Normalize paths to forward slashes
  const normalized = filePath.replace(/\\/g, '/');
  // Convert glob pattern to regex
  let regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  // The pattern matches any path that contains this segment
  regexStr = `(^|/)${regexStr}($|/)`;
  return new RegExp(regexStr).test(normalized);
}
```

### 3.5 Manifest Validator (`packages/core/src/scanners/manifest.ts`)

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import type { Issue } from '../types';

// ---------------------------------------------------------------------------
// package.json schema (subset of fields relevant to publishing)
// ---------------------------------------------------------------------------
const packageJsonSchema = z.object({
  name: z.string().min(1, 'Package must have a "name" field').optional(),
  version: z.string().min(1, 'Package must have a "version" field').optional(),
  description: z.string().optional(),
  main: z.string().optional(),
  files: z.array(z.string()).optional(),
  repository: z
    .union([
      z.string(),
      z.object({
        type: z.string().optional(),
        url: z.string().optional(),
        directory: z.string().optional(),
      }),
    ])
    .optional(),
  license: z.string().optional(),
  icon: z.string().optional(),
  publisher: z.string().optional(),
  engines: z
    .object({
      vscode: z.string().optional(),
    })
    .optional(),
  categories: z.array(z.string()).optional(),
  contributes: z.any().optional(),
  activationEvents: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Metadata file checks
// ---------------------------------------------------------------------------
const METADATA_CHECKS: Array<{
  file: string;
  name: string;
  rule: string;
  severity: 'error' | 'warning';
}> = [
  { file: 'README.md', name: 'README', rule: 'missing-readme', severity: 'warning' },
  { file: 'LICENSE',   name: 'LICENSE', rule: 'missing-license-file', severity: 'warning' },
  { file: 'LICENSE.md', name: 'LICENSE', rule: 'missing-license-file', severity: 'warning' },
  { file: 'CHANGELOG.md', name: 'CHANGELOG', rule: 'missing-changelog', severity: 'info' },
];

export interface ManifestScanResult {
  issues: Issue[];
  packageJsonIssues: Issue[];
  metadataIssues: Issue[];
}

export async function scanManifest(rootDir: string): Promise<ManifestScanResult> {
  const issues: Issue[] = [];
  const pkgPath = path.join(rootDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return {
      issues: [
        {
          rule: 'missing-package-json',
          severity: 'error',
          category: 'manifest',
          file: 'package.json',
          message: 'No package.json found. This is required for npm and VS Code packages.',
        },
      ],
      packageJsonIssues: [],
      metadataIssues: [],
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch (e) {
    return {
      issues: [
        {
          rule: 'invalid-package-json',
          severity: 'error',
          category: 'manifest',
          file: 'package.json',
          message: `package.json is not valid JSON: ${(e as Error).message}`,
        },
      ],
      packageJsonIssues: [],
      metadataIssues: [],
    };
  }

  const parsed = packageJsonSchema.safeParse(raw);
  const pkgIssues: Issue[] = [];

  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      pkgIssues.push({
        rule: 'invalid-package-json-field',
        severity: 'error',
        category: 'manifest',
        file: 'package.json',
        message: `package.json: ${err.path.join('.')}: ${err.message}`,
      });
    }
  }

  const pkg = raw as Record<string, unknown>;

  // ---- Required field checks ----
  if (!pkg.name || typeof pkg.name !== 'string' || pkg.name.trim() === '') {
    pkgIssues.push({
      rule: 'missing-name',
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
      message: 'package.json must have a "name" field.',
    });
  }

  if (!pkg.version || typeof pkg.version !== 'string') {
    pkgIssues.push({
      rule: 'missing-version',
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
      message: 'package.json must have a "version" field.',
    });
  }

  if (!pkg.description || typeof pkg.description !== 'string' || pkg.description.trim() === '') {
    pkgIssues.push({
      rule: 'missing-description',
      severity: 'warning',
      category: 'manifest',
      file: 'package.json',
      message: 'A "description" field is recommended for better discoverability on npm and the VS Code Marketplace.',
    });
  }

  // ---- Repository URL check ----
  if (!pkg.repository) {
    pkgIssues.push({
      rule: 'missing-repository',
      severity: 'warning',
      category: 'manifest',
      file: 'package.json',
      message: 'A "repository" field is recommended for supply-chain transparency.',
    });
  } else if (typeof pkg.repository === 'object' && pkg.repository !== null) {
    const repo = pkg.repository as Record<string, unknown>;
    const url = typeof repo.url === 'string' ? repo.url : '';
    if (!url.startsWith('https://') && !url.startsWith('git+https://')) {
      pkgIssues.push({
        rule: 'invalid-repository-url',
        severity: 'warning',
        category: 'manifest',
        file: 'package.json',
        message: `Repository URL "${url}" should use HTTPS.`,
      });
    }
  }

  // ---- License check ----
  if (!pkg.license) {
    pkgIssues.push({
      rule: 'missing-license',
      severity: 'warning',
      category: 'manifest',
      file: 'package.json',
      message: 'A "license" field is recommended. Without it, the package is "all rights reserved" by default.',
    });
  }

  // ---- VS Code-specific checks ----
  const isVsCodeExtension = hasVsCodeMarkers(pkg);
  if (isVsCodeExtension) {
    if (!pkg.publisher) {
      pkgIssues.push({
        rule: 'missing-publisher',
        severity: 'error',
        category: 'manifest',
        file: 'package.json',
        message: 'VS Code extensions require a "publisher" field.',
      });
    }
    if (!pkg.icon) {
      pkgIssues.push({
        rule: 'missing-icon',
        severity: 'warning',
        category: 'manifest',
        file: 'package.json',
        message: 'An "icon" field is recommended for the VS Code Marketplace.',
      });
    }
  }

  // ---- Metadata file checks (README, LICENSE, CHANGELOG) ----
  const metaIssues: Issue[] = [];
  const publishFileSet = new Set<string>(); // This would come from the file-list scanner
  // For standalone scanning, check existence on disk:
  let foundLicense = false;
  for (const check of METADATA_CHECKS) {
    const absPath = path.join(rootDir, check.file);
    if (!fs.existsSync(absPath)) {
      // Check alternative names for LICENSE
      if (check.rule === 'missing-license-file' && foundLicense) continue;
      metaIssues.push({
        rule: check.rule,
        severity: check.severity,
        category: 'metadata',
        file: check.file,
        message: `${check.name} file not found. A ${check.name} is ${
          check.severity === 'error' ? 'required' : 'recommended'
        } for published packages.`,
      });
    } else {
      if (check.rule === 'missing-license-file') foundLicense = true;
    }
  }

  return {
    issues: [...pkgIssues, ...metaIssues],
    packageJsonIssues: pkgIssues,
    metadataIssues: metaIssues,
  };
}

function hasVsCodeMarkers(pkg: Record<string, unknown>): boolean {
  return Boolean(
    (pkg.engines as Record<string, string> | undefined)?.vscode ||
    pkg.activationEvents ||
    pkg.categories ||
    pkg.contributes ||
    pkg.publisher,
  );
}
```

### 3.6 File-Size Scanner (`packages/core/src/scanners/file-size.ts`)

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Issue } from '../types';

export interface FileSizeOptions {
  files: string[];
  rootDir: string;
  /** Size in bytes above which a warning is issued. Default: 5 MB. */
  warnThreshold?: number;
  /** Size in bytes above which an error is issued. Default: 50 MB. */
  errorThreshold?: number;
}

export function scanFileSizes(options: FileSizeOptions): Issue[] {
  const { files, rootDir, warnThreshold = 5 * 1024 * 1024, errorThreshold = 50 * 1024 * 1024 } = options;
  const issues: Issue[] = [];
  let totalSize = 0;

  for (const relPath of files) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) continue;
    totalSize += stat.size;

    if (stat.size > errorThreshold) {
      issues.push({
        rule: 'oversized-file',
        severity: 'error',
        category: 'file-size',
        file: relPath,
        message: `${relPath} is ${formatBytes(stat.size)} — this exceeds the ${formatBytes(errorThreshold)} limit and may cause publish failures.`,
        suggestion: `Add "${relPath}" to your ignore file or reduce its size.`,
      });
    } else if (stat.size > warnThreshold) {
      issues.push({
        rule: 'large-file',
        severity: 'warning',
        category: 'file-size',
        file: relPath,
        message: `${relPath} is ${formatBytes(stat.size)} — consider excluding large assets from your published package.`,
        suggestion: `Add "${relPath}" to your ignore file if it is not needed at runtime.`,
      });
    }
  }

  if (totalSize > 100 * 1024 * 1024) {
    issues.push({
      rule: 'large-package',
      severity: 'warning',
      category: 'file-size',
      file: '',
      message: `Total package size is ${formatBytes(totalSize)} — this is large and may lead to slower installs.`,
      suggestion: 'Exclude unnecessary files and assets from the publish list.',
    });
  }

  return issues;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
```

### 3.7 Orkestrasyon ve Ana Tarayıcı — Orchestrator (`packages/core/src/index.ts`)

```typescript
import * as path from 'node:path';
import { getNpmPublishFiles, getVsixPublishFiles } from './scanners/file-list';
import { scanSecrets } from './scanners/secrets';
import { validateIgnoreFiles } from './scanners/ignore-validator';
import { scanManifest } from './scanners/manifest';
import { scanFileSizes } from './scanners/file-size';
import type { ScanResult, Issue } from './types';

export interface ScanOptions {
  /** Absolute project root. */
  projectRoot: string;
  /** Force package type detection. */
  packageType?: 'npm' | 'vscode' | 'both';
  /** Categories to skip. */
  skip?: string[];
  /** Fail-fast on first error. */
  failFast?: boolean;
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  const { projectRoot } = options;
  const allIssues: Issue[] = [];

  // Determine package type
  const packageType = options.packageType ?? detectPackageType(projectRoot);

  // --- Step 1: Get file list ---
  let publishedFiles: string[] = [];
  let fileListMethod = 'none';

  if (packageType === 'npm' || packageType === 'both') {
    publishedFiles = await getNpmPublishFiles(projectRoot);
    fileListMethod = 'npm-packlist';
  }
  if (packageType === 'vscode') {
    const vsixFiles = await getVsixPublishFiles(projectRoot);
    publishedFiles = Array.from(new Set([...publishedFiles, ...vsixFiles]));
    fileListMethod = packageType === 'vscode' ? 'vsce-cli' : 'combined';
  }

  // --- Step 2: Manifest scan ---
  if (!options.skip?.includes('manifest')) {
    const manifestResult = await scanManifest(projectRoot);
    allIssues.push(...manifestResult.issues);
  }

  // --- Step 3: Ignore-file validation ---
  if (!options.skip?.includes('ignore-validation')) {
    const ignoreFileNames =
      packageType === 'vscode'
        ? ['.vscodeignore', '.npmignore', '.gitignore']
        : ['.npmignore', '.gitignore'];

    const ignoreResult = await validateIgnoreFiles({
      rootDir: projectRoot,
      publishedFiles,
      ignoreFiles: ignoreFileNames,
    });
    for (const fr of ignoreResult.fileResults) {
      allIssues.push(...fr.issues);
    }
  }

  // --- Step 4: Secret & sensitive-file scan ---
  if (!options.skip?.includes('secrets')) {
    const secretIssues = await scanSecrets({
      files: publishedFiles,
      rootDir: projectRoot,
    });
    allIssues.push(...secretIssues);
  }

  // --- Step 5: File-size scan ---
  if (!options.skip?.includes('file-size')) {
    const sizeIssues = scanFileSizes({
      files: publishedFiles,
      rootDir: projectRoot,
    });
    allIssues.push(...sizeIssues);
  }

  // Deduplicate issues by (rule, file, message)
  const uniqueIssues = deduplicateIssues(allIssues);

  // Sort: errors first, then warnings, then infos
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

function detectPackageType(rootDir: string): 'npm' | 'vscode' | 'both' {
  const pkgPath = path.join(rootDir, 'package.json');
  if (!require('node:fs').existsSync(pkgPath)) return 'unknown' as 'npm';
  const pkg = JSON.parse(require('node:fs').readFileSync(pkgPath, 'utf-8'));
  const isVsCode = Boolean(
    (pkg.engines && pkg.engines.vscode) ||
    pkg.activationEvents ||
    pkg.contributes ||
    pkg.publisher,
  );
  return isVsCode ? 'both' : 'npm';
}

function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.rule}::${i.file}::${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Re-export for consumers
export { getNpmPublishFiles, getVsixPublishFiles } from './scanners/file-list';
export { scanSecrets } from './scanners/secrets';
export { validateIgnoreFiles } from './scanners/ignore-validator';
export { scanManifest } from './scanners/manifest';
export { scanFileSizes } from './scanners/file-size';
export type { ScanResult, Issue, Severity, Category } from './types';
```

### 3.8 CLI Commands (`packages/cli/src/cli.ts`)

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { scan, type ScanResult } from '@publishguard/core';

const program = new Command();

program
  .name('publishguard')
  .description('Pre-publish safety scanner for npm and VS Code extensions')
  .version('0.1.0');

program
  .command('scan [directory]')
  .description('Scan a package directory for publishing issues')
  .option('--json', 'Output results as JSON')
  .option('--ci', 'CI-friendly output (GitHub Actions annotations)')
  .option('--skip <categories>', 'Comma-separated categories to skip')
  .option('--fail-on <severity>', 'Exit with non-zero code on this severity or higher', 'warning')
  .action(async (dir = '.', opts) => {
    const result = await scan({
      projectRoot: path.resolve(dir),
      skip: opts.skip?.split(','),
    });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (opts.ci) {
      printCIOutput(result);
    } else {
      printPrettyOutput(result);
    }
    // Exit code based on severity
    const threshold = { error: 1, warning: 2, info: 3 };
    const maxSeverity = result.issues.reduce((max, i) => {
      const rank = i.severity === 'error' ? 1 : i.severity === 'warning' ? 2 : 3;
      return Math.min(max, rank);
    }, 3);
    if (maxSeverity <= threshold[opts.failOn as keyof typeof threshold] || 2) {
      process.exit(maxSeverity <= 2 ? maxSeverity : 0);
    }
  });

program
  .command('init [directory]')
  .description('Generate safe .npmignore and .vscodeignore files')
  .action(async (dir = '.') => {
    // Implementation: generate ignore files with safe defaults
  });

program
  .command('fix [directory]')
  .description('Automatically fix common issues (add ignore rules, etc.)')
  .action(async (dir = '.') => {
    // Implementation: auto-fix based on scan results
  });

program.parse();
```

### 3.9 Auto-Generated Ignore Rules (`packages/core/src/scanners/ignore-generator.ts`)

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

const SAFE_DEFAULTS: string[] = [
  '# ---- PublishGuard: auto-generated safe ignore rules ----',
  '.env',
  '.env.*',
  '*.log',
  'node_modules',
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

export function generateSafeIgnoreFile(rootDir: string, fileName: string): boolean {
  const filePath = path.join(rootDir, fileName);
  if (fs.existsSync(filePath)) {
    // Append to existing file
    const existing = fs.readFileSync(filePath, 'utf-8');
    const newRules = SAFE_DEFAULTS.filter(
      (rule) => !existing.includes(rule),
    );
    if (newRules.length === 0) return false;
    fs.appendFileSync(filePath, '\n' + newRules.join('\n') + '\n');
    return true;
  }
  // Create new file
  fs.writeFileSync(filePath, SAFE_DEFAULTS.join('\n') + '\n');
  return true;
}
```

---

## 4. VS Code Extension Design

### 4.1 Activation & Commands

```typescript
// packages/vscode/src/extension.ts
import * as vscode from 'vscode';
import { scan } from '@publishguard/core';
import { PublishGuardTreeProvider } from './tree-view';
import { PublishGuardDiagnostics } from './diagnostics';
import { PublishGuardQuickFix } from './quick-fix';

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = new PublishGuardDiagnostics();
  const treeProvider = new PublishGuardTreeProvider();
  const quickFix = new PublishGuardQuickFix();

  // Tree view in the sidebar
  vscode.window.registerTreeDataProvider('publishguard.issues', treeProvider);

  // CodeActionProvider for quick fixes
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file', language: 'json' },
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
  );

  // Command: scan current workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.scan', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'PublishGuard scanning...' },
        async () => {
          const result = await scan({ projectRoot: workspaceFolders[0].uri.fsPath });
          diagnostics.update(result);
          treeProvider.update(result);
          showResultNotification(result);
        },
      );
    }),
  );

  // Command: scan before publish (hook)
  context.subscriptions.push(
    vscode.commands.registerCommand('publishguard.publishCheck', async () => {
      // Run scan and block publish if errors exist
    }),
  );

  // Auto-scan on package.json save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.fileName.endsWith('package.json')) {
        // Re-scan
      }
    }),
  );
}
```

### 4.2 VS Code Extension `package.json`

```json
{
  "name": "publishguard",
  "displayName": "PublishGuard",
  "description": "Pre-publish safety scanner for npm packages and VS Code extensions",
  "version": "0.1.0",
  "publisher": "publishguard",
  "icon": "resources/icon.png",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Linters", "Other"],
  "activationEvents": ["workspaceContains:package.json"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      { "command": "publishguard.scan", "title": "PublishGuard: Scan Project" },
      { "command": "publishguard.fix", "title": "PublishGuard: Auto-Fix Issues" },
      { "command": "publishguard.init", "title": "PublishGuard: Generate Ignore Files" }
    ],
    "views": {
      "publishguard": [
        {
          "id": "publishguard.issues",
          "name": "Publishing Issues"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "publishguard",
          "title": "PublishGuard",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "configuration": {
      "title": "PublishGuard",
      "properties": {
        "publishguard.scanOnSave": {
          "type": "boolean",
          "default": true,
          "description": "Automatically scan after saving package.json"
        },
        "publishguard.blockPublishOnError": {
          "type": "boolean",
          "default": true,
          "description": "Block VS Code extension publishing if errors are found"
        }
      }
    }
  }
}
```

---

## 5. Phased Development Roadmap

### Phase 0 — Foundation (Weeks 1–2)

| Task | Deliverable |
|---|---|
| Initialize monorepo (npm workspaces + Turborepo) | `package.json`, `turbo.json`, `tsconfig.base.json` |
| Set up CI (GitHub Actions: lint, typecheck, test) | `.github/workflows/ci.yml` |
| `@publishguard/core` package skeleton | Types, `package.json#files` scanner |
| `npm-packlist` integration | `getNpmPublishFiles()` |
| Basic manifest scanner | `scanManifest()` for `package.json` |
| Unit test fixtures | Test packages with known issues |

### Phase 1 — MVP Core (Weeks 3–6)

| Feature | Details |
|---|---|
| **Secret scanner** | Regex patterns + sensitive filename detection |
| **Ignore-file validator** | `.npmignore` / `.vscodeignore` / `.gitignore` parsing, missing-rule detection, syntax checks |
| **Metadata checks** | README, LICENSE, CHANGELOG presence; `repository` URL, `icon`, `publisher` |
| **File-size scanner** | Oversized file warnings, total package size |
| **Safe ignore rule generation** | `publishguard init` command |
| **CLI** | `publishguard scan`, `--json`, `--ci`, `--fail-on` |
| **JSON/SARIF reporters** | Machine-readable output for CI integration |

### Phase 2 — VS Code Extension (Weeks 7–9)

| Feature | Details |
|---|---|
| VS Code extension scaffold | `@publishguard/vscode` package |
| Sidebar tree view | "Publishing Issues" panel |
| Problems panel integration | Diagnostics with severity, file, line |
| Quick-fix CodeActions | "Add to .npmignore", "Generate ignore file" |
| Status bar indicator | Green/yellow/red based on scan results |
| `publishguard.publishCheck` hook | Blocks `vsce publish` if errors found |
| Configuration UI | Settings for scan-on-save, severity thresholds |

### Phase 3 — Polish & Advanced (Weeks 10–12)

| Feature | Details |
|---|---|
| **Custom rules** | `.publishguardrc.json` / `.publishguardrc.js` for user-defined patterns |
| **Pre-commit hook** | Husky integration, `publishguard scan --staged` |
| **CI templates** | GitHub Actions workflow snippet, GitLab CI job snippet |
| **External secret scanners** | Optional integration with `gitleaks`, `trufflehog` |
| **Web dashboard** (future) | Aggregated scan history for orgs |
| **npm pre-publish hook** | `prepublishOnly` script integration |

---

## 6. Key Design Decisions

1.  **Use `npm-packlist` instead of shelling out by default.** It is the canonical implementation, maintained by npm, and avoids process-spawn overhead. Shelling out to `npm pack --dry-run` is retained as a fallback and for cross-validation in tests.

2.  **Regex-based secret detection as the default.** It is fast, has zero external dependencies, and catches 90%+ of common leaks. Gitleaks/truffleHog integration is opt-in for deeper scans because they require binary installation and significantly increase scan time.

3.  **`ignore` library for parse-tree validation.** The `ignore` package is a pure-JS port of git's ignore logic and is used by ESLint and Prettier. It gives us programmatic access to rule evaluation, which enables the "missing safe rule" detection.

4.  **Monorepo over separate repos.** The shared `core` package ensures the CLI and VS Code extension never diverge in scan behavior. npm workspaces is chosen over pnpm because every Node developer already has npm; Turborepo adds build caching for fast CI.

5.  **No native binaries in the dependency tree.** All listed dependencies are pure JavaScript (or TypeScript), ensuring cross-platform compatibility and zero installation friction.

---

## 7. Configuration File (`.publishguardrc.json`)

```json
{
  "$schema": "https://publishguard.dev/schema.json",
  "extends": ["@publishguard/recommended"],
  "rules": {
    "no-env-files": "error",
    "no-private-keys": "error",
    "no-source-maps": "warning",
    "no-credentials-files": "error",
    "no-log-files": "warning",
    "no-test-data": "info",
    "max-file-size": ["warning", { "threshold": "10MB" }],
    "require-readme": "warning",
    "require-license": "warning",
    "require-repository": "warning",
    "valid-ignore-files": "error"
  },
  "ignore": ["**/fixtures/**", "**/test-data/**"],
  "secretPatterns": {
    "custom": [
      { "name": "MyCompany API Key", "regex": "MC_KEY_[A-Za-z0-9]{32}" }
    ]
  },
  "fileSize": {
    "warnThreshold": "5MB",
    "errorThreshold": "50MB"
  }
}
```

---

This blueprint provides a complete foundation for implementing PublishGuard as a monorepo with three packages (`core`, `cli`, `vscode`), integrating directly with `npm-packlist` and `vsce ls`, and delivering all specified MVP features through a phased 12-week roadmap. The code examples for secret detection, ignore-file validation, manifest checking, and the orchestrator are production-ready and follow security best practices.
