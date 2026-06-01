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
4. Open **PublishGuard: Open Settings** to manage scan behavior, ignored globs, and reviewed false positives

### Commands

| Command | Description |
|---|---|
| `PublishGuard: Scan Project` | Full safety scan of current workspace |
| `PublishGuard: Auto-Fix Issues` | Automatically add missing ignore rules |
| `PublishGuard: Generate Ignore Files` | Create safe `.npmignore` / `.vscodeignore` |
| `PublishGuard: Show Issues` | Focus the PublishGuard sidebar view |
| `PublishGuard: Open Settings` | Open the PublishGuard settings webview |

### Settings

| Setting | Default | Description |
|---|---|---|
| `publishguard.scanOnSave` | `true` | Auto-scan after saving `package.json` |
| `publishguard.blockPublishOnError` | `true` | Block extension publishing if errors found |
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
- **Metadata checks** — README, LICENSE, CHANGELOG presence
- **File size warnings** — Warns at 5 MB, errors at 50 MB per file
- **Dependency risk checks** — Warns about floating versions such as `latest` / `*` and non-registry sources such as GitHub, URL, file, link, and workspace specs. Suggestions include Socket.dev package links for confirmation and extra supply-chain context.

## CLI (CI/CD)

```bash
npm install -g @publishguard/cli
publishguard scan                  # Pretty output
publishguard scan --json           # JSON output
publishguard scan --ci             # GitHub Actions annotations
publishguard scan --fail-on error  # Exit non-zero on errors
publishguard scan --include-gitignored # Include gitignored workspace files in secret/size scans
publishguard scan --dependency-audit # Confirm known vulnerabilities with npm audit
publishguard scan --socket-dev      # Confirm supply-chain alerts with Socket.dev CLI
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
  "dependencyAudit": {
    "enabled": false
  },
  "socketDev": {
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

Use `ignore` for file globs you never want PublishGuard to scan or report. Use `suppressions` for reviewed false positives; each suppression must include a reason and can match by `rule`, `file`, and/or `fingerprint`.

By default, secret and size checks follow the publish artifact list so local-only files do not create noise. Use `publishguard scan --include-gitignored` or enable `publishguard.includeGitIgnored` in VS Code when you want a broader local sweep that also checks gitignored workspace files such as `.env` files. This does not change the files that npm or VS Code would publish.

Docs and example files are quiet by default unless they are part of the publish artifact or have already appeared in git history. `exampleFiles.scanUnpublished` opts into scanning all matching docs/examples, and `dummySecretSeverity` lets you downgrade or turn off dummy-looking secrets such as fake keys in samples.

Dependency audits are opt-in because they can contact the npm registry and take longer than local checks. Enable them with `publishguard scan --dependency-audit`, set `dependencyAudit.enabled` in `.publishguardrc.json`, or turn on **Run npm audit to confirm vulnerable dependencies** in the VS Code settings webview.

Socket.dev confirmation is also opt-in and requires the Socket CLI to be installed and configured. Enable it with `publishguard scan --socket-dev`, set `socketDev.enabled`, or turn on **Run Socket.dev CLI confirmation for supply-chain alerts** in the settings webview. PublishGuard reports medium, high, and critical Socket alerts while ignoring low-severity alerts by default to reduce noise.

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
