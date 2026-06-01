import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Issue } from '../types';

const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

const NON_REGISTRY_PREFIXES = [
  'git:',
  'git+',
  'github:',
  'http:',
  'https:',
  'file:',
  'link:',
  'workspace:',
] as const;

const execFileAsync = promisify(execFile);

export interface DependencyScanOptions {
  npmAudit?: boolean;
  auditRunner?: AuditRunner;
  socketDev?: boolean;
  socketRunner?: SocketRunner;
  snyk?: boolean;
  snykRunner?: SnykRunner;
}

export interface NpmAuditResult {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
}

export interface NpmAuditVulnerability {
  name?: string;
  severity?: string;
  range?: string;
  fixAvailable?: boolean | Record<string, unknown>;
  via?: Array<string | { title?: string; url?: string; severity?: string }>;
}

export type AuditRunner = (projectRoot: string) => Promise<NpmAuditResult>;

export interface SocketPackageResult {
  name: string;
  version?: string;
  alerts?: SocketAlert[];
}

export interface SocketAlert {
  severity?: string;
  type?: string;
  message?: string;
}

export interface SocketScanResult {
  packages?: SocketPackageResult[];
}

export type SocketRunner = (projectRoot: string, packages: string[]) => Promise<SocketScanResult>;

export interface SnykVulnerability {
  packageName?: string;
  name?: string;
  title?: string;
  severity?: string;
  version?: string;
  from?: string[];
  url?: string;
}

export interface SnykScanResult {
  vulnerabilities?: SnykVulnerability[] | Record<string, SnykVulnerability>;
}

export type SnykRunner = (projectRoot: string) => Promise<SnykScanResult>;

export async function scanDependencies(projectRoot: string, options: DependencyScanOptions = {}): Promise<Issue[]> {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return [];
  }

  const issues: Issue[] = [];
  const dependencySpecs: string[] = [];
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = pkg[section];
    if (!isDependencyMap(dependencies)) continue;

    for (const [name, specifier] of Object.entries(dependencies)) {
      dependencySpecs.push(`${name}@${specifier}`);
      if (specifier === 'latest' || specifier === '*') {
        issues.push({
          rule: 'dependency-floating-version',
          severity: 'warning',
          category: 'dependencies',
          file: 'package.json',
          message: `${section}.${name} uses "${specifier}", which can change without a lockfile update.`,
          suggestion: `Pin ${name} to a reviewed version range and confirm current package risk at ${socketPackageUrl(name)}.`,
        });
        continue;
      }

      const normalizedSpecifier = specifier.toLowerCase();
      if (NON_REGISTRY_PREFIXES.some((prefix) => normalizedSpecifier.startsWith(prefix))) {
        issues.push({
          rule: 'dependency-non-registry-source',
          severity: 'warning',
          category: 'dependencies',
          file: 'package.json',
          message: `${section}.${name} uses a non-registry source (${specifier}).`,
          suggestion: `Review the source, pin it to an immutable commit or registry release, and confirm package risk at ${socketPackageUrl(name)}.`,
        });
      }
    }
  }

  if (options.npmAudit) {
    issues.push(...await scanNpmAudit(projectRoot, options.auditRunner ?? runNpmAudit));
  }

  if (options.socketDev) {
    issues.push(...await scanSocketDev(projectRoot, dependencySpecs, options.socketRunner ?? runSocketCli));
  }

  if (options.snyk) {
    issues.push(...await scanSnyk(projectRoot, options.snykRunner ?? runSnykCli));
  }

  return issues;
}

async function scanNpmAudit(projectRoot: string, auditRunner: AuditRunner): Promise<Issue[]> {
  try {
    const audit = await auditRunner(projectRoot);
    return auditIssues(audit);
  } catch (error) {
    return [{
      rule: 'dependency-audit-unavailable',
      severity: 'warning',
      category: 'dependencies',
      file: 'package.json',
      message: `Dependency advisory check could not run: ${(error as Error).message}`,
      suggestion: 'Run `npm audit --json` locally or enable dependency checks again when npm registry access is available.',
    }];
  }
}

function auditIssues(audit: NpmAuditResult): Issue[] {
  const vulnerabilities = audit.vulnerabilities ?? {};
  return Object.entries(vulnerabilities).map(([dependencyName, vulnerability]) => {
    const name = vulnerability.name || dependencyName;
    const advisory = firstAdvisory(vulnerability);
    const severity = auditSeverity(vulnerability.severity);
    const fixText = vulnerability.fixAvailable ? ' A fix is available.' : '';
    return {
      rule: 'dependency-vulnerability',
      severity,
      category: 'dependencies',
      file: 'package.json',
      message: `${name} has a ${vulnerability.severity ?? 'known'} vulnerability${advisory.title ? `: ${advisory.title}` : ''}.${fixText}`,
      suggestion: [
        advisory.url ? `Review advisory: ${advisory.url}.` : undefined,
        `Confirm current package risk at ${socketPackageUrl(name)}.`,
        vulnerability.range ? `Affected range: ${vulnerability.range}.` : undefined,
      ].filter(Boolean).join(' '),
    };
  });
}

async function runNpmAudit(projectRoot: string): Promise<NpmAuditResult> {
  const { stdout } = await execFileAsync('npm', ['audit', '--json'], {
    cwd: projectRoot,
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as NpmAuditResult;
}

function firstAdvisory(vulnerability: NpmAuditVulnerability): { title?: string; url?: string } {
  for (const entry of vulnerability.via ?? []) {
    if (typeof entry === 'object' && entry !== null) {
      return { title: entry.title, url: entry.url };
    }
  }
  return {};
}

function auditSeverity(severity: string | undefined): Issue['severity'] {
  return severity === 'critical' || severity === 'high' ? 'error' : 'warning';
}

async function scanSocketDev(projectRoot: string, dependencySpecs: string[], socketRunner: SocketRunner): Promise<Issue[]> {
  if (dependencySpecs.length === 0) return [];
  try {
    const result = await socketRunner(projectRoot, dependencySpecs);
    return socketIssues(result);
  } catch (error) {
    return [{
      rule: 'dependency-socket-unavailable',
      severity: 'warning',
      category: 'dependencies',
      file: 'package.json',
      message: `Socket.dev confirmation could not run: ${(error as Error).message}`,
      suggestion: 'Install and configure the Socket CLI, or disable Socket.dev confirmation until it is available.',
    }];
  }
}

function socketIssues(result: SocketScanResult): Issue[] {
  const issues: Issue[] = [];
  for (const packageResult of result.packages ?? []) {
    for (const alert of packageResult.alerts ?? []) {
      const severity = socketSeverity(alert.severity);
      if (!severity) continue;
      const alertName = alert.type ?? 'Socket.dev alert';
      issues.push({
        rule: 'dependency-socket-alert',
        severity,
        category: 'dependencies',
        file: 'package.json',
        message: `${packageResult.name}${packageResult.version ? `@${packageResult.version}` : ''} has a ${alert.severity ?? 'medium'} Socket.dev alert: ${alertName}${alert.message ? ` - ${alert.message}` : ''}.`,
        suggestion: `Review the Socket.dev report at ${socketPackageUrl(packageResult.name)} before publishing.`,
      });
    }
  }
  return issues;
}

async function runSocketCli(projectRoot: string, packages: string[]): Promise<SocketScanResult> {
  const { stdout } = await execFileAsync('socket', ['package', 'shallow', 'npm', ...packages, '--json'], {
    cwd: projectRoot,
    timeout: 45_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return normalizeSocketCliOutput(JSON.parse(stdout));
}

function normalizeSocketCliOutput(value: unknown): SocketScanResult {
  if (!value || typeof value !== 'object') return {};
  const data = value as Record<string, unknown>;
  if (Array.isArray(data.packages)) {
    return { packages: data.packages.filter(isSocketPackageResult) };
  }
  if (Array.isArray(data.results)) {
    return { packages: data.results.filter(isSocketPackageResult) };
  }
  if (isSocketPackageResult(data)) {
    return { packages: [data] };
  }
  return {};
}

function isSocketPackageResult(value: unknown): value is SocketPackageResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const packageResult = value as Record<string, unknown>;
  return (
    typeof packageResult.name === 'string' &&
    (packageResult.version === undefined || typeof packageResult.version === 'string') &&
    (packageResult.alerts === undefined || Array.isArray(packageResult.alerts))
  );
}

function socketSeverity(severity: string | undefined): Issue['severity'] | undefined {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'middle' || severity === 'medium') return 'warning';
  return undefined;
}

async function scanSnyk(projectRoot: string, snykRunner: SnykRunner): Promise<Issue[]> {
  try {
    const result = await snykRunner(projectRoot);
    return snykIssues(result);
  } catch (error) {
    return [{
      rule: 'dependency-snyk-unavailable',
      severity: 'warning',
      category: 'dependencies',
      file: 'package.json',
      message: `Snyk confirmation could not run: ${(error as Error).message}`,
      suggestion: 'Install and authenticate the Snyk CLI, or disable Snyk confirmation until it is available.',
    }];
  }
}

function snykIssues(result: SnykScanResult): Issue[] {
  return snykVulnerabilities(result)
    .map((vulnerability): Issue | undefined => {
      const severity = snykSeverity(vulnerability.severity);
      if (!severity) return undefined;
      const name = vulnerability.packageName ?? vulnerability.name ?? firstSnykFromPackage(vulnerability.from) ?? 'dependency';
      const version = vulnerability.version ? `@${vulnerability.version}` : '';
      return {
        rule: 'dependency-snyk-vulnerability',
        severity,
        category: 'dependencies',
        file: 'package.json',
        message: `${name}${version} has a ${vulnerability.severity ?? 'known'} Snyk vulnerability${vulnerability.title ? `: ${vulnerability.title}` : ''}.`,
        suggestion: [
          vulnerability.url ? `Review advisory: ${vulnerability.url}.` : undefined,
          `Confirm current package risk at ${socketPackageUrl(name)}.`,
        ].filter(Boolean).join(' '),
      };
    })
    .filter((issue): issue is Issue => Boolean(issue));
}

function snykVulnerabilities(result: SnykScanResult): SnykVulnerability[] {
  const vulnerabilities = result.vulnerabilities;
  if (Array.isArray(vulnerabilities)) return vulnerabilities;
  if (vulnerabilities && typeof vulnerabilities === 'object') {
    return Object.values(vulnerabilities);
  }
  return [];
}

async function runSnykCli(projectRoot: string): Promise<SnykScanResult> {
  try {
    const { stdout } = await execFileAsync('snyk', ['test', '--json'], {
      cwd: projectRoot,
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout) as SnykScanResult;
  } catch (error) {
    const stdout = (error as { stdout?: unknown }).stdout;
    if (typeof stdout === 'string' && stdout.trim()) {
      return JSON.parse(stdout) as SnykScanResult;
    }
    throw error;
  }
}

function snykSeverity(severity: string | undefined): Issue['severity'] | undefined {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return undefined;
}

function firstSnykFromPackage(from: string[] | undefined): string | undefined {
  const dependency = from?.find((item, index) => index > 0 && item.includes('@'));
  if (!dependency) return undefined;
  const scoped = dependency.startsWith('@');
  const marker = scoped ? dependency.indexOf('@', 1) : dependency.indexOf('@');
  return marker > 0 ? dependency.slice(0, marker) : dependency;
}

function isDependencyMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((specifier) => typeof specifier === 'string');
}

function socketPackageUrl(packageName: string): string {
  return `https://socket.dev/npm/package/${encodeURIComponent(packageName)}`;
}
