# Future Work

Known gaps, deferred improvements, and follow-up work.

> [!NOTE]
> This file captures known gaps from the MVP phase and will be updated as post-MVP work progresses. Follow the bootstrap protocol in `AGENTS.md` Phase 3 to add planned features.

## Product

- Multi-language support beyond Java (Node.js, Python) — deferred due to semester timeline
- Cross-session longitudinal tracking — currently limited to single workspace sessions
- Instructor dashboard or aggregated class-level metrics — out of scope for capstone

## Trends / fingerprints

- Persist fingerprints and use them for session continuity (this phase computes hashes in memory only)
- Replace line-slice content hashes with scanner-provided ranges if the payload grows
- Queue SessionStore snapshot writes; `onFindings` is currently unqueued read-modify-write

## Extension UX

- Overhaul of scan metadata transformation pipeline (statuses, computations) — planned post-MVP
- CodeLens provider for inline scan actions
- Quick-fix code actions for common vulnerability patterns (concept pointers, not code fixes)
- Configurable severity thresholds and rule toggling from extension settings

## Scanner Integration

- Cross-compilation and bundling of the Rust binary for all platforms (Windows, macOS, Linux) as part of extension packaging
- Binary download at install time as alternative to requiring users to build from source
- Scanner rule overlay system (`.ariadne` rule files) — language support exists, full integration pending

## Developer Experience

- End-to-end integration tests covering the scanner → bridge → presentation pipeline
- CI/CD pipeline for automated testing and VSIX packaging
- Benchmarking harness for scanner performance (2-second re-scan target)
- Contribution guide for external developers

## Usage Notes

- Review this file when planning improvements.
- Prefer moving active work into a spec, plan, and task brief when it becomes implementation work.
