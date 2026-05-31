import * as vscode from 'vscode';
import * as path from 'node:path';
import { generateSafeIgnoreFile } from '@publishguard/core';

export class PublishGuardQuickFix implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'PublishGuard') continue;

      const rule = diagnostic.code as string;

      // Add to ignore file action
      if (rule === 'env-file' || rule === 'private-key' || rule === 'credentials-file' ||
          rule === 'log-file' || rule === 'test-data' || rule === 'source-map' ||
          rule === 'coverage' || rule === 'temp-file' || rule === 'ds-store' ||
          rule === 'windows-thumbs' || rule === 'vscode-settings') {

        const fileName = path.basename(document.fileName);
        const action = new vscode.CodeAction(
          `Add "${fileName}" to .npmignore`,
          vscode.CodeActionKind.QuickFix,
        );
        action.command = {
          command: 'publishguard.addToNpmignore',
          title: 'Add to .npmignore',
          arguments: [document.fileName],
        };
        action.diagnostics = [diagnostic];
        actions.push(action);
      }

      // Generate ignore file action
      if (rule === 'missing-ignore-file') {
        const action = new vscode.CodeAction(
          'Generate safe .npmignore',
          vscode.CodeActionKind.QuickFix,
        );
        action.command = {
          command: 'publishguard.init',
          title: 'Generate ignore files',
        };
        action.diagnostics = [diagnostic];
        actions.push(action);
      }
    }

    return actions;
  }
}
