# Changelog

## 0.4.1

- Suppression and project ignore-rule actions now save the rule without automatically rescanning.
- Added user guidance to run a new scan when ignore-rule changes should refresh the current UI.
- Scan-on-save now only runs after saving `package.json`.
- Fixed editor TypeScript diagnostics by declaring VS Code extension runtime ambient types explicitly.
- Updated package metadata for 0.4.1.

## 0.4.0

- Added quick, full, and deep scan modes.
- Added VS Code capability checks and source-backed advice for provider refresh/restart commands, webview CSP, and web-extension compatibility.
- Added `PublishGuard: Refresh Issues`.
- Connected native settings and the settings webview for scan mode and docs/example scan settings.
- Updated package metadata for 0.4.0.

## 0.3.1

- Added optional Snyk CLI dependency vulnerability confirmation in VS Code scans and settings.
- Added `.publishguardrc.json` `snyk.enabled` support from the settings webview.
- Updated package metadata for 0.3.1.

## 0.3.0

- Added editor lightbulb and Problems quick-fix actions for "Ignore this warning" and "Ignore this type of warning".
- Added file and folder exclusion actions that write to `.publishguardrc.json` from Problems, editor context menus, and the PublishGuard sidebar.
- Improved settings save handling so rule toggles, scanner toggles, and Save and Scan use a validated settings payload.
- Fixed PublishGuard sidebar right-click menus by moving menu contributions under `contributes.menus`.

## 0.2.0

- Added `publishguard.includeGitIgnored` so VS Code scans can include gitignored workspace files in secret and size checks without changing publish file resolution.
- Added the include-gitignored toggle to the PublishGuard settings webview.
- Added sidebar context menu and VS Code Problems quick-fix actions for ignoring exact findings, files, folders, and rule scopes.
- Changed file ignore quick fixes to write PublishGuard-only ignores to `.publishguardrc.json` instead of modifying `.npmignore`.

## 0.1.0

- Initial release
- Pre-publish scan with secret detection, sensitive file detection, ignore file validation
- Manifest validation for package.json
- Metadata checks (README, LICENSE, CHANGELOG)
- File size warnings
- Quick-fix CodeActions
- Sidebar tree view with issue categorization
- Problems panel integration
- Auto-scan on save
