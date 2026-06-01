import { Command } from 'commander';
import { scanCommand } from './commands/scan';
import { initCommand } from './commands/init';
import { fixCommand } from './commands/fix';

const program = new Command();

program
  .name('publishguard')
  .description('Pre-publish safety scanner for npm and VS Code extensions')
  .version('0.3.1');

program.addCommand(scanCommand);
program.addCommand(initCommand);
program.addCommand(fixCommand);

export function run(argv: string[] = process.argv) {
  program.parse(argv);
}
