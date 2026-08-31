# Project Context

Durable product context every agent should read before making changes.

## Summary

- **Project**: Ariadne — VSCode Extension
- **What it is**: A student-first VS Code extension that performs real-time, diagnostic-only static application security testing (SAST) on student-written Java code, providing structured plain-language explanations of vulnerabilities via an LLM without generating, suggesting, or completing code — preserving academic integrity.
- **Status**: post-MVP; implementing additional features
- **Primary surface**: VSCode extension — sidebar panel, bottom panel (Active Vulnerabilities + Session Metrics), diagnostics, editor decorations, hover popups, command palette, status bar
- **Repo visibility**: public
- **Target users**: CSIT undergraduate students at CIT-U enrolled in project-based Java web development courses
- **Academic context**: Capstone project, 2nd semester AY 2025–2026, IT332 section 04

## Scanner core (private)

The scanning engine is developed in a separate **private** Rust repository. It is already integrated into this extension and usable via the bridge layer.

- **Integration mechanism**: `child_process` spawning the `ariadne` binary with `session` subcommand
- **Communication format**: Newline-delimited JSON over stdin/stdout (IPC messages)
- **Scanner binary location**: Resolved at runtime via `ariadne.executable` setting (defaults to `ariadne` on PATH, also checks `target/debug/ariadne` and `target/release/ariadne` in the open workspace)
- **Core technology**: Rust + Tree-sitter Java parser for AST construction, taint analysis engine with dataflow graph traversal
- Do not reference the private repo URL, internal module names, or proprietary rule logic in any committed file.

## Tech stack

- **Extension host**: TypeScript, VSCode Extension API
- **Build**: esbuild for extension bundling
- **Testing**: Mocha (via `@vscode/test-cli` and `@vscode/test-electron`)
- **Package format**: `.vsix` via `@vscode/vsce`
- **Package manager**: npm
- **Linting**: ESLint 9 with typescript-eslint
- **AI integration**: GitHub Copilot SDK (`@github/copilot-sdk`) for LLM-powered explanations
- **Scanner core**: Rust binary communicating via JSON over stdio

## Key domain concepts

- `VulnerabilityMetadata` — Flat finding from the scanner: type, CWE, OWASP category, severity, file path, line number, optional taint trace and instance metadata. Primary input to the LLM prompt and presentation layer.
- `Vulnerability` (3-layer hierarchy) — Level 1: pattern found by ruleset (grouped by CWE + type). Contains Instances (Level 2: affected symbol) which contain Occurrences (Level 3: specific file location + optional taint trace).
- `ScanSnapshot` — Point-in-time capture of all vulnerabilities from a single analysis run, used by the tracker to derive trends.
- `AriadneFinding` — Presentation-layer finding shape used by DiagnosticManager for inline squiggles and hover popups.
- `TaintTrace` — Origin-to-sink dataflow path: origin line, sink line, path summary.
- `AriadneMessage` — IPC message union type (Init, OpenFile, UpdateFile, CloseFile, CreateFile, DeleteFile, RenameFile, Analyze, ReloadRules) sent from TypeScript to the Rust engine.
- `AriadneSession` — Session interface wrapping the child process: send(), kill(), restart(), onFindings().
- `Bridge` — The TypeScript ↔ scanner communication layer: iostream.ts (process management), messages.ts (IPC contract), convert.ts (type transformers), documentEvents.ts (VS Code event → IPC message dispatcher).
- `DiagnosticManager` — Manages VS Code DiagnosticCollection for inline squiggles, background highlights, and end-of-line labels.
- `SessionStore` — Persists scan snapshots to VS Code workspaceState for cross-session tracking.

## MVP scope (shipped)

1. **Static Vulnerability Detection Module** (Module 1) — Rust SAST engine parsing Java into ASTs via Tree-sitter, rule-based taint analysis with dataflow graph traversal, 10+ patterns from OWASP Top 10 / CWE Top 25, three detector categories (taint-flow, pattern-match, configuration-file), sanitizer rules to reduce false positives.
2. **VS Code Diagnostic Presentation Layer** (Module 2) — Severity-coded inline annotations (wavy underline, whole-line background, end-of-line label), HoverProvider with vulnerability summary + "Ask Ariadne" action link, Active Vulnerabilities webview panel in bottom panel ViewsContainer.
3. **AI-Powered Conceptual Feedback Engine** (Module 3) — LLM prompt serialization from vulnerability metadata, three-section response (issue description, security implication, concept pointer), constrained to never produce code fixes, GitHub Copilot SDK integration, response validation with static fallback.
4. **Session-Based Reinforcement Tracker** (Module 4) — In-memory scan snapshot log, pattern analyzer (persisting/improving/new/resolved classifications), priority-based status bar summary, soft toast notifications, Session Metrics webview panel with severity count tiles and trend data, workspaceState persistence.
5. **Supporting features** — GitHub OAuth authentication for Copilot access, `.ariadne` rule file language support with syntax highlighting, sign-in sidebar panel, terms of use panel.

## Notes for coding agents

- **Workflow playbook**: `AGENTS.md` at the repo root.
- **Standards**: `docs/ai/standards.md`.
- **Architecture**: `docs/ai/architecture.md`.
- **Scanner core is private** — do not attempt to modify it from this repo. If a change requires scanner modifications, note it as a cross-repo dependency in the task brief.
- **Bridge layer** (`src/modules/detection/bridge/`) is the **only** code that communicates with the scanner. All other modules receive typed TypeScript objects.
- **Do not** import `vscode` in utility or type files — keep framework coupling in `src/modules/`.
- **Do not** commit private repo URLs, scanner internals, or proprietary rule logic to this public repo.
