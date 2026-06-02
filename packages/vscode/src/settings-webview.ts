import type { ExampleFilesConfig, PublishGuardConfig, ScanMode, Severity } from '@publishguard/core';

export type RuleSettingValue = PublishGuardConfig['rules'][string];

export interface SettingsWebviewState {
  nonce: string;
  scanOnSave: boolean;
  blockPublishOnError: boolean;
  includeGitIgnored: boolean;
  dependencyAudit: boolean;
  socketDev: boolean;
  snyk: boolean;
  scanMode: ScanMode;
  severityThreshold: Severity;
  ignore: string[];
  suppressions: Array<{ rule?: string; file?: string; fingerprint?: string; reason: string }>;
  rules: Record<string, RuleSettingValue>;
  exampleFiles: ExampleFilesConfig;
}

const SEVERITIES: Array<Severity | 'off'> = ['error', 'warning', 'info', 'off'];

export function buildSettingsWebviewHtml(state: SettingsWebviewState): string {
  const ignoreText = state.ignore.join('\n');
  const examplePatternText = state.exampleFiles.patterns.join('\n');
  const ruleRows = Object.entries(state.rules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rule, value]) => renderRuleRow(rule, value))
    .join('');
  const suppressionRows = state.suppressions.length > 0
    ? state.suppressions.map(renderSuppressionRow).join('')
    : renderSuppressionRow({ reason: '' });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${escapeHtml(state.nonce)}';">
  <title>PublishGuard Settings</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; }
    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    a:hover { text-decoration: underline; }
    main { display: grid; grid-template-columns: minmax(160px, 220px) minmax(0, 1fr); min-height: 100vh; }
    nav { border-right: 1px solid var(--vscode-panel-border); padding: 18px 14px; position: sticky; top: 0; align-self: start; height: 100vh; }
    nav h1 { font-size: 18px; margin: 0 0 16px; }
    nav a { display: block; padding: 7px 8px; border-radius: 4px; color: var(--vscode-foreground); }
    .content { max-width: 980px; padding: 24px; }
    section { border-bottom: 1px solid var(--vscode-panel-border); padding: 0 0 24px; margin: 0 0 24px; }
    h2 { font-size: 18px; margin: 0 0 8px; }
    h3 { font-size: 14px; margin: 18px 0 8px; }
    p { color: var(--vscode-descriptionForeground); line-height: 1.5; margin: 0 0 14px; }
    label { display: block; margin: 12px 0 6px; font-weight: 600; }
    .row { display: flex; align-items: flex-start; gap: 10px; margin: 10px 0; }
    .row label { margin: 0; font-weight: 400; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    textarea, input[type="text"], select { width: 100%; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); padding: 8px; border-radius: 3px; }
    textarea { min-height: 96px; font-family: var(--vscode-editor-font-family); }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 8px 12px; cursor: pointer; border-radius: 3px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; position: sticky; bottom: 0; background: var(--vscode-editor-background); padding: 12px 0; }
    .hint { font-size: 12px; }
    .status { color: var(--vscode-descriptionForeground); font-size: 12px; min-height: 18px; padding-left: 4px; }
    .rule-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; }
    .rule-row, .suppression-row { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 10px; background: var(--vscode-sideBar-background); }
    .rule-row { display: grid; grid-template-columns: minmax(0, 1fr) 105px; gap: 8px; align-items: center; }
    .rule-name { overflow-wrap: anywhere; font-family: var(--vscode-editor-font-family); font-size: 12px; }
    .suppression-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 8px 0; }
    .suppression-row label { margin: 0; font-size: 12px; }
    .full { grid-column: 1 / -1; }
    @media (max-width: 720px) {
      main { display: block; }
      nav { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--vscode-panel-border); }
      .content { padding: 18px; }
      .suppression-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <nav aria-label="Settings sections">
      <h1>PublishGuard</h1>
      <a href="#scan-settings">Scanning</a>
      <a href="#example-settings">Docs and examples</a>
      <a href="#ignore-settings">Ignore and whitelist</a>
      <a href="#rule-settings">Rule toggles</a>
    </nav>
    <div class="content">
      <section id="scan-settings">
        <h2>Scanning</h2>
        <p>Control when PublishGuard runs and which confirmation scanners are used.</p>
        <div class="row">
          <input id="scanOnSave" name="scanOnSave" type="checkbox"${state.scanOnSave ? ' checked' : ''}>
          <label for="scanOnSave">Scan when package.json is saved</label>
        </div>
        <div class="row">
          <input id="blockPublishOnError" name="blockPublishOnError" type="checkbox"${state.blockPublishOnError ? ' checked' : ''}>
          <label for="blockPublishOnError">Treat error findings as publish blockers</label>
        </div>
        <div class="row">
          <input id="includeGitIgnored" name="includeGitIgnored" type="checkbox"${state.includeGitIgnored ? ' checked' : ''}>
          <label for="includeGitIgnored">Include gitignored workspace files in secret and size scans</label>
        </div>
        <label for="scanMode">Default scan mode</label>
        <select id="scanMode" name="scanMode">
          ${scanModeOption('quick', state.scanMode)}
          ${scanModeOption('full', state.scanMode)}
          ${scanModeOption('deep', state.scanMode)}
        </select>
        <p class="hint">Quick skips source-derived capability analysis, full uses bounded source analysis, and deep broadens local/source coverage.</p>
        <div class="row">
          <input id="dependencyAudit" name="dependencyAudit" type="checkbox"${state.dependencyAudit ? ' checked' : ''}>
          <label for="dependencyAudit">Run npm audit to confirm vulnerable dependencies</label>
        </div>
        <div class="row">
          <input id="socketDev" name="socketDev" type="checkbox"${state.socketDev ? ' checked' : ''}>
          <label for="socketDev">Run Socket.dev CLI confirmation for supply-chain alerts</label>
        </div>
        <div class="row">
          <input id="snyk" name="snyk" type="checkbox"${state.snyk ? ' checked' : ''}>
          <label for="snyk">Run Snyk CLI confirmation for dependency vulnerabilities</label>
        </div>
        <label for="severityThreshold">Minimum severity shown in VS Code</label>
        <select id="severityThreshold" name="severityThreshold">
          ${severityOption('error', state.severityThreshold)}
          ${severityOption('warning', state.severityThreshold)}
          ${severityOption('info', state.severityThreshold)}
        </select>
      </section>

      <section id="example-settings">
        <h2>Docs and examples</h2>
        <p>Reduce noise from documented dummy values while still checking examples that are published or already committed.</p>
        <div class="row">
          <input id="exampleScanGitHistory" name="exampleScanGitHistory" type="checkbox"${state.exampleFiles.scanGitHistory ? ' checked' : ''}>
          <label for="exampleScanGitHistory">Scan docs and examples that are present in git history</label>
        </div>
        <div class="row">
          <input id="exampleScanUnpublished" name="exampleScanUnpublished" type="checkbox"${state.exampleFiles.scanUnpublished ? ' checked' : ''}>
          <label for="exampleScanUnpublished">Also scan unpublished docs and examples</label>
        </div>
        <label for="dummySecretSeverity">Dummy secret findings in docs/examples</label>
        <select id="dummySecretSeverity" name="dummySecretSeverity">
          ${severityOption('off', state.exampleFiles.dummySecretSeverity)}
          ${severityOption('info', state.exampleFiles.dummySecretSeverity)}
          ${severityOption('warning', state.exampleFiles.dummySecretSeverity)}
          ${severityOption('error', state.exampleFiles.dummySecretSeverity)}
        </select>
        <label for="examplePatterns">Docs/example file globs</label>
        <textarea id="examplePatterns" name="examplePatterns" spellcheck="false">${escapeHtml(examplePatternText)}</textarea>
      </section>

      <section id="ignore-settings">
        <h2>Ignore and whitelist</h2>
        <label for="ignore">Ignored file globs</label>
        <textarea id="ignore" name="ignore" spellcheck="false">${escapeHtml(ignoreText)}</textarea>
        <p class="hint">One glob per line. Ignored files are skipped before issues are reported.</p>

        <h3>Ignored problems</h3>
        <p>Use these rows for reviewed false positives. Fingerprint is most precise; rule plus file glob is useful for recurring examples.</p>
        <div id="suppressions">${suppressionRows}</div>
        <button type="button" class="secondary" data-command="addSuppression">Add ignored problem</button>
      </section>

      <section id="rule-settings">
        <h2>Rule toggles</h2>
        <p>Set a rule to off to disable it, or choose the severity that should be reported.</p>
        <div class="rule-list">${ruleRows}</div>
      </section>

      <div class="actions">
        <button type="button" data-command="saveSettings">Save Settings</button>
        <button type="button" data-command="runScan">Save and Scan</button>
        <span id="settingsStatus" class="status" role="status" aria-live="polite"></span>
      </div>
    </div>
  </main>
  <template id="suppressionTemplate">
    ${renderSuppressionRow({ reason: '' })}
  </template>
  <script nonce="${escapeHtml(state.nonce)}">
    const vscode = acquireVsCodeApi();
    const suppressionContainer = document.getElementById('suppressions');
    const suppressionTemplate = document.getElementById('suppressionTemplate');
    const settingsStatus = document.getElementById('settingsStatus');

    function setStatus(message) {
      settingsStatus.textContent = message;
    }

    function field(name) {
      return document.querySelector('[name="' + name + '"]');
    }

    document.querySelector('[data-command="addSuppression"]').addEventListener('click', () => {
      suppressionContainer.insertAdjacentHTML('beforeend', suppressionTemplate.innerHTML);
      setStatus('Added an ignored problem row.');
    });

    function lines(name) {
      const input = field(name);
      return (input ? input.value : '')
        .split(/\\r?\\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    function collectSuppressions() {
      return Array.from(document.querySelectorAll('[data-suppression-row]'))
        .map((row) => ({
          rule: row.querySelector('[name="suppressionRule"]').value.trim(),
          file: row.querySelector('[name="suppressionFile"]').value.trim(),
          fingerprint: row.querySelector('[name="suppressionFingerprint"]').value.trim(),
          reason: row.querySelector('[name="suppressionReason"]').value.trim()
        }))
        .filter((item) => item.reason || item.rule || item.file || item.fingerprint)
        .map((item) => {
          const clean = { reason: item.reason };
          if (item.rule) clean.rule = item.rule;
          if (item.file) clean.file = item.file;
          if (item.fingerprint) clean.fingerprint = item.fingerprint;
          return clean;
        });
    }

    function collectRules() {
      const rules = {};
      document.querySelectorAll('[data-rule]').forEach((row) => {
        const select = row.querySelector('[name="ruleSeverity"]');
        if (row.dataset.rule && select) {
          rules[row.dataset.rule] = select.value;
        }
      });
      return rules;
    }

    document.querySelectorAll('button[data-command="saveSettings"], button[data-command="runScan"]').forEach((button) => {
      button.addEventListener('click', () => {
        setStatus(button.dataset.command === 'runScan' ? 'Saving settings and starting scan...' : 'Saving settings...');
        vscode.postMessage({
          command: button.dataset.command,
          scanOnSave: field('scanOnSave').checked,
          blockPublishOnError: field('blockPublishOnError').checked,
          includeGitIgnored: field('includeGitIgnored').checked,
          dependencyAudit: field('dependencyAudit').checked,
          socketDev: field('socketDev').checked,
          snyk: field('snyk').checked,
          scanMode: field('scanMode').value,
          severityThreshold: field('severityThreshold').value,
          ignore: lines('ignore'),
          suppressions: collectSuppressions(),
          rules: collectRules(),
          exampleFiles: {
            scanGitHistory: field('exampleScanGitHistory').checked,
            scanUnpublished: field('exampleScanUnpublished').checked,
            dummySecretSeverity: field('dummySecretSeverity').value,
            patterns: lines('examplePatterns')
          }
        });
      });
    });
  </script>
</body>
</html>`;
}

function renderRuleRow(rule: string, value: RuleSettingValue): string {
  const severity = normalizeRuleValue(value);
  return `<div class="rule-row" data-rule="${escapeHtml(rule)}">
    <div class="rule-name">${escapeHtml(rule)}</div>
    <select name="ruleSeverity" aria-label="${escapeHtml(rule)} severity">
      ${SEVERITIES.map((candidate) => severityOption(candidate, severity)).join('')}
    </select>
  </div>`;
}

function renderSuppressionRow(value: { rule?: string; file?: string; fingerprint?: string; reason: string }): string {
  return `<div class="suppression-row" data-suppression-row>
    <label>Rule<input name="suppressionRule" type="text" value="${escapeAttribute(value.rule ?? '')}" placeholder="aws-access-key"></label>
    <label>File glob<input name="suppressionFile" type="text" value="${escapeAttribute(value.file ?? '')}" placeholder="docs/**"></label>
    <label class="full">Fingerprint<input name="suppressionFingerprint" type="text" value="${escapeAttribute(value.fingerprint ?? '')}" placeholder="rule:file:line:column"></label>
    <label class="full">Reason<input name="suppressionReason" type="text" value="${escapeAttribute(value.reason)}" placeholder="Reviewed false positive"></label>
  </div>`;
}

function normalizeRuleValue(value: RuleSettingValue): Severity | 'off' {
  if (Array.isArray(value)) return value[0];
  return value;
}

function severityOption(value: Severity | 'off', selected: Severity | 'off'): string {
  return `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`;
}

function scanModeOption(value: ScanMode, selected: ScanMode): string {
  return `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`;
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
