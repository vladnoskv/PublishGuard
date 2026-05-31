import * as vscode from 'vscode';
import type { ScanResult, Issue } from '@publishguard/core';

export class PublishGuardDiagnostics {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('publishguard');
  }

  update(result: ScanResult): void {
    this.collection.clear();

    const diagMap = new Map<string, vscode.Diagnostic[]>();

    for (const issue of result.issues) {
      const fileUri = issue.file
        ? vscode.Uri.joinPath(vscode.Uri.file(result.projectRoot), issue.file)
        : vscode.Uri.joinPath(vscode.Uri.file(result.projectRoot), 'package.json');

      const key = fileUri.fsPath;
      if (!diagMap.has(key)) {
        diagMap.set(key, []);
      }

      const severity = issue.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : issue.severity === 'warning'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

      const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        `[${issue.rule}] ${issue.message}`,
        severity,
      );

      diag.source = 'PublishGuard';
      diag.code = issue.rule;

      diagMap.get(key)!.push(diag);
    }

    for (const [fsPath, diags] of diagMap) {
      this.collection.set(vscode.Uri.file(fsPath), diags);
    }
  }

  dispose(): void {
    this.collection.dispose();
  }
}
