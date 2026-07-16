# PublishGuard for VS Code

Find publishing risks before they reach npm or the VS Code Marketplace.

## A simple review workflow

1. Open a project with `package.json`.
2. Select the PublishGuard shield in the Activity Bar.
3. Run **PublishGuard: Scan Project**.
4. Review the results in the sidebar or VS Code **Problems** panel.
5. Right-click a finding to open it, copy it, ignore it, ignore its problem type, or exclude its file/folder.

Reviewed choices are saved to `.publishguardrc.json` and never modify the files your package publishes. PublishGuard rescans after an ignore change by default. Disable **Rescan automatically after ignoring a problem** in the settings webview when you prefer to make several changes before scanning again.

## Protection included

- Secrets from AWS, GitHub, npm, GitLab, Slack, Stripe, Google, SendGrid, OpenAI, DigitalOcean, plus private keys, webhooks, and database connection strings.
- Environment files, certificates, logs, source maps, test data, registry credentials, Terraform state, Kubernetes config, Docker auth, and other sensitive files.
- Exact npm/VS Code publish-file review.
- Ignore-file and package metadata checks.
- Dependency specifier risk, file-size, README, LICENSE, and CHANGELOG checks.
- VS Code extension checks for diagnostics, language servers, SCM, testing, debugging, webviews, authentication, tasks, notebooks, terminals, and browser support.
- Optional npm audit, Socket.dev, and Snyk confirmation.

## Scan modes

- **Quick**: fast save-time feedback.
- **Full**: normal manual review with bounded source analysis.
- **Deep**: broader pre-release review, including local gitignored files and unpublished examples.

Use **PublishGuard: Quick Scan**, **PublishGuard: Scan Project**, or **PublishGuard: Deep Scan** from the Command Palette or the sidebar toolbar.

## Helpful commands

- **Refresh Issues** / **Refresh Diagnostics**: run the configured scan again.
- **Manage Finding**: open, reveal, ignore, exclude, refresh, filter, or clear a finding.
- **Set Severity Filter**: show errors only, errors and warnings, or all findings.
- **Open Settings**: configure scan scope, severities, ignore globs, suppressions, and optional scanners.
- **Auto-Fix Issues** and **Generate Ignore Files**: apply safe common fixes.

The CLI companion is available as `@publishguard/cli` for CI and pre-publish hooks. See the [project README](../../README.md) for CLI examples and project configuration.

## License

MIT
