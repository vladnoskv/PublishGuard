# PublishGuard — VS Code Extension & CLI

**Pre-publish safety scanner for npm packages and VS Code extensions.**

Catch secrets, sensitive files, metadata issues, risky dependency specifiers, and missing ignore rules before you publish — right inside VS Code or from your CI pipeline.

<p align="center">
  <strong>Publisher: VladNoskov</strong>
</p>

## VS Code Extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/) (publisher: **VladNoskov**)
### How It Works

1. Open any workspace with a `package.json` — PublishGuard activates automatically
2. Click the shield icon in the activity bar, or press `Ctrl+Shift+P` → **PublishGuard: Scan Project**
3. Issues appear in the sidebar and Problems panel with quick-fix suggestions
4. Use the editor lightbulb, Problems quick fixes, diagnostics management menu, or PublishGuard sidebar right-click menu to ignore a warning, ignore that warning type, or exclude a noisy file/folder in `.publishguardrc.json`
5. Right-click files or folders in Explorer to add reviewed false positives to the PublishGuard ignore list without changing publish artifacts
6. Open **PublishGuard: Open Settings** to manage scan behavior, ignored globs, and reviewed false positives

### Commands

| Command | Description |
|---|---|
| `PublishGuard: Scan Project` | Full safety scan of current workspace |
| `PublishGuard: Refresh Issues` | Re-run PublishGuard using the configured scan mode |
| `PublishGuard: Refresh Diagnostics` | Re-run PublishGuard and refresh Problems diagnostics |
| `PublishGuard: Clear Diagnostics` | Clear current PublishGuard diagnostics and reset the sidebar |
| `PublishGuard: Set Severity Filter` | Choose whether Problems and sidebar findings show errors only, warnings and errors, or all findings |
| `PublishGuard: Manage Finding` | Open actions for the active PublishGuard diagnostic, including open, reveal, ignore, exclude, refresh, severity, and clear |
| `PublishGuard: Add Path to Ignore List` | Add a path or glob to `.publishguardrc.json` `ignore` |
| `PublishGuard: Quick Scan` | Fast manifest and publish-surface scan that skips source-derived capability analysis |
| `PublishGuard: Deep Scan` | Broader local scan that includes gitignored files, unpublished examples, and deeper source capability analysis |
| `PublishGuard: Auto-Fix Issues` | Automatically add missing ignore rules |
| `PublishGuard: Generate Ignore Files` | Create safe `.npmignore` / `.vscodeignore` |
| `PublishGuard: Show Issues` | Focus the PublishGuard sidebar view |
| `PublishGuard: Open Settings` | Open the PublishGuard settings webview |

### Settings

| Setting | Default | Description |
|---|---|---|
| `publishguard.scanOnSave` | `true` | Auto-scan after saving `package.json` |
| `publishguard.blockPublishOnError` | `true` | Block extension publishing if errors found |
| `publishguard.scanMode` | `full` | Default mode for manual scans: `quick`, `full`, or `deep` |
| `publishguard.includeGitIgnored` | `false` | Include gitignored workspace files in secret and size scans |
| `publishguard.severityThreshold` | `info` | Minimum severity level to report |
| `publishguard.scanGitHistoryExamples` | `true` | Default for scanning docs/examples that are present in git history |
| `publishguard.scanUnpublishedExamples` | `false` | Default for scanning unpublished docs/examples |
| `publishguard.dummySecretSeverity` | `info` | Default severity for dummy-looking secret examples |

## What It Scans

- **File listing** — Shows the exact set of files that would be published (`npm-packlist` + `vsce ls`)
- **Secret detection** — AWS keys, GitHub tokens, npm tokens, JWT, Slack webhooks, DB connection strings, private keys (PEM/SSH/PGP)
- **Sensitive file patterns** — `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials*`, `secrets*`, `*.log`, `*.map`, test fixtures, `.DS_Store`, `Thumbs.db`, and 20+ more
- **Ignore file validation** — `.npmignore`, `.vscodeignore`, `.gitignore`: checks for missing safe rules, syntax errors, dangerous negations
- **Manifest validation** — `package.json` completeness (name, version, description, repository, license, publisher, icon, engines)
- **VS Code capability checks** — Infers linter, diagnostic, language-server, SCM, formatter, testing, debugger, webview, auth, task, notebook, terminal, and web-extension behavior from manifest metadata, contribution points, and lightweight source API signals, then recommends missing recovery, lifecycle, compatibility, and security affordances
- **Metadata checks** — README, LICENSE, CHANGELOG presence
- **File size warnings** — Warns at 5 MB, errors at 50 MB per file
- **Dependency risk checks** — Warns about floating versions such as `latest` / `*` and non-registry sources such as GitHub, URL, file, link, and workspace specs. Optional npm audit, Socket.dev, and Snyk confirmations add vulnerability and supply-chain context when enabled.

## CLI (CI/CD)

```bash
npm install -g @publishguard/cli
publishguard scan                  # Pretty output
publishguard scan --quick          # Fast manifest/publish-surface scan
publishguard scan --full           # Standard scan with bounded source capability analysis
publishguard scan --deep           # Broader local/source scan
publishguard scan --json           # JSON output
publishguard scan --ci             # GitHub Actions annotations
publishguard scan --fail-on error  # Exit non-zero on errors
publishguard scan --include-gitignored # Include gitignored workspace files in secret/size scans
publishguard scan --dependency-audit # Confirm known vulnerabilities with npm audit
publishguard scan --socket-dev      # Confirm supply-chain alerts with Socket.dev CLI
publishguard scan --snyk            # Confirm dependency vulnerabilities with Snyk CLI
publishguard init                  # Generate safe ignore files
publishguard fix                   # Auto-fix common issues
publishguard fix --dry-run         # Preview fixes
```

### npm pre-publish hook

```json
{
  "scripts": {
    "prepublishOnly": "publishguard scan --fail-on warning"
  }
}
```

## Configuration

Create a `.publishguardrc.json` in your project root:

```json
{
  "rules": {
    "env-file": "error",
    "private-key": "error",
    "source-map": "warning",
    "log-file": "warning",
    "test-data": "info",
    "missing-readme": "warning",
    "missing-license": "warning",
    "jwt-token": "off"
  },
  "fileSize": {
    "warnThreshold": "5MB",
    "errorThreshold": "50MB"
  },
  "scanMode": "full",
  "dependencyAudit": {
    "enabled": false
  },
  "socketDev": {
    "enabled": false
  },
  "snyk": {
    "enabled": false
  },
  "exampleFiles": {
    "scanUnpublished": false,
    "scanGitHistory": true,
    "dummySecretSeverity": "info",
    "patterns": ["docs/**", "examples/**", "samples/**"]
  },
  "ignore": ["**/fixtures/**"],
  "suppressions": [
    {
      "rule": "jwt-token",
      "file": "test/fixtures/**",
      "reason": "Reviewed test fixture; not a real token"
    }
  ]
}
```

Use `ignore` for file globs you never want PublishGuard to scan or report. Use `suppressions` for reviewed false positives; each suppression must include a reason and can match by `rule`, `file`, and/or `fingerprint`. Ignore-rule changes are applied to future scans; run a new scan when you want the sidebar and Problems panel to reflect them.

### Scan Modes

PublishGuard supports three scan modes:

| Mode | Purpose | Behavior |
|---|---|---|
| `quick` | Fast feedback on save or before small edits | Checks manifest, publish file lists, ignore rules, dependencies, published-file secrets, and manifest-only VS Code capability signals. Skips source-derived capability analysis. |
| `full` | Default manual/CI scan | Runs the normal publish-surface scan plus bounded source-derived VS Code capability analysis in common source folders. |
| `deep` | Broad local review before release | Runs full checks with wider source analysis, includes gitignored local files in content scans, and scans unpublished docs/examples. External npm audit, Socket.dev, and Snyk checks still remain opt-in. |

By default, secret and size checks follow the publish artifact list so local-only files do not create noise. Use `publishguard scan --include-gitignored` or enable `publishguard.includeGitIgnored` in VS Code when you want a broader local sweep that also checks gitignored workspace files such as `.env` files. This does not change the files that npm or VS Code would publish.

Docs and example files are quiet by default unless they are part of the publish artifact or have already appeared in git history. `exampleFiles.scanUnpublished` opts into scanning all matching docs/examples, and `dummySecretSeverity` lets you downgrade or turn off dummy-looking secrets such as fake keys in samples.

Dependency audits are opt-in because they can contact the npm registry and take longer than local checks. Enable them with `publishguard scan --dependency-audit`, set `dependencyAudit.enabled` in `.publishguardrc.json`, or turn on **Run npm audit to confirm vulnerable dependencies** in the VS Code settings webview.

Socket.dev confirmation is also opt-in and requires the Socket CLI to be installed and configured. Enable it with `publishguard scan --socket-dev`, set `socketDev.enabled`, or turn on **Run Socket.dev CLI confirmation for supply-chain alerts** in the settings webview. PublishGuard reports medium, high, and critical Socket alerts while ignoring low-severity alerts by default to reduce noise.

Snyk confirmation is opt-in and requires the Snyk CLI to be installed and authenticated. Enable it with `publishguard scan --snyk`, set `snyk.enabled`, or turn on **Run Snyk CLI confirmation for dependency vulnerabilities** in the settings webview. PublishGuard reports medium, high, and critical Snyk vulnerabilities while ignoring low-severity vulnerabilities by default to reduce noise.

## VS Code Capability Checks

PublishGuard now analyzes VS Code extension manifests and lightweight source API signals for capability-specific operational gaps. It looks at `categories`, `keywords`, `description`, `activationEvents`, `extensionKind`, `browser`, `contributes`, and common VS Code API usage such as `createDiagnosticCollection`, `LanguageClient`, `createSourceControl`, `registerTaskProvider`, `registerAuthenticationProvider`, `createWebviewPanel`, and `webview.html`.

Critical provider gaps are errors by default because they can leave users with stale Problems, stale language-server state, stale source-control state, or broken web-extension compatibility and no extension-owned way to recover. Advisory matches stay as warnings when the signal is keyword-only or when the missing command is useful but not critical. As with other PublishGuard rules, these findings can be downgraded, disabled, or suppressed in `.publishguardrc.json` after review.

Examples of commands PublishGuard expects for provider-like extensions:

| Capability | Recommended command affordance |
|---|---|
| Diagnostics / linters | Refresh diagnostics, restart provider, rescan project, recompute Problems, or clear the extension's own diagnostics |
| Language servers | Restart language server, reload language server, reconnect server, or reindex workspace |
| SCM providers | Refresh source control, sync repository, rescan repository, or reconnect repository |
| Test providers | Refresh tests, rediscover tests, or reload coverage |
| Formatters | Format or open formatter settings when formatter-specific behavior is user-triggered |
| Debuggers | Launch, attach, debug, or open debug configuration |
| Custom views / webviews | Refresh view, reveal current item, reload preview, reset view state, and include a webview Content Security Policy when assigning HTML |
| Authentication providers | Sign in, sign out, manage account, clear session, or refresh session |
| Task providers | Run task, refresh tasks, rediscover tasks, or reload task definitions |
| Notebook providers | Open notebook, reload notebook, export notebook, reset notebook state, or open notebook settings |
| Terminal providers | Open terminal, start profile, connect, reconnect, or manage terminal profiles |
| Web extensions | Avoid Node-only APIs in web entrypoints, or split desktop and browser entrypoints |

PublishGuard also warns when an extension targets VS Code versions before 1.74 and contributes commands without matching `onCommand:<commandId>` activation events, because automatic command activation only applies to VS Code 1.74 and newer.

## Packages

| Package | Description | Registry |
|---|---|---|
| `publishguard` | VS Code extension (publisher: **VladNoskov**) | VS Code Marketplace |
| `@publishguard/cli` | CLI tool | npm |
| `@publishguard/core` | Shared scanning engine | npm |

## Related Tools

| Tool | Purpose |
|---|---|
| **i18ntk** | Zero-dependency i18n toolkit for scanning, validation, translation, reports, and runtime loading. |
| **i18ntk Workbench** | Full VS Code localization health dashboard powered by i18ntk. |
| **i18ntk Lens** | Lightweight inline translation hovers, diagnostics, and key navigation. |
| **PublishGuard** | Pre-publish safety scanner for npm packages and VS Code extensions. |
| **ContextKit** | AI coding context manager for AGENTS.md, Claude, Cursor, Copilot, Roo, and Codex files. |

## License

MIT
