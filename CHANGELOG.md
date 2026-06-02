# Changelog

## 0.5.0 (2026-06-03)

### Added

- Added VS Code commands to refresh diagnostics, clear diagnostics, and change the PublishGuard severity filter from the command palette and sidebar.
- Added **PublishGuard: Manage Finding** so the active diagnostic can be opened, revealed, ignored, excluded, refreshed, filtered, or cleared from one menu.
- Added Explorer right-click actions for adding reviewed false-positive files and folders to `.publishguardrc.json` `ignore`.

### Changed

- Severity filter changes now re-filter the last raw scan result instead of requiring a new scan to restore hidden lower-severity findings.
- Updated package, CLI, VS Code extension, and lockfile metadata for 0.5.0.

## 0.4.1 (2026-06-02)

### Changed

- Suppression and project ignore-rule actions now save the rule without automatically rescanning, and prompt users to run a new scan when they want the UI refreshed.
- Scan-on-save now only runs after saving `package.json`, matching the setting description.
- Updated package, CLI, VS Code extension, and SARIF reporter metadata for 0.4.1.

### Fixed

- Declared VS Code extension runtime ambient types explicitly so editor TypeScript diagnostics can resolve Node globals and the VS Code API.

## 0.4.0 (2026-06-02)

### Added

- Added VS Code capability checks for diagnostic, language-server, SCM, formatter, testing, debugger, view, webview, auth, task, notebook, terminal, and web-extension behavior.
- Added quick, full, and deep scan modes for CLI and VS Code scans.
- Added PublishGuard refresh and deep-scan command coverage for the VS Code extension.

### Changed

- Updated package, CLI, VS Code extension, and SARIF reporter metadata for 0.4.0.

## 0.3.1 (2026-06-01)

### Added

- Added optional Snyk CLI dependency vulnerability confirmation through `publishguard scan --snyk`, `.publishguardrc.json` `snyk.enabled`, and the VS Code settings webview.
- Snyk scanner failures now report a warning instead of failing the whole scan, matching npm audit and Socket.dev behavior.

### Changed

- Updated package, CLI, VS Code extension, and SARIF reporter metadata for 0.3.1.

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
