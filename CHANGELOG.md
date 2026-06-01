# Changelog

## 0.3.0 (2026-06-01)

### Added

- VS Code editor lightbulb and Problems quick fixes now include "Ignore this warning" and "Ignore this type of warning" actions.
- PublishGuard sidebar right-click menus now expose warning suppression and file/folder exclusion actions.
- File and folder exclusions can be added to `.publishguardrc.json` from the editor, Problems panel, or PublishGuard sidebar without modifying `.npmignore`.
- The settings webview now saves rule toggles through a tested payload normalizer and gives immediate feedback for Save and Save and Scan.

### Fixed

- VS Code menu contributions are now registered under `contributes.menus`, so the PublishGuard sidebar context menu appears correctly.
- Save and Scan now reports malformed settings payloads instead of silently doing nothing.

## 0.2.0 (2026-06-01)

### Added

- `--include-gitignored` now performs a broader local secret and size sweep over gitignored workspace files while leaving publish file resolution unchanged.
- VS Code setting `publishguard.includeGitIgnored` exposes the same local sweep mode in the extension and settings webview.

### Changed

- Turbo test tasks no longer declare coverage output when coverage is not generated, which removes misleading validation warnings.

## 0.1.0 (2026-05-31)

### Added

- Initial MVP release
- Core scanning engine with secret detection (10+ patterns)
- Sensitive file detection (30+ patterns)
- Ignore file validation (.npmignore, .vscodeignore, .gitignore)
- Manifest validation (package.json completeness)
- Metadata checks (README, LICENSE, CHANGELOG)
- File size warnings (5MB warn, 50MB error)
- CLI with scan, init, and fix commands
- VS Code extension with sidebar, diagnostics, and quick-fixes
- JSON, pretty, and CI output formatters
- Safe ignore rule generation
- GitHub Actions CI integration
