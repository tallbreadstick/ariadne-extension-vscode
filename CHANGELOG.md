# Change Log

All notable changes to the "ariadne-extension-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.2] - 2026-11-12

### Added

- Flat active-vulnerability cards (description and file link visible without expanding an accordion).
- Unified gateway loading panel in the bottom workspace.
- Sidebar **Configuration** accordion (notification level, auto-scan interval, consent) with live sync to VS Code settings.

### Changed

- Cross-filtering keeps the vulnerability filter drawer closed so the list stays readable.
- Debug log folder command for troubleshooting scanner downloads and ingest.

### Removed

- **Debug core** sidebar toggle (use the `ariadne.executable` setting for a local scanner path).

## [0.1.1] - 2026-03-26

### Added

- Interactive onboarding guide (first-run activation, Data Audit Graph GIFs).
- Built-in CWE explanations when Copilot fails, with a clear built-in fallback banner.
- Session metrics ingest settings (`ariadne.metricsIngest.*`).
- macOS Copilot native runtime support in the VSIX.
- `npm run vsix` packaging script (minified bundle; Copilot CLIs download at runtime).
- Sidebar **Copilot** section (Auto / OS / build / version) mirrors Core binary downloads; VSIX no longer bundles Copilot natives (~10–15 MB vs ~650 MB).

### Changed

- VS Code engine minimum: **1.100.0**.
- Explain Vulnerability uses optimized production bundle settings for smaller `dist/extension.js`.
- VSIX prep stages only shipped Copilot and Koffi platforms (Linux/Windows/macOS x64 and arm64 where applicable).

### Removed

- **Ariadne: Analyze** from the Command Palette (scanning remains automatic).

## [0.1.0] - 2026-03-10

- Initial marketplace release.
