import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scan } from '../src/scanner';
import { scanSecrets } from '../src/scanners/secrets';

describe('secret issue locations', () => {
  it('reports exact location and fingerprint for regex secret matches', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-secret-location-'));
    const srcDir = path.join(dir, 'src');
    const fakeAwsKey = ['AKIA', '1234567890ABCDEF'].join('');
    const secondFakeAwsKey = ['AKIA', 'FEDCBA0987654321'].join('');

    try {
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          {
            name: 'secret-location-project',
            version: '1.0.0',
            files: ['src/config.ts'],
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(srcDir, 'config.ts'),
        `// config\nexport const key = "${fakeAwsKey}";\nexport const backupKey = "${secondFakeAwsKey}";\n`,
      );

      const result = await scan({
        projectRoot: dir,
        skip: ['ignore-validation', 'manifest', 'file-size'],
      });

      const issues = result.issues.filter((i) => i.rule === 'aws-access-key');
      const issue = issues.find((i) => i.fingerprint === 'aws-access-key:src/config.ts:2:21');
      const secondIssue = issues.find((i) => i.fingerprint === 'aws-access-key:src/config.ts:3:27');

      expect(issues).toHaveLength(2);
      expect(issue).toBeDefined();
      expect(issue?.location).toEqual({
        line: 2,
        column: 21,
        endLine: 2,
        endColumn: 41,
        excerpt: `export const key = "${fakeAwsKey}";`,
      });
      expect(issue?.fingerprint).toBe('aws-access-key:src/config.ts:2:21');

      expect(secondIssue).toBeDefined();
      expect(secondIssue?.location).toEqual({
        line: 3,
        column: 27,
        endLine: 3,
        endColumn: 47,
        excerpt: `export const backupKey = "${secondFakeAwsKey}";`,
      });
      expect(secondIssue?.fingerprint).toBe('aws-access-key:src/config.ts:3:27');
      expect(new Set(issues.map((i) => i.fingerprint))).toHaveLength(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('matches sensitive files from normalized file input and reports normalized paths', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-sensitive-location-'));
    const configDir = path.join(dir, 'config');

    try {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, '.env'), 'SECRET=abc123\n');

      const issues = await scanSecrets({
        files: ['config\\.env'],
        rootDir: dir,
      });
      const issue = issues.find((i) => i.rule === 'env-file');

      expect(issue).toBeDefined();
      expect(issue?.file).toBe('config/.env');
      expect(issue?.message).toBe('.env file: config/.env');
      expect(issue?.suggestion).toBe('Add "config/.env" to your .npmignore or .vscodeignore file');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects modern provider token formats and secret-bearing config files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publishguard-modern-secrets-'));
    const source = path.join(dir, 'config.ts');
    const npmrc = path.join(dir, '.npmrc');

    try {
      fs.writeFileSync(source, [
        'const gitlab = "glpat-1234567890abcdefghijkl";',
        'const slack = "xoxb-1234567890-abcdefghij";',
        'const stripe = "sk_live_1234567890abcdefghijkl";',
        'const google = "AIza12345678901234567890123456789012345";',
        'const sendgrid = "SG.1234567890abcdef.1234567890abcdef";',
        'const openai = "sk-proj-1234567890abcdefghijkl";',
        'const digitalocean = "dop_v1_0123456789abcdef0123456789abcdef";',
      ].join('\n'));
      fs.writeFileSync(npmrc, '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n');

      const issues = await scanSecrets({
        files: ['config.ts', '.npmrc'],
        rootDir: dir,
      });
      const rules = new Set(issues.map((issue) => issue.rule));

      expect(rules).toEqual(new Set([
        'gitlab-token',
        'slack-token',
        'stripe-secret-key',
        'google-api-key',
        'sendgrid-api-key',
        'openai-api-key',
        'digitalocean-token',
        'credentials-file',
      ]));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
