import { describe, it, expect } from 'vitest';
import { validateIgnoreFiles, generateSafeIgnoreFile, SAFE_DEFAULT_IGNORE_RULES } from '../src/scanners/ignore-validator';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Ignore Validator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should warn about missing .npmignore', () => {
    const result = validateIgnoreFiles({
      rootDir: tmpDir,
      publishedFiles: ['index.js'],
      ignoreFiles: ['.npmignore'],
    });
    expect(result.fileResults[0].issues.some((i) => i.rule === 'missing-ignore-file')).toBe(true);
  });

  it('should detect missing safe ignore rules', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=test');
    fs.writeFileSync(path.join(tmpDir, '.npmignore'), '');

    const result = validateIgnoreFiles({
      rootDir: tmpDir,
      publishedFiles: ['.env', 'index.js'],
      ignoreFiles: ['.npmignore'],
    });
    expect(result.fileResults[0].issues.some((i) => i.rule.includes('env'))).toBe(true);
  });

  it('should detect dangerous negations', () => {
    fs.writeFileSync(path.join(tmpDir, '.npmignore'), '!\n!*');

    const result = validateIgnoreFiles({
      rootDir: tmpDir,
      publishedFiles: ['index.js'],
      ignoreFiles: ['.npmignore'],
    });
    expect(result.fileResults[0].issues.some((i) => i.rule === 'dangerous-negation')).toBe(true);
  });

  it('should attach exact locations to slash lint findings', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'dist\nsecrets/\n/docs\n');

    const result = validateIgnoreFiles({
      rootDir: tmpDir,
      publishedFiles: ['index.js'],
      ignoreFiles: ['.gitignore'],
    });

    const trailingSlash = result.fileResults[0].issues.find((i) => i.rule === 'trailing-slash');
    const leadingSlash = result.fileResults[0].issues.find((i) => i.rule === 'leading-slash');

    expect(trailingSlash?.location).toEqual({
      line: 2,
      column: 1,
      endLine: 2,
      endColumn: 9,
      excerpt: 'secrets/',
    });
    expect(leadingSlash?.location).toEqual({
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 6,
      excerpt: '/docs',
    });
  });

  it('should generate safe ignore file', () => {
    const result = generateSafeIgnoreFile(tmpDir, '.npmignore');
    expect(result.created).toBe(true);
    expect(result.rulesAdded.length).toBeGreaterThan(5);
    expect(fs.existsSync(path.join(tmpDir, '.npmignore'))).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, '.npmignore'), 'utf-8');
    expect(content).toContain('.env');
    expect(content).toContain('*.key');
  });

  it('should append to existing ignore file', () => {
    fs.writeFileSync(path.join(tmpDir, '.npmignore'), 'dist\n');
    const result = generateSafeIgnoreFile(tmpDir, '.npmignore');
    expect(result.created).toBe(false);
    expect(result.rulesAdded.length).toBeGreaterThan(0);
  });
});
