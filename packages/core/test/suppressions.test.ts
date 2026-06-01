import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scan } from '../src/scanner';

describe('suppression filtering', () => {
  it('suppresses issues by rule and file glob', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-suppress-rule-file-'));
    const configDir = path.join(dir, 'config');

    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'suppress-rule-file',
            version: '1.0.0',
            files: ['config/.env'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(path.join(configDir, '.env'), 'SECRET=abc123\n');
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            suppressions: [
              {
                rule: 'env-file',
                file: 'config/**',
                reason: 'Fixture intentionally exercises env-file detection.',
              },
            ],
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.issues.some((issue) => issue.rule === 'env-file')).toBe(false);
      expect(result.summary.errors).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports Windows-style file glob suppressions', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-suppress-windows-glob-'));
    const configDir = path.join(dir, 'config');

    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'suppress-windows-glob',
            version: '1.0.0',
            files: ['config/.env'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(path.join(configDir, '.env'), 'SECRET=abc123\n');
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            suppressions: [
              {
                rule: 'env-file',
                file: 'config\\**',
                reason: 'Windows-style glob should normalize.',
              },
            ],
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.issues.some((issue) => issue.rule === 'env-file')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores malformed suppressions without crashing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-malformed-suppression-'));
    const configDir = path.join(dir, 'config');

    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'malformed-suppression',
            version: '1.0.0',
            files: ['config/.env'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(path.join(configDir, '.env'), 'SECRET=abc123\n');
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            suppressions: [
              {
                rule: 'env-file',
                file: 'config/**',
              },
            ],
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.issues.some((issue) => issue.rule === 'env-file')).toBe(true);
      expect(result.summary.errors).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores null and non-object suppression entries without crashing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-invalid-suppression-entry-'));
    const configDir = path.join(dir, 'config');

    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'invalid-suppression-entry',
            version: '1.0.0',
            files: ['config/.env'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(path.join(configDir, '.env'), 'SECRET=abc123\n');
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            suppressions: [null, 'bad'],
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.issues.some((issue) => issue.rule === 'env-file')).toBe(true);
      expect(result.summary.errors).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores blank suppression reasons without crashing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-blank-suppression-reason-'));
    const configDir = path.join(dir, 'config');

    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'blank-suppression-reason',
            version: '1.0.0',
            files: ['config/.env'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(path.join(configDir, '.env'), 'SECRET=abc123\n');
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            suppressions: [
              {
                rule: 'env-file',
                file: 'config/**',
                reason: '   ',
              },
            ],
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });

      expect(result.issues.some((issue) => issue.rule === 'env-file')).toBe(true);
      expect(result.summary.errors).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rewrites severity overrides instead of suppressing findings', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-severity-override-'));
    const configDir = path.join(dir, 'config');

    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'severity-override',
            version: '1.0.0',
            files: ['config/.env'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(path.join(configDir, '.env'), 'SECRET=abc123\n');
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            rules: {
              'env-file': 'warning',
            },
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });
      const envIssue = result.issues.find((issue) => issue.rule === 'env-file');

      expect(envIssue?.severity).toBe('warning');
      expect(result.summary.errors).toBe(0);
      expect(result.summary.warnings).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('suppresses issues by exact fingerprint', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-suppress-fingerprint-'));
    const srcDir = path.join(dir, 'src');
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');
    const secondFakeAwsKey = ['AKIA', 'FEDCBA0987654321'].join('');

    try {
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'suppress-fingerprint',
            version: '1.0.0',
            files: ['src/config.ts'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(srcDir, 'config.ts'),
        `export const key = "${fakeAwsKey}";\nexport const backupKey = "${secondFakeAwsKey}";\n`,
      );
      fs.writeFileSync(
        path.join(dir, '.publishguardrc.json'),
        JSON.stringify(
          {
            suppressions: [
              {
                fingerprint: 'aws-access-key:src/config.ts:1:21',
                reason: 'Known test credential shape.',
              },
            ],
          },
          null,
          2,
        ),
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['manifest', 'ignore-validation', 'file-size'],
      });
      const awsIssues = result.issues.filter((issue) => issue.rule === 'aws-access-key');

      expect(awsIssues).toHaveLength(1);
      expect(awsIssues[0]?.fingerprint).toBe('aws-access-key:src/config.ts:2:27');
      expect(result.summary.errors).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
