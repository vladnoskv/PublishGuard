import { describe, expect, it } from 'vitest';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scan } from '../src/scanner';

function createProject(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `publishguard-${name}-`));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '1.0.0',
        files: ['index.js'],
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');
  return dir;
}

function commitAll(dir: string): void {
  childProcess.execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  childProcess.execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' });
  childProcess.execFileSync(
    'git',
    ['-c', 'user.name=PublishGuard Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'],
    { cwd: dir, stdio: 'ignore' },
  );
}

describe('example file false-positive policy', () => {
  it('does not scan unpublished docs and examples by default', async () => {
    const dir = createProject('example-policy-unpublished');
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.mkdirSync(path.join(dir, 'docs'));
      fs.writeFileSync(path.join(dir, 'docs', 'example.md'), `Use fake key ${fakeAwsKey} in examples only.\n`);

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size', 'dependencies'],
      });

      expect(result.issues.some((issue) => issue.file === 'docs/example.md')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scans docs and examples that are present in git history when enabled', async () => {
    const dir = createProject('example-policy-git-history');
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.mkdirSync(path.join(dir, 'docs'));
      fs.writeFileSync(path.join(dir, 'docs', 'example.md'), `Use fake key ${fakeAwsKey} in examples only.\n`);
      commitAll(dir);

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size', 'dependencies'],
      });
      const issue = result.issues.find((candidate) => candidate.file === 'docs/example.md');

      expect(issue?.rule).toBe('aws-access-key');
      expect(issue?.severity).toBe('info');
      expect(issue?.suggestion).toContain('example or documentation false positive');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lets users opt into scanning all unpublished docs and examples', async () => {
    const dir = createProject('example-policy-opt-in');
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.mkdirSync(path.join(dir, 'examples'));
      fs.writeFileSync(path.join(dir, 'examples', 'sample.js'), `const fakeKey = "${fakeAwsKey}";\n`);
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            exampleFiles: {
              scanUnpublished: true,
            },
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size', 'dependencies'],
      });

      expect(result.issues.some((issue) => issue.file === 'examples/sample.js')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lets users turn off dummy secret findings in example files', async () => {
    const dir = createProject('example-policy-dummy-off');
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.mkdirSync(path.join(dir, 'examples'));
      fs.writeFileSync(path.join(dir, 'examples', 'sample.js'), `const fakeKey = "${fakeAwsKey}";\n`);
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            exampleFiles: {
              scanUnpublished: true,
              dummySecretSeverity: 'off',
            },
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size', 'dependencies'],
      });

      expect(result.issues.some((issue) => issue.file === 'examples/sample.js')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
