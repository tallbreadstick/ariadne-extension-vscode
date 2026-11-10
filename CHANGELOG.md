# Change Log

All notable changes to the "ariadne-extension-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.1] - 2026-03-26

### Added

- Interactive onboarding guide (first-run activation, Data Audit Graph GIFs).
- Built-in CWE explanations when Copilot fails, with a clear built-in fallback banner.
- Session metrics ingest settings (`ariadne.metricsIngest.*`).
- macOS Copilot native runtime support in the VSIX.
- `npm run vsix` packaging script (prepublish staging + minified bundle).

### Changed

- VS Code engine minimum: **1.100.0**.
- Explain Vulnerability uses optimized production bundle settings for smaller `dist/extension.js`.
- VSIX prep stages only shipped Copilot and Koffi platforms (Linux/Windows/macOS x64 and arm64 where applicable).

### Removed

- **Ariadne: Analyze** from the Command Palette (scanning remains automatic).

## [0.1.0] - 2026-03-10

- Initial marketplace release.
