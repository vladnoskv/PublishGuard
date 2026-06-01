# PublishGuard for VS Code

Pre-publish safety scanner for npm packages and VS Code extensions. Catches secrets, sensitive files, and metadata issues before you publish.

## Features

- **One-click scan**: Click the shield icon in the activity bar or run `PublishGuard: Scan Project`
- **Secret detection**: Catches AWS keys, GitHub tokens, JWT, Slack webhooks, DB connection strings, and more
- **Sensitive file detection**: Warns about `.env`, `.pem`, `.key`, `.log`, source maps, and 25+ other risky patterns
- **Ignore file validation**: Checks `.npmignore`, `.vscodeignore`, `.gitignore` for missing rules and syntax errors
- **Manifest checks**: Validates `package.json` completeness (name, version, description, repository, license, publisher, icon)
- **Metadata checks**: Verifies README, LICENSE, CHANGELOG presence
- **Dependency risk checks**: Warns about floating dependency versions and non-registry sources, confirms known vulnerabilities with npm audit, and can use the Socket.dev CLI for broader supply-chain alerts
- **Optional local sweep**: Include gitignored workspace files in secret and size scans when you want to check local-only files before committing or publishing
- **Quick fixes**: Right-click issues to auto-generate ignore rules or fix manifest problems
- **Problems panel integration**: All issues show up in VS Code's Problems panel
- **Settings webview**: Manage scan-on-save, severity, ignored globs, and suppressions without editing JSON by hand

## Usage

1. Open any workspace with a `package.json`
2. PublishGuard activates automatically
3. Click the PublishGuard icon in the activity bar or press `Ctrl+Shift+P` → `PublishGuard: Scan Project`
4. Review issues in the sidebar or Problems panel
5. Use quick-fix actions to resolve issues

## Commands

| Command | Description |
|---|---|
| `PublishGuard: Scan Project` | Run a full scan on the current workspace |
| `PublishGuard: Auto-Fix Issues` | Automatically fix common issues |
| `PublishGuard: Generate Ignore Files` | Create safe `.npmignore` / `.vscodeignore` |
| `PublishGuard: Show Issues` | Focus the PublishGuard sidebar |
| `PublishGuard: Open Settings` | Open the PublishGuard settings webview |

## Settings

- `publishguard.scanOnSave` (default: `true`) — Auto-scan after saving `package.json`
- `publishguard.blockPublishOnError` (default: `true`) — Block extension publishing if errors found
- `publishguard.includeGitIgnored` (default: `false`) — Include gitignored workspace files in secret and size scans without changing publish file resolution
- `publishguard.dependencyAudit` (default: `false`) — Run npm audit during scans to confirm known vulnerable dependencies
- `publishguard.socketDev` (default: `false`) — Run Socket.dev CLI confirmation for medium, high, and critical supply-chain alerts
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

Default scans focus on files that would be published. Enable `publishguard.includeGitIgnored` for a broader local scan that also checks gitignored workspace files such as `.env`; this is useful for pre-commit reviews and does not change the package file list.

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
