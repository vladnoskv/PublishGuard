import type { ScanResult, Issue } from '@publishguard/core';

export function printCIOutput(result: ScanResult): void {
  for (const issue of result.issues) {
    const annotation = mapSeverityToAnnotation(issue.severity);
    const file = issue.file || result.projectRoot;
    const line = 1;
    console.log(`::${annotation} file=${file},line=${line},title=${issue.rule}::${issue.message}`);
  }
}

function mapSeverityToAnnotation(severity: Issue['severity']): string {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'notice';
    default:
      return 'warning';
  }
}
