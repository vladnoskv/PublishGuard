# Changelog

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
