# PublishGuard — VS Code Extension & CLI

**Pre-publish safety scanner for npm packages and VS Code extensions.**

Catch secrets, sensitive files, metadata issues, and missing ignore rules before you publish — right inside VS Code or from your CI pipeline.

<p align="center">
  <strong>Publisher: VladNoskov</strong>
</p>

## VS Code Extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/) (publisher: **VladNoskov**) or side-load the `.vsix`:

```bash
code --install-extension publishguard-0.1.0.vsix
```

### How It Works

1. Open any workspace with a `package.json` — PublishGuard activates automatically
2. Click the shield icon in the activity bar, or press `Ctrl+Shift+P` → **PublishGuard: Scan Project**
3. Issues appear in the sidebar and Problems panel with quick-fix suggestions
4. The extension auto-scans whenever you save `package.json`

### Commands

| Command | Description |
|---|---|
| `PublishGuard: Scan Project` | Full safety scan of current workspace |
| `PublishGuard: Auto-Fix Issues` | Automatically add missing ignore rules |
| `PublishGuard: Generate Ignore Files` | Create safe `.npmignore` / `.vscodeignore` |
| `PublishGuard: Show Issues` | Focus the PublishGuard sidebar view |

### Settings

| Setting | Default | Description |
|---|---|---|
| `publishguard.scanOnSave` | `true` | Auto-scan after saving `package.json` |
| `publishguard.blockPublishOnError` | `true` | Block extension publishing if errors found |
| `publishguard.severityThreshold` | `info` | Minimum severity level to report |

## What It Scans

- **File listing** — Shows the exact set of files that would be published (`npm-packlist` + `vsce ls`)
- **Secret detection** — AWS keys, GitHub tokens, npm tokens, JWT, Slack webhooks, DB connection strings, private keys (PEM/SSH/PGP)
- **Sensitive file patterns** — `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials*`, `secrets*`, `*.log`, `*.map`, test fixtures, `.DS_Store`, `Thumbs.db`, and 20+ more
- **Ignore file validation** — `.npmignore`, `.vscodeignore`, `.gitignore`: checks for missing safe rules, syntax errors, dangerous negations
- **Manifest validation** — `package.json` completeness (name, version, description, repository, license, publisher, icon, engines)
- **Metadata checks** — README, LICENSE, CHANGELOG presence
- **File size warnings** — Warns at 5 MB, errors at 50 MB per file

## CLI (CI/CD)

```bash
npm install -g @publishguard/cli
publishguard scan                  # Pretty output
publishguard scan --json           # JSON output
publishguard scan --ci             # GitHub Actions annotations
publishguard scan --fail-on error  # Exit non-zero on errors
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
    "no-env-files": "error",
    "no-private-keys": "error",
    "no-source-maps": "warning",
    "no-log-files": "warning",
    "no-test-data": "info",
    "require-readme": "warning",
    "require-license": "warning"
  },
  "fileSize": {
    "warnThreshold": "5MB",
    "errorThreshold": "50MB"
  },
  "ignore": ["**/fixtures/**"]
}
```

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
