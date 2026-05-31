import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FileListOptions {
  strategy?: 'npm-cli';
}

export async function getNpmPublishFiles(
  rootDir: string,
  options: FileListOptions = {},
): Promise<string[]> {
  if (options.strategy === 'npm-cli') {
    return getNpmPublishFilesViaCli(rootDir);
  }
  try {
    return await getNpmPublishFilesViaCli(rootDir);
  } catch {
    return getFilesManual(rootDir);
  }
}

function getFilesManual(rootDir: string): string[] {
  const { globSync } = require('glob');
  const micromatch = require('micromatch') as {
    isMatch(input: string, pattern: string | string[], options?: { dot?: boolean }): boolean;
  };
  const ig = require('ignore')().add([
    'node_modules/**',
    '**/node_modules/**',
    '.git/**',
  ]);
  const npmignore = path.join(rootDir, '.npmignore');
  const gitignore = path.join(rootDir, '.gitignore');
  if (fs.existsSync(npmignore)) {
    ig.add(fs.readFileSync(npmignore, 'utf-8'));
  } else if (fs.existsSync(gitignore)) {
    ig.add(fs.readFileSync(gitignore, 'utf-8'));
  }
  const files = globSync('**/*', {
    cwd: rootDir,
    dot: true,
    nodir: true,
    ignore: ['node_modules/**', '**/node_modules/**', '.git/**'],
  });
  const packageFiles = readPackageFiles(rootDir);
  return files
    .map((file: string) => file.replace(/\\/g, '/'))
    .filter((file: string) => !ig.ignores(file))
    .filter((file: string) => packageFiles.length === 0 || isPackageFile(file, packageFiles, micromatch));
}

function readPackageFiles(rootDir: string): string[] {
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    return Array.isArray(pkg.files)
      ? pkg.files.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

function isPackageFile(
  file: string,
  packageFiles: string[],
  micromatch: { isMatch(input: string, pattern: string | string[], options?: { dot?: boolean }): boolean },
): boolean {
  if (file === 'package.json') return true;
  return packageFiles.some((entry) => {
    const normalized = entry.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
    return file === normalized ||
      file.startsWith(`${normalized}/`) ||
      micromatch.isMatch(file, normalized, { dot: true }) ||
      micromatch.isMatch(file, `${normalized}/**`, { dot: true });
  });
}

async function getNpmPublishFilesViaCli(rootDir: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['pack', '--dry-run', '--json'],
      { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout);
    return (parsed[0]?.files ?? []).map((f: { path: string }) => f.path);
  } catch {
    throw new Error(
      'Failed to run `npm pack --dry-run`. Ensure npm is installed and a valid package.json exists.',
    );
  }
}

export async function getVsixPublishFiles(rootDir: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'npx',
      ['-y', '@vscode/vsce@latest', 'ls', '--json'],
      { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 },
    );
    return JSON.parse(stdout).map((f: string) => f.replace(/^\.\//, ''));
  } catch {
    return getVsixFilesManual(rootDir);
  }
}

function getVsixFilesManual(rootDir: string): string[] {
  const { globSync } = require('glob');
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
  const allFiles = globSync('**/*', {
    cwd: rootDir,
    dot: true,
    nodir: true,
    ignore: ['node_modules/**', '.git/**'],
  });
  return allFiles.filter((f: string) => !ig.ignores(f));
}
