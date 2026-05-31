import type { ScanResult } from '@publishguard/core';

export function printJsonOutput(result: ScanResult): void {
  console.log(JSON.stringify(result, null, 2));
}
