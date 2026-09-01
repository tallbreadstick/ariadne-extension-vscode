# Engineering Decisions

Durable decisions that affect how the product or repository should evolve.

Within each section, newest decision at the top.

---

## MVP Decisions

> These decisions were made during the MVP phase and extracted from project documents (Software Proposal, SRS, SDD).
> They establish the baseline architecture and constraints that post-MVP work builds on.

### Use GitHub Copilot SDK instead of direct OpenAI API

- date: 2026 (semester 2)
- status: accepted
- context: The SRS initially specified a direct external LLM API with independent API key management. However, the VS Code ecosystem provides native Copilot integration via the `@github/copilot-sdk`. Using the Copilot SDK simplifies authentication (leverages existing GitHub OAuth) and avoids requiring students to manage separate API keys.
- decision: Use `@github/copilot-sdk` for LLM-powered conceptual explanations instead of a standalone OpenAI API integration.
- consequences: Requires users to have GitHub Copilot access. Adds a GitHub OAuth sign-in flow to the extension. Removes the need for API key configuration. Model selection is configurable via `ariadne.copilot.model` setting.
- source: Implementation decision during development; `package.json` dependency

### Diagnostic-only design — never generate, suggest, or complete code

- date: 2026-01 (capstone proposal)
- status: accepted
- context: Existing AI coding tools (GitHub Copilot, ChatGPT) produce code for users, which research shows leads to less secure code with higher confidence (Perry et al., 2023). Students need to remain sole authors of their code to preserve academic integrity and enable genuine learning.
- decision: Ariadne identifies and explains vulnerabilities but never generates, suggests, or applies code fixes. The LLM is constrained to a three-section explanation format (issue description, security implication, concept pointer) with explicit instructions prohibiting code snippets.
- consequences: Students must independently research and implement fixes. Response validation rejects non-conforming LLM output and falls back to a static message.
- source: Capstone proposal Part 1, Part 4; SRS §2.1

### Use a private Rust repo for the scanner core

- date: 2026-01 (capstone proposal)
- status: accepted
- context: The SAST engine requires high-performance AST traversal, cross-file symbol resolution, and taint analysis that must complete full workspace re-scans within 2 seconds for files up to 500 lines. TypeScript/Node.js cannot meet these performance requirements for computationally intensive static analysis.
- decision: Implement the scanner core as a standalone Rust binary using Tree-sitter for Java AST parsing, with a custom taint analysis engine including dataflow graph traversal. Keep the scanner in a separate private repository to protect proprietary rule logic.
- consequences: Cross-compilation required for Windows, macOS, Linux. Bridge layer in TypeScript manages the child process. Two-repo coordination required for scanner contract changes.
- source: Capstone proposal Part 4; SRS §2.3 constraints; SDD §2

### Scanner communicates via newline-delimited JSON over stdio

- date: 2026-01 (SRS)
- status: accepted
- context: The Rust scanner runs as a long-lived child process spawned by the extension. Needed a simple, debuggable protocol for bidirectional communication without network overhead.
- decision: Use newline-delimited JSON over stdin (extension → scanner) and stdout (scanner → extension). Each message is a complete JSON object on a single line. The TypeScript side defines `AriadneMessage` discriminated union; the Rust side defines a matching `Message` enum with `#[serde(tag = "type")]`.
- consequences: Simple to debug (log lines). No network dependency. Buffer management required for partial reads. Message contract must stay in sync across repos.
- source: SRS §3.1.3; SDD §1.1 (IPC Message Contract)

### Target VSCode as the primary IDE

- date: 2026-01 (capstone proposal)
- status: accepted
- context: VS Code is the most widely used IDE among CSIT students at CIT-U. Prior research (Whitney et al., 2017; Nocera et al., 2025) found that Eclipse-based security tools suffered from IDE unfamiliarity and configuration friction, reducing adoption.
- decision: Build Ariadne exclusively as a VS Code extension, leveraging native APIs (DiagnosticCollection, HoverProvider, WebView, ExtensionContext) for seamless integration.
- consequences: Not usable in IntelliJ, Eclipse, or other IDEs. Extension is sandboxed within VS Code's API boundaries.
- source: Capstone proposal Part 3; SRS §2.1

### Bridge layer pattern — single communication boundary

- date: 2026-01 (SDD)
- status: accepted
- context: Multiple TypeScript modules need scanner results (diagnostics, panels, tracker, feedback), but only one module should manage the child process lifecycle and IPC protocol.
- decision: All scanner communication flows through `src/modules/detection/bridge/`. The bridge spawns the process (iostream.ts), defines the message contract (messages.ts), dispatches VS Code events as IPC messages (documentEvents.ts), and converts raw findings to typed TypeScript objects (convert.ts). All other modules receive typed objects, never raw scanner output.
- consequences: Bridge is the single point of change for IPC protocol updates. Other modules are decoupled from the scanner implementation. Any bridge contract change requires cross-repo coordination.
- source: SDD §1.1; codebase structure

### Four-module architecture

- date: 2026-01 (capstone proposal)
- status: accepted
- context: The system has four distinct functional areas with different concerns: detection, presentation, feedback, and tracking.
- decision: Structure the extension around four modules aligned to the capstone general objectives: (1) Static Vulnerability Detection Module (Rust scanner + bridge), (2) VS Code Diagnostic Presentation Layer, (3) AI-Powered Conceptual Feedback Engine, (4) Session-Based Reinforcement Tracker.
- consequences: Clean separation of concerns. Each module can be developed and tested independently. Module boundaries map to the SRS use cases.
- source: Capstone proposal Part 2; SRS §3.2; SDD §3

### Three-section LLM explanation format

- date: 2026-01 (capstone proposal)
- status: accepted
- context: Research shows that generic security explanations are insufficient (Zhu et al., 2014). Structured, consistently framed feedback produces better learning outcomes (Bandi et al., 2019). Students need to understand exploitability, not just see a warning label.
- decision: Every LLM explanation follows a fixed three-section format: (1) plain-language issue description, (2) real-world security implication, (3) concept pointer for independent study. System prompt explicitly prohibits code snippets or fix suggestions. Non-conforming responses are rejected with a static fallback.
- consequences: Deterministic output structure despite non-deterministic LLM behavior. Requires response parsing and format validation. Fallback message covers API failures and format violations.
- source: Capstone proposal Part 4.1; SRS UC-3.2

### Session-based tracking without external persistence

- date: 2026-01 (SRS)
- status: accepted
- context: VS Code extensions are sandboxed and can only use `ExtensionContext.workspaceState` / `globalState` for persistence. These APIs support JSON-serializable key-value data only.
- decision: Use in-memory scan snapshot accumulation during the session, with incremental persistence to `workspaceState` after each scan. No external database or file system writes. The tracker compares consecutive snapshots to classify vulnerability patterns as persisting, improving, new, or resolved.
- consequences: Session history is workspace-scoped and tied to VS Code storage limits. Cross-workspace trends are not available. Data is JSON-serializable only.
- source: SRS §2.3 constraints; SRS UC-4.4; SDD §4

---

## Post-MVP Decisions

> These decisions are made during post-MVP feature implementation.
> They are recorded as new features are designed and built.
>
> **For agents**: If starting post-MVP work and this section is empty, follow the bootstrap protocol in `AGENTS.md` Phase 3 — ask the user what features are planned, what decisions have been made, and request any supporting files (specs, sketches, issue threads). Record each decision here.
>
> During ongoing work, append a new ADR here whenever you introduce a new framework, dependency, design pattern, or make a significant architectural choice.

### Derive finding fingerprints in the extension from queued sent buffers

- date: 2026-08-31
- status: accepted
- context: Trends continuity needs stable logical/content/scope hashes. The scanner payload has metadata and line numbers but not enclosing-symbol paths, source ranges, or hashes. Changing the scanner contract was deferred so Phase 1 can ship in the public extension repo alone.
- decision: Compute SHA-256 fingerprints in TypeScript from existing finding metadata plus a FIFO snapshot of file text sent on analysis-triggering IPC (`Init`, `CreateFile`, `DeleteFile`, `RenameFile`, `UpdateFile`). Do not re-hash the live editor buffer at callback time. Continuity key is `(fingerprintVersion, logicalFingerprint, scopeFingerprint)`. Duplicate keys in one scan are ambiguous. `.env` hygiene findings are excluded. Content uses a normalized Java line (or taint origin+sink lines) or a parsed properties value. Enclosing path is a brace-depth heuristic on snapshot Java, or the property key for config.
- consequences: First `Init` findings are often ineligible (empty snapshot before `OpenFile`). Line-level slices are coarser than range-based hashes. FIFO pairing can desync if findings arrive without a matching send. Hashes of secret-bearing lines still correlate identical secrets. Fingerprints are not persisted in SessionStore in this phase.
- task: docs/ai/tasks/archive/2026-08-31-fingerprint-phase-1.md

### Template for new entries

<!--
### <decision title>

- date: YYYY-MM-DD
- status: accepted | superseded | rejected
- context: Why was this decision needed?
- decision: What was decided?
- consequences: Tradeoffs, what this enables or constrains
- task: docs/ai/tasks/YYYY-MM-DD-slug.md (optional)
- supersedes: <title of previous decision> (if applicable)
-->

<!-- Add new post-MVP decisions above this line -->
