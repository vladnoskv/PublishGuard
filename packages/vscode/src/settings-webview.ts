import type { Severity } from '@publishguard/core';

export interface SettingsWebviewState {
  nonce: string;
  scanOnSave: boolean;
  blockPublishOnError: boolean;
  dependencyAudit: boolean;
  socketDev: boolean;
  severityThreshold: Severity;
  ignore: string[];
  suppressions: Array<{ rule?: string; file?: string; fingerprint?: string; reason: string }>;
}

export function buildSettingsWebviewHtml(state: SettingsWebviewState): string {
  const ignoreText = state.ignore.join('\n');
  const suppressionsText = JSON.stringify(state.suppressions, null, 2);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${escapeHtml(state.nonce)}';">
  <title>PublishGuard Settings</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 24px; }
    main { max-width: 840px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    p { color: var(--vscode-descriptionForeground); line-height: 1.5; margin: 0 0 14px; }
    label { display: block; margin: 12px 0 6px; font-weight: 600; }
    .row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
    .row label { margin: 0; font-weight: 400; }
    textarea, select { box-sizing: border-box; width: 100%; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); padding: 8px; }
    textarea { min-height: 120px; font-family: var(--vscode-editor-font-family); }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 8px 12px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .actions { display: flex; gap: 8px; margin-top: 18px; }
    .hint { font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>PublishGuard Settings</h1>
    <p>Control how PublishGuard scans your package before publishing.</p>

    <h2>Scanning</h2>
    <div class="row">
      <input id="scanOnSave" name="scanOnSave" type="checkbox"${state.scanOnSave ? ' checked' : ''}>
      <label for="scanOnSave">Scan when package or ignore files are saved</label>
    </div>
    <div class="row">
      <input id="blockPublishOnError" name="blockPublishOnError" type="checkbox"${state.blockPublishOnError ? ' checked' : ''}>
      <label for="blockPublishOnError">Treat error findings as publish blockers</label>
    </div>
    <div class="row">
      <input id="dependencyAudit" name="dependencyAudit" type="checkbox"${state.dependencyAudit ? ' checked' : ''}>
      <label for="dependencyAudit">Run npm audit to confirm vulnerable dependencies</label>
    </div>
    <div class="row">
      <input id="socketDev" name="socketDev" type="checkbox"${state.socketDev ? ' checked' : ''}>
      <label for="socketDev">Run Socket.dev CLI confirmation for supply-chain alerts</label>
    </div>
    <label for="severityThreshold">Minimum severity shown in VS Code</label>
    <select id="severityThreshold" name="severityThreshold">
      ${severityOption('error', state.severityThreshold)}
      ${severityOption('warning', state.severityThreshold)}
      ${severityOption('info', state.severityThreshold)}
    </select>

    <h2>Whitelist and Ignore</h2>
    <label for="ignore">Ignored file globs</label>
    <textarea id="ignore" name="ignore" spellcheck="false">${escapeHtml(ignoreText)}</textarea>
    <p class="hint">One glob per line, for example <code>fixtures/**</code>. These files are skipped before issues are reported.</p>

    <label for="suppressions">Issue suppressions</label>
    <textarea id="suppressions" name="suppressions" spellcheck="false">${escapeHtml(suppressionsText)}</textarea>
    <p class="hint">Use suppressions for reviewed false positives. Each entry needs a reason.</p>

    <div class="actions">
      <button type="button" data-command="saveSettings">Save Settings</button>
      <button type="button" data-command="runScan">Save and Scan</button>
    </div>
  </main>
  <script nonce="${escapeHtml(state.nonce)}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-command]').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({
          command: button.dataset.command,
          scanOnSave: document.querySelector('[name="scanOnSave"]').checked,
          blockPublishOnError: document.querySelector('[name="blockPublishOnError"]').checked,
          dependencyAudit: document.querySelector('[name="dependencyAudit"]').checked,
          socketDev: document.querySelector('[name="socketDev"]').checked,
          severityThreshold: document.querySelector('[name="severityThreshold"]').value,
          ignore: document.querySelector('[name="ignore"]').value,
          suppressions: document.querySelector('[name="suppressions"]').value
        });
      });
    });
  </script>
</body>
</html>`;
}

function severityOption(value: Severity, selected: Severity): string {
  return `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
