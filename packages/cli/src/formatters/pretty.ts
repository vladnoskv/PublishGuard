import chalk from 'chalk';
import type { ScanResult } from '@publishguard/core';

export function printPrettyOutput(result: ScanResult): void {
  console.log('');
  console.log(chalk.bold.cyan('PublishGuard — Pre-Publish Safety Scan'));
  console.log(chalk.dim(`Scanned: ${result.projectRoot}`));
  console.log(chalk.dim(`Scan mode: ${result.scanMode}`));
  console.log(chalk.dim(`Package type: ${result.packageType}`));
  console.log(chalk.dim(`Files to publish: ${result.publishedFiles.length}  (via ${result.fileListMethod})`));
  console.log(chalk.dim(`Duration: ${result.durationMs}ms`));
  console.log('');

  if (result.issues.length === 0) {
    console.log(chalk.green.bold('✓ No issues found. Your package is safe to publish!'));
    console.log('');
    return;
  }

  const grouped: Record<string, typeof result.issues> = {
    error: [],
    warning: [],
    info: [],
  };

  for (const issue of result.issues) {
    grouped[issue.severity].push(issue);
  }

  const icons: Record<string, string> = {
    error: chalk.red('✖'),
    warning: chalk.yellow('⚠'),
    info: chalk.blue('ℹ'),
  };

  for (const severity of ['error', 'warning', 'info'] as const) {
    const items = grouped[severity];
    if (items.length === 0) continue;
    const label = severity.toUpperCase();
    const colorFn = severity === 'error' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.blue;
    console.log(colorFn.bold(`${label} (${items.length})`));

    for (const issue of items) {
      console.log(`  ${icons[severity]} ${chalk.bold(issue.rule)}: ${issue.message}`);
      if (issue.file) {
        console.log(`    ${chalk.dim('in')} ${chalk.cyan(issue.file)}`);
      }
      if (issue.suggestion) {
        console.log(`    ${chalk.dim('→')} ${issue.suggestion}`);
      }
    }
    console.log('');
  }

  console.log(
    chalk.bold(
      `Summary: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.infos} infos`,
    ),
  );
  console.log('');
}
