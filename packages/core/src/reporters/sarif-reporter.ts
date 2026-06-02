import type { ScanResult } from '../types';

export function generateSarifReport(result: ScanResult): string {
  const rules = new Map<string, { id: string; shortDescription: { text: string } }>();
  const results: unknown[] = [];

  for (const issue of result.issues) {
    if (!rules.has(issue.rule)) {
      rules.set(issue.rule, {
        id: issue.rule,
        shortDescription: { text: issue.message },
      });
    }
    results.push({
      ruleId: issue.rule,
      level: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'note',
      message: { text: issue.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: issue.file || 'project' },
            region: { startLine: 1 },
          },
        },
      ],
    });
  }

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'PublishGuard',
            version: '0.4.1',
            rules: Array.from(rules.values()),
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
