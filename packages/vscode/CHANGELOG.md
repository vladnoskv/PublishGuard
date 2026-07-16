# Changelog

## 0.6.0 - July 16, 2026

- Right-click and quick-fix actions now use clear “problem” wording for errors, warnings, and information findings.
- Ignore actions can automatically rescan so stale Problems entries disappear immediately.
- Added **Rescan automatically after ignoring a problem** to the settings webview and extension settings.
- The sidebar now shows the active scan mode and the number of findings currently shown.
- Reworked the extension documentation around the user workflow.
- Expanded secret detection for modern provider tokens and common credential-bearing configuration files.

## 0.5.0 - June 3, 2026

- Added Refresh Diagnostics, Clear Diagnostics, Set Severity Filter, and Manage Finding.
- Added Explorer right-click actions for reviewed false-positive files and folders.
- Severity filter changes now update the current results immediately.

## 0.4.1 - June 2, 2026

- Improved scan-on-save behavior and guidance after ignore changes.
- Fixed VS Code runtime type declarations.

## 0.4.0 - June 2, 2026

- Added quick, full, and deep scans.
- Added broader VS Code capability checks and Refresh Issues.

## 0.3.1 - June 1, 2026

- Added optional Snyk dependency confirmation.
- Scanner-tool failures now produce warnings instead of stopping a scan.

## 0.3.0 - June 1, 2026

- Added Problems-panel and editor quick fixes for reviewed findings.
- Added sidebar right-click suppression and file/folder exclusion actions.
- Added the settings webview and fixed sidebar context-menu registration.

## 0.2.0 - June 1, 2026

- Added the opt-in gitignored-file local sweep and matching settings controls.

## 0.1.0 - May 31, 2026

- Initial VS Code extension release.
