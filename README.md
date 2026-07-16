# PublishGuard

PublishGuard helps you ship npm packages and VS Code extensions with confidence. It checks what will be published, finds secrets and risky files, reviews package metadata and dependencies, and puts actionable findings in VS Code and CI.

## Start in VS Code

Install [PublishGuard from the VS Code Marketplace](https://marketplace.visualstudio.com/) and open a workspace containing `package.json`.

1. Open the PublishGuard shield in the Activity Bar.
2. Run **PublishGuard: Scan Project**.
3. Review the sidebar and the VS Code **Problems** panel.
4. Select a finding to open its file, or right-click it for quick fixes.

When a finding is reviewed, choose **Ignore this problem** for one occurrence or **Ignore this type of problem** for the rule everywhere. You can also ignore a rule in a file or folder, or exclude a noisy path from PublishGuard scans. These choices are stored in `.publishguardrc.json`; they do not change `.npmignore` or what your package publishes.

By default, PublishGuard rescans after an ignore change so stale findings disappear immediately. Turn off **Rescan automatically after ignoring a problem** in **PublishGuard: Open Settings** to batch changes and apply them on the next scan.

## What you get

- Secret detection for AWS, GitHub, npm, GitLab, Slack, Stripe, Google, SendGrid, OpenAI, DigitalOcean, JWT, private keys, webhooks, database URLs, and similar credentials.
- Sensitive-file checks for environment files, certificates, logs, source maps, test data, editor files, registry credentials, Terraform state, Kubernetes config, Docker auth, and other publish hazards.
- A publish-surface review showing the files npm or `vsce` will actually ship.
- `.npmignore`, `.vscodeignore`, and `.gitignore` validation, including missing rules and unsafe patterns.
- `package.json` metadata, README, LICENSE, CHANGELOG, file-size, and dependency-risk checks.
- VS Code extension capability checks for diagnostics, language servers, SCM, testing, debugging, webviews, authentication, tasks, notebooks, terminals, and browser compatibility.
- Optional npm audit, Socket.dev, and Snyk confirmation checks.
- A focused sidebar, Problems diagnostics, severity filters, quick fixes, reports, and safe ignore-file generation.

## Scan modes

| Mode | Use it when | Coverage |
|---|---|---|
| `quick` | You want fast feedback while editing | Manifest, publish files, ignore rules, dependencies, published-file secrets, and manifest capability checks |
| `full` | You are reviewing a change | The normal publish-surface scan plus bounded source capability analysis |
| `deep` | You are preparing a release | Wider source analysis, gitignored local files, unpublished docs/examples, and the full standard scan |

Content scans normally follow the files that would be published, which keeps local-only noise low. Use `deep` or `--include-gitignored` for a broader local review.

## CLI and CI

```bash
npm install -g @publishguard/cli
publishguard scan
publishguard scan --quick
publishguard scan --deep
publishguard scan --json
publishguard scan --ci
publishguard scan --fail-on error
publishguard init
publishguard fix
```

For npm publishing, add a safety gate to `package.json`:

```json
{
  "scripts": {
    "prepublishOnly": "publishguard scan --fail-on warning"
  }
}
```

## Configuration

Create `.publishguardrc.json` in the project root when you need project-specific policy:

```json
{
  "scanMode": "full",
  "rules": {
    "private-key": "error",
    "source-map": "warning",
    "jwt-token": "off"
  },
  "ignore": ["**/fixtures/**"],
  "suppressions": [
    {
      "rule": "jwt-token",
      "file": "test/fixtures/**",
      "reason": "Reviewed test fixture; not a real token"
    }
  ],
  "dependencyAudit": { "enabled": false },
  "exampleFiles": {
    "scanUnpublished": false,
    "scanGitHistory": true,
    "dummySecretSeverity": "info",
    "patterns": ["docs/**", "examples/**"]
  }
}
```

Use `ignore` for paths that should never be scanned. Use `suppressions` for reviewed findings; each suppression needs a reason and may match by rule, file glob, and/or fingerprint. Rule severities can be `error`, `warning`, `info`, or `off`.

Useful VS Code settings include `publishguard.scanOnSave`, `publishguard.rescanAfterIgnore`, `publishguard.scanMode`, `publishguard.includeGitIgnored`, `publishguard.severityThreshold`, and the optional dependency-audit settings. The complete list is available through **PublishGuard: Open Settings**.

## Packages

| Package | Purpose |
|---|---|
| `publishguard` | VS Code extension |
| `@publishguard/cli` | CLI and CI interface |
| `@publishguard/core` | Shared scanning engine |

## License

MIT
