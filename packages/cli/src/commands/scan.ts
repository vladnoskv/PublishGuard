import { Command } from 'commander';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { scan } from '@publishguard/core';
import { printPrettyOutput } from '../formatters/pretty';
import { printJsonOutput } from '../formatters/json';
import { printCIOutput } from '../formatters/ci';

export const scanCommand = new Command('scan')
  .description('Scan a package directory for publishing issues')
  .argument('[directory]', 'Project directory to scan', '.')
  .option('--json', 'Output results as JSON')
  .option('--ci', 'CI-friendly output (GitHub Actions annotations)')
  .option('--skip <categories>', 'Comma-separated categories to skip')
  .option('--fail-on <severity>', 'Exit with non-zero code on this severity or higher', 'error')
  .option('--package-type <type>', 'Force package type: npm, vscode, or both')
  .option('--staged', 'Only scan files staged for commit')
  .option('--include-gitignored', 'Include files matched by .gitignore in secret and size scans')
  .option('--dependency-audit', 'Run npm audit and report known vulnerable dependencies')
  .option('--socket-dev', 'Run Socket.dev CLI confirmation for medium/high supply-chain alerts')
  .option('--snyk', 'Run Snyk CLI confirmation for medium/high dependency vulnerabilities')
  .action(async (dir: string, opts) => {
    const projectRoot = path.resolve(dir);
    const stagedFiles = opts.staged ? getStagedFiles(projectRoot) : undefined;
    const result = await scan({
      projectRoot,
      skip: opts.skip?.split(',').map((s: string) => s.trim()),
      packageType: opts.packageType as 'npm' | 'vscode' | 'both' | undefined,
      stagedFiles,
      includeGitIgnored: Boolean(opts.includeGitignored),
      dependencyAudit: Boolean(opts.dependencyAudit),
      socketDev: Boolean(opts.socketDev),
      snyk: Boolean(opts.snyk),
    });

    if (opts.json) {
      printJsonOutput(result);
    } else if (opts.ci) {
      printCIOutput(result);
    } else {
      printPrettyOutput(result);
    }

    const hasErrors = result.summary.errors > 0;
    const hasWarnings = result.summary.warnings > 0;
    const failOn = opts.failOn as string;

    if (failOn === 'error' && hasErrors) {
      process.exit(1);
    } else if (failOn === 'warning' && (hasErrors || hasWarnings)) {
      process.exit(1);
    } else if (failOn === 'info' && (hasErrors || hasWarnings || result.summary.infos > 0)) {
      process.exit(1);
    }
  });

function getStagedFiles(projectRoot: string): string[] {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
      { cwd: projectRoot, encoding: 'utf-8' },
    );
    return output
      .split(/\r?\n/)
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
