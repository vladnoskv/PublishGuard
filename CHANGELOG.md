# Changelog

User-facing release notes for PublishGuard. Versions are listed newest first.

## 0.6.0 - July 16, 2026

- Added clearer right-click and quick-fix actions for ignoring one problem, a problem type, a file, or a folder.
- Added automatic rescanning after an ignore change, with a setting to turn it off when batching changes.
- Improved the sidebar scan summary with the active scan mode and number of findings shown.
- Refreshed the VS Code settings page, README, and release notes around everyday publishing workflows.
- Added high-signal detection for GitLab, Slack, Stripe, Google, SendGrid, OpenAI, and DigitalOcean credentials.
- Added checks for npm/Python registry credentials, Terraform state/variables, Kubernetes config, and Docker registry auth files.

## 0.5.0 - June 3, 2026

- Added **Refresh Diagnostics**, **Clear Diagnostics**, and **Set Severity Filter** commands.
- Added **Manage Finding**, a single place to open, reveal, ignore, exclude, refresh, filter, or clear a diagnostic.
- Added Explorer actions for adding reviewed files and folders to the PublishGuard ignore list.
- Severity filters now update the current results immediately.

## 0.4.1 - June 2, 2026

- Improved scan-on-save so it runs only when `package.json` is saved.
- Added clearer guidance after ignore rules are changed.
- Fixed VS Code runtime type declarations used by the extension.

## 0.4.0 - June 2, 2026

- Added quick, full, and deep scan modes.
- Added broader VS Code extension checks for recovery commands, lifecycle support, webview security, and browser compatibility.
- Added Refresh Issues and Deep Scan commands.

## 0.3.1 - June 1, 2026

- Added optional Snyk confirmation for dependency vulnerabilities.
- Scanner-tool failures now appear as warnings instead of stopping the complete scan.

## 0.3.0 - June 1, 2026

- Added Problems-panel and editor quick fixes for reviewed findings.
- Added sidebar right-click actions for suppressing findings and excluding files/folders.
- Added the settings webview for scanner switches, rule severities, ignored paths, and reviewed findings.
- Fixed sidebar context-menu registration and invalid settings feedback.

## 0.2.0 - June 1, 2026

- Added an opt-in broader local sweep for gitignored files.
- Added matching VS Code settings and webview controls.
- Added exact, file, folder, and rule-level ignore actions.

## 0.1.0 - May 31, 2026

- Initial release with secret, sensitive-file, metadata, manifest, ignore-file, file-size, dependency, CLI, CI, sidebar, and Problems-panel checks.
