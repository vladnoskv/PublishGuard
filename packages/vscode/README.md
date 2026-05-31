# PublishGuard for VS Code

Pre-publish safety scanner for npm packages and VS Code extensions. Catches secrets, sensitive files, and metadata issues before you publish.

## Features

- **One-click scan**: Click the shield icon in the activity bar or run `PublishGuard: Scan Project`
- **Secret detection**: Catches AWS keys, GitHub tokens, JWT, Slack webhooks, DB connection strings, and more
- **Sensitive file detection**: Warns about `.env`, `.pem`, `.key`, `.log`, source maps, and 25+ other risky patterns
- **Ignore file validation**: Checks `.npmignore`, `.vscodeignore`, `.gitignore` for missing rules and syntax errors
- **Manifest checks**: Validates `package.json` completeness (name, version, description, repository, license, publisher, icon)
- **Metadata checks**: Verifies README, LICENSE, CHANGELOG presence
- **Quick fixes**: Right-click issues to auto-generate ignore rules or fix manifest problems
- **Problems panel integration**: All issues show up in VS Code's Problems panel
- **Auto-scan on save**: Re-scans automatically when you save `package.json`

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

## Settings

- `publishguard.scanOnSave` (default: `true`) — Auto-scan after saving `package.json`
- `publishguard.blockPublishOnError` (default: `true`) — Block extension publishing if errors found
- `publishguard.severityThreshold` (default: `info`) — Minimum severity to report

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
