import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scan } from '../src/scanner';

describe('.gitignore exposure filtering', () => {
  it('does not flag gitignored local-only files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-gitignore-'));
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'gitignore-test',
          version: '1.0.0',
          files: ['index.js'],
        }),
      );
      fs.writeFileSync(path.join(dir, '.gitignore'), '.env\n');
      fs.writeFileSync(path.join(dir, '.env'), `AWS_KEY=${fakeAwsKey}\n`);
      fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');

      const result = await scan({ projectRoot: dir, skip: ['ignore-validation'] });
      expect(result.issues.some((issue) => issue.file === '.env')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not flag gitignored files that package resolution does not expose', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-gitignore-published-'));
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'gitignore-published-test',
          version: '1.0.0',
          files: ['config.js', 'index.js'],
        }),
      );
      fs.writeFileSync(path.join(dir, '.gitignore'), 'config.js\n');
      fs.writeFileSync(path.join(dir, 'config.js'), `const key = "${fakeAwsKey}";\n`);
      fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');

      const result = await scan({ projectRoot: dir, skip: ['ignore-validation'] });
      expect(result.publishedFiles.includes('config.js')).toBe(false);
      expect(result.issues.some((issue) => issue.file === 'config.js')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scans gitignored files when VS Code package resolution exposes them', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-gitignore-main-'));
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'gitignore-main-test',
          version: '1.0.0',
          publisher: 'test-publisher',
          engines: { vscode: '^1.90.0' },
          main: 'index.js',
        }),
      );
      fs.writeFileSync(path.join(dir, '.gitignore'), 'config.js\n');
      fs.writeFileSync(path.join(dir, '.vscodeignore'), '\n');
      fs.writeFileSync(path.join(dir, 'config.js'), `const key = "${fakeAwsKey}";\n`);
      fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');

      const result = await scan({
        projectRoot: dir,
        packageType: 'vscode',
        skip: ['ignore-validation', 'manifest', 'file-size'],
      });
      expect(result.publishedFiles.includes('config.js')).toBe(true);
      expect(result.issues.some((issue) => issue.file === 'config.js')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scans gitignored exposed files the same way when includeGitIgnored is requested', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-gitignore-include-'));
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');

    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'gitignore-include-test',
          version: '1.0.0',
          publisher: 'test-publisher',
          engines: { vscode: '^1.90.0' },
          main: 'index.js',
        }),
      );
      fs.writeFileSync(path.join(dir, '.gitignore'), 'config.js\n');
      fs.writeFileSync(path.join(dir, '.vscodeignore'), '\n');
      fs.writeFileSync(path.join(dir, 'config.js'), `const key = "${fakeAwsKey}";\n`);
      fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');

      const result = await scan({
        projectRoot: dir,
        packageType: 'vscode',
        includeGitIgnored: true,
        skip: ['ignore-validation', 'manifest', 'file-size'],
      });
      expect(result.publishedFiles.includes('config.js')).toBe(true);
      expect(result.issues.some((issue) => issue.file === 'config.js')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('includes gitignored workspace files in content scans when includeGitIgnored is requested', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-gitignore-workspace-'));
    const fakeAwsKey = ['AKIA', '1122334455667788'].join('');

    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'gitignore-workspace-test',
          version: '1.0.0',
          files: ['index.js'],
        }),
      );
      fs.writeFileSync(path.join(dir, '.gitignore'), '.env\n');
      fs.writeFileSync(path.join(dir, '.env'), `AWS_KEY=${fakeAwsKey}\n`);
      fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');

      const result = await scan({
        projectRoot: dir,
        includeGitIgnored: true,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.publishedFiles.includes('.env')).toBe(false);
      expect(result.issues.some((issue) => issue.file === '.env')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not include unignored unpublished workspace files when includeGitIgnored is requested', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-gitignore-unpublished-'));
    const fakeAwsKey = ['AKIA', '2233445566778899'].join('');

    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'gitignore-unpublished-test',
          version: '1.0.0',
          files: ['index.js'],
        }),
      );
      fs.writeFileSync(path.join(dir, '.gitignore'), '.env\n');
      fs.writeFileSync(path.join(dir, 'notes.js'), `const key = "${fakeAwsKey}";\n`);
      fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};\n');

      const result = await scan({
        projectRoot: dir,
        includeGitIgnored: true,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.issues.some((issue) => issue.file === 'notes.js')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('limits content scans to staged files intersected with exposed package files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-staged-'));
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');
    const secondFakeAwsKey = ['AKIA', 'FEDCBA0987654321'].join('');
    const localFakeAwsKey = ['AKIA', '0011223344556677'].join('');

    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'staged-test',
          version: '1.0.0',
          files: ['config.js', 'extra.js'],
        }),
      );
      fs.writeFileSync(path.join(dir, '.gitignore'), 'local.js\n');
      fs.writeFileSync(path.join(dir, 'config.js'), `const key = "${fakeAwsKey}";\n`);
      fs.writeFileSync(path.join(dir, 'extra.js'), `const key = "${secondFakeAwsKey}";\n`);
      fs.writeFileSync(path.join(dir, 'local.js'), `const key = "${localFakeAwsKey}";\n`);

      const result = await scan({
        projectRoot: dir,
        stagedFiles: [path.join(dir, 'config.js'), 'local.js'],
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.issues.some((issue) => issue.file === 'config.js')).toBe(true);
      expect(result.issues.some((issue) => issue.file === 'extra.js')).toBe(false);
      expect(result.issues.some((issue) => issue.file === 'local.js')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
