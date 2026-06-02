/** Severity of a finding. */
export type Severity = 'error' | 'warning' | 'info';

/** Category of a finding — maps to a rule group. */
export type Category =
  | 'secrets'
  | 'ignore-file'
  | 'manifest'
  | 'metadata'
  | 'file-size'
  | 'dependencies'
  | 'sensitive-file'
  | 'unknown';

/** Exact 1-based source location for a finding. End columns are exclusive. */
export interface IssueLocation {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  excerpt?: string;
}

/** A single issue found during scanning. */
export interface Issue {
  rule: string;
  severity: Severity;
  category: Category;
  file: string;
  message: string;
  suggestion?: string;
  location?: IssueLocation;
  fingerprint?: string;
}

/** Full result of a scan operation. */
export interface ScanResult {
  projectRoot: string;
  scanMode: 'quick' | 'full' | 'deep';
  packageType: 'npm' | 'vscode' | 'both' | 'unknown';
  publishedFiles: string[];
  fileListMethod: string;
  issues: Issue[];
  summary: { errors: number; warnings: number; infos: number };
  durationMs: number;
}

export type { ScanOptions } from './config';
