import * as vscode from 'vscode';
import { generateSafeIgnoreFile } from '@publishguard/core';
import { buildProblemSuppressionActions, normalizeIssueFile } from './suppressions';

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

      const rule = String(diagnostic.code ?? '');
      const file = normalizeIssueFile(vscode.workspace.asRelativePath(document.uri, false));

      // Add to PublishGuard ignore config action
      if (rule === 'env-file' || rule === 'private-key' || rule === 'credentials-file' ||
          rule === 'log-file' || rule === 'test-data' || rule === 'source-map' ||
          rule === 'coverage' || rule === 'temp-file' || rule === 'ds-store' ||
          rule === 'windows-thumbs' || rule === 'vscode-settings') {

        const action = new vscode.CodeAction(
          `PublishGuard: Ignore ${file}`,
          vscode.CodeActionKind.QuickFix,
        );
        action.command = {
          command: 'publishguard.addToPublishGuardIgnore',
          title: 'Add to PublishGuard ignore',
          arguments: [file],
        };
        action.diagnostics = [diagnostic];
        actions.push(action);
      }

      for (const choice of buildProblemSuppressionActions(rule, file)) {
        const action = new vscode.CodeAction(choice.title, vscode.CodeActionKind.QuickFix);
        action.command = {
          command: 'publishguard.suppressDiagnostic',
          title: choice.title,
          arguments: [{
            rule,
            file,
            message: diagnostic.message,
          }, choice.scope],
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
