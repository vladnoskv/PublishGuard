import { Command } from 'commander';
import * as path from 'node:path';
import { generateSafeIgnoreFile, SAFE_DEFAULT_IGNORE_RULES } from '@publishguard/core';
import chalk from 'chalk';

export const initCommand = new Command('init')
  .description('Generate safe .npmignore and .vscodeignore files')
  .argument('[directory]', 'Project directory', '.')
  .option('--npm-ignore', 'Only generate .npmignore')
  .option('--vscode-ignore', 'Only generate .vscodeignore')
  .action(async (dir: string, opts) => {
    const rootDir = path.resolve(dir);
    const results: string[] = [];

    const generateNpm = !opts.vscodeIgnore;
    const generateVscode = !opts.npmIgnore;

    if (generateNpm) {
      const r = generateSafeIgnoreFile(rootDir, '.npmignore');
      if (r.created) {
        results.push(`Created .npmignore with ${r.rulesAdded.length} rules`);
      } else if (r.rulesAdded.length > 0) {
        results.push(`Updated .npmignore with ${r.rulesAdded.length} new rules`);
      } else {
        results.push('.npmignore is already up to date');
      }
    }

    if (generateVscode) {
      const r = generateSafeIgnoreFile(rootDir, '.vscodeignore');
      if (r.created) {
        results.push(`Created .vscodeignore with ${r.rulesAdded.length} rules`);
      } else if (r.rulesAdded.length > 0) {
        results.push(`Updated .vscodeignore with ${r.rulesAdded.length} new rules`);
      } else {
        results.push('.vscodeignore is already up to date');
      }
    }

    console.log(chalk.green('PublishGuard init complete:'));
    for (const r of results) {
      console.log(`  ${chalk.green('✓')} ${r}`);
    }
  });
