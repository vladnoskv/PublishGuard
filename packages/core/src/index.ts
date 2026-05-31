export { scan } from './scanner';
export {
  getNpmPublishFiles,
  getVsixPublishFiles,
} from './scanners/file-list';
export { scanSecrets } from './scanners/secrets';
export {
  validateIgnoreFiles,
  generateSafeIgnoreFile,
  SAFE_DEFAULT_IGNORE_RULES,
} from './scanners/ignore-validator';
export { scanManifest } from './scanners/manifest';
export { scanFileSizes } from './scanners/file-size';
export { scanDependencies } from './scanners/dependencies';
export { generateSarifReport } from './reporters/sarif-reporter';
export { loadConfig } from './config';
export type { ScanResult, Issue, Severity, Category } from './types';
export type { ScanOptions, PublishGuardConfig } from './config';
export type { IgnoreValidationResult, IgnoreValidationOptions } from './scanners/ignore-validator';
export type { ManifestScanResult } from './scanners/manifest';
export type { SecretScanOptions } from './scanners/secrets';
export type { FileSizeOptions } from './scanners/file-size';
