import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { scan, generateSafeIgnoreFile } from '@publishguard/core';
import chalk from 'chalk';

export const fixCommand = new Command('fix')
  .description('Automatically fix common issues (add ignore rules, etc.)')
  .argument('[directory]', 'Project directory', '.')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(async (dir: string, opts) => {
    const rootDir = path.resolve(dir);
    const dryRun = opts.dryRun as boolean;

    // Run a scan first
    const result = await scan({ projectRoot: rootDir });
    const changes: string[] = [];

    // Auto-fix: generate ignore rules for sensitive files
    const ignoreFileNeeded = result.issues.some(
      (i) => i.category === 'ignore-file' && i.severity === 'error',
    );
    const secretFiles = result.issues
      .filter((i) => i.category === 'secrets' || i.category === 'sensitive-file')
      .map((i) => i.file);

    if (ignoreFileNeeded || secretFiles.length > 0) {
      const targets: string[] = [];
      if (!fs.existsSync(path.join(rootDir, '.npmignore'))) targets.push('.npmignore');
      if (!fs.existsSync(path.join(rootDir, '.vscodeignore'))) {
        const pkgExists = fs.existsSync(path.join(rootDir, 'package.json'));
        if (pkgExists) {
          const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
          if (pkg.engines?.vscode || pkg.activationEvents || pkg.publisher) {
            targets.push('.vscodeignore');
          }
        }
      }

      for (const target of targets) {
        if (dryRun) {
          changes.push(`Would create ${target} with safe defaults`);
        } else {
          const r = generateSafeIgnoreFile(rootDir, target);
          changes.push(`${r.created ? 'Created' : 'Updated'} ${target}`);
        }
      }

      if (secretFiles.length > 0 && !dryRun) {
        // Append specific secret files to existing ignore files
        const appendTargets = ['.npmignore', '.vscodeignore'].filter((f) =>
          fs.existsSync(path.join(rootDir, f)),
        );
        if (appendTargets.length === 0) appendTargets.push('.npmignore');
        for (const target of appendTargets) {
          const filePath = path.join(rootDir, target);
          const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
          const newEntries = secretFiles.filter((sf) => !existing.includes(sf));
          if (newEntries.length > 0) {
            const header = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
            fs.appendFileSync(filePath, header + '# PublishGuard: sensitive files\n' + newEntries.join('\n') + '\n');
            changes.push(`Added ${newEntries.length} sensitive files to ${target}`);
          }
        }
      }
    }

    if (changes.length === 0) {
      console.log(chalk.green('Nothing to fix. Your project looks clean!'));
    } else {
      console.log(chalk.green(dryRun ? 'Dry run — would make these changes:' : 'Fixed issues:'));
      for (const c of changes) {
        console.log(`  ${chalk.green('✓')} ${c}`);
      }
    }
  });
