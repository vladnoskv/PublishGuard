import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Issue } from '../types';

const METADATA_CHECKS: Array<{
  files: string[];
  name: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
}> = [
  { files: ['README.md', 'readme.md', 'README', 'readme'], name: 'README', rule: 'missing-readme', severity: 'warning' },
  { files: ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md'], name: 'LICENSE', rule: 'missing-license-file', severity: 'warning' },
  { files: ['CHANGELOG.md', 'CHANGELOG', 'changelog.md'], name: 'CHANGELOG', rule: 'missing-changelog', severity: 'info' },
];

export interface ManifestScanResult {
  issues: Issue[];
  packageJsonIssues: Issue[];
  metadataIssues: Issue[];
  isVsCodeExtension: boolean;
}

export function scanManifest(rootDir: string): ManifestScanResult {
  const issues: Issue[] = [];
  const pkgPath = path.join(rootDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    const issue: Issue = {
      rule: 'missing-package-json',
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
      message: 'No package.json found. This is required for npm and VS Code packages.',
    };
    return {
      issues: [issue],
      packageJsonIssues: [issue],
      metadataIssues: [],
      isVsCodeExtension: false,
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch (e) {
    const issue: Issue = {
      rule: 'invalid-package-json',
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
      message: `package.json is not valid JSON: ${(e as Error).message}`,
    };
    return {
      issues: [issue],
      packageJsonIssues: [issue],
      metadataIssues: [],
      isVsCodeExtension: false,
    };
  }

  const pkgIssues: Issue[] = [];
  const isVsCode = hasVsCodeMarkers(raw);

  if (!raw.name || typeof raw.name !== 'string' || raw.name.trim() === '') {
    pkgIssues.push({
      rule: 'missing-name',
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
      message: 'package.json must have a "name" field.',
    });
  }

  if (raw.private === true) {
    // Private packages don't need version for publishing
  } else if (!raw.version || typeof raw.version !== 'string') {
    pkgIssues.push({
      rule: 'missing-version',
      severity: 'error',
      category: 'manifest',
      file: 'package.json',
      message: 'package.json must have a "version" field.',
    });
  } else if (typeof raw.version === 'string') {
    const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
    if (!semverRegex.test(raw.version)) {
      pkgIssues.push({
        rule: 'invalid-version',
        severity: 'error',
        category: 'manifest',
        file: 'package.json',
        message: `"${raw.version}" is not a valid semver version.`,
      });
    }
  }

  if (!raw.description || typeof raw.description !== 'string' || raw.description.trim() === '') {
    pkgIssues.push({
      rule: 'missing-description',
      severity: 'warning',
      category: 'manifest',
      file: 'package.json',
      message: 'A "description" field is recommended for better discoverability on npm and the VS Code Marketplace.',
    });
  }

  if (!raw.repository) {
    pkgIssues.push({
      rule: 'missing-repository',
      severity: 'warning',
      category: 'manifest',
      file: 'package.json',
      message: 'A "repository" field is recommended for supply-chain transparency.',
    });
  } else if (typeof raw.repository === 'object' && raw.repository !== null) {
    const repo = raw.repository as Record<string, unknown>;
    const url = typeof repo.url === 'string' ? repo.url : '';
    if (url && !url.startsWith('https://') && !url.startsWith('git+https://') && !url.startsWith('git://') && !url.startsWith('ssh://')) {
      pkgIssues.push({
        rule: 'invalid-repository-url',
        severity: 'warning',
        category: 'manifest',
        file: 'package.json',
        message: `Repository URL "${url}" should use HTTPS.`,
      });
    }
  }

  if (!raw.license) {
    pkgIssues.push({
      rule: 'missing-license',
      severity: 'warning',
      category: 'manifest',
      file: 'package.json',
      message: 'A "license" field is recommended. Without it, the package is "all rights reserved" by default.',
    });
  }

  if (isVsCode) {
    if (!raw.publisher) {
      pkgIssues.push({
        rule: 'missing-publisher',
        severity: 'error',
        category: 'manifest',
        file: 'package.json',
        message: 'VS Code extensions require a "publisher" field.',
        suggestion: 'Add "publisher" to your package.json with your publisher ID from the VS Code Marketplace.',
      });
    }
    if (!raw.icon) {
      pkgIssues.push({
        rule: 'missing-icon',
        severity: 'warning',
        category: 'manifest',
        file: 'package.json',
        message: 'An "icon" field is recommended for the VS Code Marketplace.',
      });
    }
    if (!raw.engines || typeof raw.engines !== 'object' || !(raw.engines as Record<string, unknown>).vscode) {
      pkgIssues.push({
        rule: 'missing-vscode-engine',
        severity: 'warning',
        category: 'manifest',
        file: 'package.json',
        message: 'VS Code extensions should specify "engines.vscode" to indicate compatibility.',
      });
    }
  }

  const metaIssues: Issue[] = [];
  let foundLicense = false;
  for (const check of METADATA_CHECKS) {
    if (check.rule === 'missing-license-file' && foundLicense) continue;
    const exists = check.files.some((f) => fs.existsSync(path.join(rootDir, f)));
    if (!exists) {
      metaIssues.push({
        rule: check.rule,
        severity: check.severity,
        category: 'metadata',
        file: check.files[0],
        message: `${check.name} file not found. A ${check.name} is recommended for published packages.`,
      });
    } else {
      if (check.rule === 'missing-license-file') foundLicense = true;
    }
  }

  return {
    issues: [...pkgIssues, ...metaIssues],
    packageJsonIssues: pkgIssues,
    metadataIssues: metaIssues,
    isVsCodeExtension: isVsCode,
  };
}

function hasVsCodeMarkers(pkg: Record<string, unknown>): boolean {
  if (pkg.engines && typeof pkg.engines === 'object') {
    if ((pkg.engines as Record<string, unknown>).vscode) return true;
  }
  if (pkg.activationEvents) return true;
  if (pkg.contributes) return true;
  if (pkg.publisher) return true;
  if (pkg.categories) return true;
  return false;
}
