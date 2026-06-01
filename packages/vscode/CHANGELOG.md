# Changelog

## 0.2.0

- Added `publishguard.includeGitIgnored` so VS Code scans can include gitignored workspace files in secret and size checks without changing publish file resolution.
- Added the include-gitignored toggle to the PublishGuard settings webview.

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
