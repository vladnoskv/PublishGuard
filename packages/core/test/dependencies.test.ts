import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanDependencies } from '../src/scanners/dependencies';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('dependency scanner', () => {
  it('reports npm audit vulnerabilities from a provided audit runner', async () => {
    const dir = path.join(fixturesDir, 'audit-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'audit-project',
        version: '1.0.0',
        dependencies: { minimist: '0.0.8' },
      }, null, 2),
    );

    const issues = await scanDependencies(dir, {
      npmAudit: true,
      auditRunner: async () => ({
        vulnerabilities: {
          minimist: {
            name: 'minimist',
            severity: 'critical',
            via: [
              {
                title: 'Prototype Pollution',
                url: 'https://github.com/advisories/GHSA-xvch-5gv4-984h',
              },
            ],
            range: '<0.2.1',
            fixAvailable: true,
          },
        },
      }),
    });

    expect(issues.some((issue) => issue.rule === 'dependency-vulnerability')).toBe(true);
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(issues.some((issue) => issue.message.includes('minimist'))).toBe(true);
    expect(issues.some((issue) => issue.suggestion?.includes('https://socket.dev/npm/package/minimist'))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports npm audit failure as a warning instead of failing the whole scan', async () => {
    const dir = path.join(fixturesDir, 'audit-failure-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'audit-failure-project', version: '1.0.0' }, null, 2),
    );

    const issues = await scanDependencies(dir, {
      npmAudit: true,
      auditRunner: async () => {
        throw new Error('npm audit unavailable');
      },
    });

    expect(issues.some((issue) => issue.rule === 'dependency-audit-unavailable')).toBe(true);
    expect(issues.some((issue) => issue.message.includes('npm audit unavailable'))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports high severity Socket.dev alerts from a provided Socket runner', async () => {
    const dir = path.join(fixturesDir, 'socket-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'socket-project',
        version: '1.0.0',
        dependencies: {
          'risky-package': '1.2.3',
          safe: '^2.0.0',
        },
      }, null, 2),
    );

    const issues = await scanDependencies(dir, {
      socketDev: true,
      socketRunner: async (_projectRoot, packages) => {
        expect(packages).toEqual(['risky-package@1.2.3', 'safe@^2.0.0']);
        return {
          packages: [
            {
              name: 'risky-package',
              version: '1.2.3',
              alerts: [
                { severity: 'critical', type: 'malware', message: 'Known malicious package behavior' },
              ],
            },
            {
              name: 'safe',
              version: '^2.0.0',
              alerts: [
                { severity: 'low', type: 'filesystemAccess', message: 'Reads local files' },
              ],
            },
          ],
        };
      },
    });

    expect(issues.some((issue) => issue.rule === 'dependency-socket-alert')).toBe(true);
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(issues.some((issue) => issue.message.includes('Known malicious package behavior'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('filesystemAccess'))).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports Socket.dev confirmation failure as a warning instead of failing the whole scan', async () => {
    const dir = path.join(fixturesDir, 'socket-failure-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'socket-failure-project',
        version: '1.0.0',
        dependencies: { leftpad: '1.0.0' },
      }, null, 2),
    );

    const issues = await scanDependencies(dir, {
      socketDev: true,
      socketRunner: async () => {
        throw new Error('socket unavailable');
      },
    });

    expect(issues.some((issue) => issue.rule === 'dependency-socket-unavailable')).toBe(true);
    expect(issues.some((issue) => issue.message.includes('socket unavailable'))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
