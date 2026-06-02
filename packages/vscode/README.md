# PublishGuard for VS Code

Pre-publish safety scanner for npm packages and VS Code extensions. Catches secrets, sensitive files, and metadata issues before you publish.

## Features

- **One-click scan**: Click the shield icon in the activity bar or run `PublishGuard: Scan Project`
- **Secret detection**: Catches AWS keys, GitHub tokens, JWT, Slack webhooks, DB connection strings, and more
- **Sensitive file detection**: Warns about `.env`, `.pem`, `.key`, `.log`, source maps, and 25+ other risky patterns
- **Ignore file validation**: Checks `.npmignore`, `.vscodeignore`, `.gitignore` for missing rules and syntax errors
- **Manifest checks**: Validates `package.json` completeness (name, version, description, repository, license, publisher, icon)
- **VS Code capability checks**: Infers linter, diagnostic, language-server, SCM, formatter, testing, debugger, webview, auth, task, notebook, terminal, and web-extension behavior from manifest metadata plus lightweight source API signals, then warns when expected recovery, lifecycle, compatibility, or webview security affordances are missing
- **Metadata checks**: Verifies README, LICENSE, CHANGELOG presence
- **Dependency risk checks**: Warns about floating dependency versions and non-registry sources, confirms known vulnerabilities with npm audit, and can use Socket.dev or Snyk CLI checks for broader dependency risk context
- **Optional local sweep**: Include gitignored workspace files in secret and size scans when you want to check local-only files before committing or publishing
- **Quick fixes**: Use the editor lightbulb, Problems panel, or PublishGuard sidebar right-click menu to resolve or ignore findings
- **False-positive controls**: Ignore this warning, ignore this type of warning, ignore a rule in one file or folder, ignore all findings in a file or folder, or exclude noisy files and folders from PublishGuard scans
- **Problems panel integration**: All issues show up in VS Code's Problems panel
- **Settings webview**: Manage scan-on-save, scanner toggles, rule severities, ignored globs, and suppressions without editing JSON by hand

## Usage

1. Open any workspace with a `package.json`
2. PublishGuard activates automatically
3. Click the PublishGuard icon in the activity bar or press `Ctrl+Shift+P` → `PublishGuard: Scan Project`
4. Review issues in the sidebar or Problems panel
5. Use quick-fix actions or right-click an issue to resolve it, ignore reviewed false positives, or exclude noisy files and folders

## Commands

| Command | Description |
|---|---|
| `PublishGuard: Scan Project` | Run a full scan on the current workspace |
| `PublishGuard: Refresh Issues` | Quickly recompute PublishGuard diagnostics and sidebar findings |
| `PublishGuard: Quick Scan` | Run a fast scan for save-time feedback |
| `PublishGuard: Deep Scan` | Run a broader local/source scan before release |
| `PublishGuard: Auto-Fix Issues` | Automatically fix common issues |
| `PublishGuard: Generate Ignore Files` | Create safe `.npmignore` / `.vscodeignore` |
| `PublishGuard: Show Issues` | Focus the PublishGuard sidebar |
| `PublishGuard: Open Settings` | Open the PublishGuard settings webview |

## Settings

- `publishguard.scanOnSave` (default: `true`) — Auto-scan after saving `package.json`
- `publishguard.blockPublishOnError` (default: `true`) — Block extension publishing if errors found
- `publishguard.scanMode` (default: `full`) — Default manual scan mode: `quick`, `full`, or `deep`
- `publishguard.includeGitIgnored` (default: `false`) — Include gitignored workspace files in secret and size scans without changing publish file resolution
- `publishguard.dependencyAudit` (default: `false`) — Run npm audit during scans to confirm known vulnerable dependencies
- `publishguard.socketDev` (default: `false`) — Run Socket.dev CLI confirmation for medium, high, and critical supply-chain alerts
- `publishguard.snyk` (default: `false`) — Run Snyk CLI confirmation for medium, high, and critical dependency vulnerabilities
- `publishguard.severityThreshold` (default: `info`) — Minimum severity to report

Project-level ignore globs and reviewed false positives are stored in `.publishguardrc.json`:

```json
{
  "dependencyAudit": {
    "enabled": false
  },
  "socketDev": {
    "enabled": false
  },
  "snyk": {
    "enabled": false
  },
  "ignore": ["fixtures/**"],
  "suppressions": [
    {
      "rule": "jwt-token",
      "file": "fixtures/**",
      "reason": "Reviewed test fixture"
    }
  ]
}
```

Right-click findings in the PublishGuard sidebar, use the editor lightbulb, or use quick-fix actions in VS Code Problems to add reviewed suppressions without editing JSON. Suppressions can target an exact finding, one rule in a file, all issues in a file, one rule in a folder, all issues in a folder, or one rule project-wide. Exclusion actions add file or folder globs to `.publishguardrc.json` `ignore`, not `.npmignore`, so they only quiet PublishGuard findings and do not change what your package publishes.

The settings page writes rule toggles, ignored globs, suppressions, dependency-audit settings, Socket.dev settings, Snyk settings, and docs/example policy into `.publishguardrc.json`. Use **Save and Scan** to persist the page and immediately rerun PublishGuard.

Snyk confirmation is opt-in and requires the Snyk CLI to be installed and authenticated. If Snyk cannot run, PublishGuard reports a warning instead of failing the whole scan.

Default scans focus on files that would be published. Enable `publishguard.includeGitIgnored` for a broader local scan that also checks gitignored workspace files such as `.env`; this is useful for pre-commit reviews and does not change the package file list.

Use quick scans for fast save-time feedback, full scans for normal manual review, and deep scans before release when you want broader local/source analysis. Deep scans include gitignored local files and unpublished docs/examples, but external npm audit, Socket.dev, and Snyk checks remain opt-in.

## CLI Companion

PublishGuard also ships as a CLI tool for CI/CD pipelines:

```bash
npm install -g @publishguard/cli
publishguard scan
publishguard init
publishguard fix
```

## License

MIT
