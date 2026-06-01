import { describe, it, expect } from 'vitest';
import { scanManifest } from '../src/scanners/manifest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Manifest Scanner', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should error on missing package.json', () => {
    const result = scanManifest(tmpDir);
    expect(result.issues.some((i) => i.rule === 'missing-package-json')).toBe(true);
  });

  it('should error on invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ invalid }');
    const result = scanManifest(tmpDir);
    expect(result.issues.some((i) => i.rule === 'invalid-package-json')).toBe(true);
  });

  it('should detect missing required fields', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({}));
    const result = scanManifest(tmpDir);
    expect(result.issues.some((i) => i.rule === 'missing-name')).toBe(true);
    expect(result.issues.some((i) => i.rule === 'missing-version')).toBe(true);
  });

  it('should detect missing publisher for VS Code extensions', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-ext',
        version: '1.0.0',
        engines: { vscode: '^1.90.0' },
      }),
    );
    const result = scanManifest(tmpDir);
    expect(result.issues.some((i) => i.rule === 'missing-publisher')).toBe(true);
    expect(result.isVsCodeExtension).toBe(true);
  });

  it('should detect missing README and LICENSE', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-pkg',
        version: '1.0.0',
        description: 'A test package',
      }),
    );
    const result = scanManifest(tmpDir);
    expect(result.issues.some((i) => i.rule === 'missing-readme')).toBe(true);
    expect(result.issues.some((i) => i.rule === 'missing-license-file')).toBe(true);
  });

  it('should pass on valid package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'valid-pkg',
        version: '1.0.0',
        description: 'A valid package',
        license: 'MIT',
        repository: 'https://github.com/test/valid',
      }),
    );
    const result = scanManifest(tmpDir);
    const pkgIssues = result.issues.filter((i) => i.file === 'package.json');
    expect(pkgIssues.length).toBe(0);
  });
});
