import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { scan } from '../src/scanner';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('PublishGuard Core Scanner', () => {
  it('should detect missing package.json', async () => {
    const emptyDir = path.join(fixturesDir, 'empty');
    if (!fs.existsSync(emptyDir)) fs.mkdirSync(emptyDir, { recursive: true });

    const result = await scan({ projectRoot: emptyDir });
    expect(result.issues.some((i) => i.rule === 'missing-package-json')).toBe(true);
  });

  it('should detect missing required fields in package.json', async () => {
    const dir = path.join(fixturesDir, 'minimal-package');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'minimal', description: 'test' }, null, 2),
    );

    const result = await scan({ projectRoot: dir });
    expect(result.issues.some((i) => i.rule === 'missing-name')).toBe(false);
    expect(result.issues.some((i) => i.rule === 'missing-version')).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should detect valid package.json passes manifest checks', async () => {
    const dir = path.join(fixturesDir, 'valid-package');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
        license: 'MIT',
        repository: 'https://github.com/test/test',
      }, null, 2),
    );

    // Create a dummy file so npm-packlist has something to list
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');

    const result = await scan({ projectRoot: dir });
    const manifestIssues = result.issues.filter((i) => i.category === 'manifest');
    expect(manifestIssues.length).toBe(0);

    // Cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should detect .env file in published files', async () => {
    const dir = path.join(fixturesDir, 'env-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'env-project',
        version: '1.0.0',
        files: ['.env', 'index.js'],
      }, null, 2),
    );
    fs.writeFileSync(path.join(dir, '.env'), 'SECRET=abc123');
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');

    const result = await scan({ projectRoot: dir });
    expect(result.issues.some((i) => i.rule === 'env-file')).toBe(true);

    // Cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should validate ignore files', async () => {
    const dir = path.join(fixturesDir, 'no-ignore');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'no-ignore',
        version: '1.0.0',
      }, null, 2),
    );
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');

    const result = await scan({ projectRoot: dir });
    // Should warn about missing .npmignore
    expect(result.issues.some((i) => i.rule === 'missing-ignore-file')).toBe(true);

    // Cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should detect secrets in file contents', async () => {
    const dir = path.join(fixturesDir, 'secret-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'secret-project',
        version: '1.0.0',
        files: ['config.js', 'index.js'],
      }, null, 2),
    );
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');
    fs.writeFileSync(
      path.join(dir, 'config.js'),
      `const API_KEY = "${fakeAwsKey}";`,
    );
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');

    const result = await scan({ projectRoot: dir, skip: ['ignore-validation'] });
    expect(result.issues.some((i) => i.rule === 'aws-access-key')).toBe(true);

    // Cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should ignore configured file globs before reporting issues', async () => {
    const dir = path.join(fixturesDir, 'ignored-glob-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'ignored-glob-project',
        version: '1.0.0',
        files: ['fixtures/example.json', 'index.js'],
      }, null, 2),
    );
    fs.mkdirSync(path.join(dir, 'fixtures'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'fixtures', 'example.json'), '{"token":"not-a-real-secret"}');
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');
    fs.writeFileSync(
      path.join(dir, '.publishguardrc.json'),
      JSON.stringify({ ignore: ['fixtures/**'] }, null, 2),
    );

    const result = await scan({ projectRoot: dir, skip: ['ignore-validation'] });
    expect(result.issues.some((i) => i.file === 'fixtures/example.json')).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should warn about risky dependency specifiers with Socket.dev confirmation links', async () => {
    const dir = path.join(fixturesDir, 'dependency-risk-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'dependency-risk-project',
        version: '1.0.0',
        dependencies: {
          leftpad: 'latest',
          'from-git': 'github:example/from-git',
        },
      }, null, 2),
    );
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');

    const result = await scan({ projectRoot: dir, skip: ['ignore-validation'] });

    expect(result.issues.some((i) => i.rule === 'dependency-floating-version')).toBe(true);
    expect(result.issues.some((i) => i.rule === 'dependency-non-registry-source')).toBe(true);
    expect(result.issues.some((i) => i.suggestion?.includes('https://socket.dev/npm/package/leftpad'))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should scan successfully on a clean project', async () => {
    const dir = path.join(fixturesDir, 'clean-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'clean-project',
        version: '1.0.0',
        description: 'A clean package',
        license: 'MIT',
        repository: 'https://github.com/test/clean',
        files: ['index.js'],
      }, null, 2),
    );
    fs.writeFileSync(
      path.join(dir, '.npmignore'),
      '.env\n.env.*\n*.log\n*.key\n*.pem\n',
    );
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');

    const result = await scan({ projectRoot: dir });
    // Should have no errors — but may have warnings for missing README etc
    expect(result.summary.errors).toBe(0);

    // Cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('quick scan skips source-derived capability analysis', async () => {
    const dir = path.join(fixturesDir, 'quick-source-capability-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'quick-source-capability-project',
        version: '1.0.0',
        publisher: 'test',
        engines: { vscode: '^1.90.0' },
        contributes: {
          commands: [
            { command: 'quickSource.openOutput', title: 'Quick Source: Open Output' },
          ],
        },
      }, null, 2),
    );
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'src', 'extension.ts'),
      "import * as vscode from 'vscode';\nvscode.languages.createDiagnosticCollection('quick-source');\n",
    );

    const result = await scan({ projectRoot: dir, scanMode: 'quick', skip: ['ignore-validation'] });

    expect(result.scanMode).toBe('quick');
    expect(result.issues.some((i) => i.rule === 'vscode-diagnostic-provider-missing-refresh-command')).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('full scan includes bounded source-derived capability analysis', async () => {
    const dir = path.join(fixturesDir, 'full-source-capability-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'full-source-capability-project',
        version: '1.0.0',
        publisher: 'test',
        engines: { vscode: '^1.90.0' },
        contributes: {
          commands: [
            { command: 'fullSource.openOutput', title: 'Full Source: Open Output' },
          ],
        },
      }, null, 2),
    );
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'src', 'extension.ts'),
      "import * as vscode from 'vscode';\nvscode.languages.createDiagnosticCollection('full-source');\n",
    );

    const result = await scan({ projectRoot: dir, scanMode: 'full', skip: ['ignore-validation'] });

    expect(result.scanMode).toBe('full');
    expect(result.issues.some((i) => i.rule === 'vscode-diagnostic-provider-missing-refresh-command')).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('deep scan includes gitignored local files and unpublished examples', async () => {
    const dir = path.join(fixturesDir, 'deep-local-sweep-project');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'deep-local-sweep-project',
        version: '1.0.0',
        files: ['index.js'],
      }, null, 2),
    );
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(dir, '.gitignore'), '.env.local\n');
    fs.writeFileSync(path.join(dir, '.env.local'), 'AWS_SECRET_ACCESS_KEY=abcdefghijklmnopqrstuvwxyzABCD1234567890');
    fs.mkdirSync(path.join(dir, 'examples'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'examples', 'secret.txt'), 'AKIA1234567890ABCDEF');

    const result = await scan({
      projectRoot: dir,
      scanMode: 'deep',
      skip: ['ignore-validation'],
    });

    expect(result.scanMode).toBe('deep');
    expect(result.issues.some((i) => i.file === '.env.local')).toBe(true);
    expect(result.issues.some((i) => i.file === 'examples/secret.txt')).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
