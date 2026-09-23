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
- consequences: Requires users to have GitHub Copilot access. Adds a GitHub OAuth sign-in flow to the extension. Removes the need for API key configuration. Explanations are locked to Gemini Flash.
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

### Ship Linux and Windows scanner binaries inside the extension

- date: 2026-09-23
- status: accepted
- context: Deployed students should not need a PATH install or a local cargo build of the scanner. The extension already spawns `ariadne session` as a child process; the missing piece was a reliable, per-OS binary next to the extension.
- decision: Package x64 Linux and Windows scanner binaries under `bin/linux-x64/` and `bin/win32-x64/`. On activate, `configureAriadneExecutable(context.extensionPath)` selects the host binary. Session, CLI, and rule-script spawns use that path. An explicit existing `ariadne.executable` setting still overrides the bundle.
- consequences: VSIX size grows by ~7MB. macOS and ARM hosts have no bundled binary until those builds exist. Linux hosts need a reasonably current glibc. Updating the scanner means replacing the files in `bin/`.
- task: docs/ai/tasks/2026-09-23-bundled-scanner-binaries.md

### Hourly auto full scan with seamless session rollover and K=3 policy

- date: 2026-09-16
- status: accepted
- context: Students attend a single 3-hour lab session per week. Previously, observation session boundaries were tied strictly to VS Code window open/close. Under that model, students took 2–3 weeks (2–3 lab sessions) to generate enough session records to unlock the Common Vulnerabilities panel (which required $K=2$ or $K=3$). Mentor feedback indicated that students should be able to see their Common Vulnerabilities within a single 3-hour lab class. Furthermore, university computer labs face tight turnover schedules where the room must be vacated immediately at the end of Hour 3 for the next class; surfacing common vulnerabilities during Hour 3 provides students with a dedicated remediation and reflection window with instructor guidance before class dismissal.
- decision:
  1. Add an hourly timer (`HOURLY_SCAN_INTERVAL_MS = 60 * 60 * 1000`) that triggers an automatic workspace-wide full scan (`Analyze`) every 60 minutes while an active session is running.
  2. Finalize the current observation session cleanly as `completed` and seamlessly roll over into the next session using the latest observation state as the new baseline checkpoint.
  3. Align the Common Vulnerabilities entry threshold to $K=3$ (`COMMON_VULN_POLICY.K = 3`), corresponding to the 3 hourly checkpoints of a 3-hour lab class.
  4. Sort Common Vulnerabilities descending by `sessionCount` then `activeFindingCount` so the most persistent and active security gaps appear at the top.
- consequences: Students generate 3 full session checkpoints during a 3-hour lab session, unlocking Common Vulnerabilities as they enter Hour 3 rather than after class ends. This ensures students have actionable instructional feedback while still in the lab environment. Rollover requires zero user interaction and creates cleanly completed sessions in `completedSessions`.
- task: docs/ai/tasks/2026-09-16-hourly-auto-full-scan.md

### Replace raw scan snapshots with finding lifecycle records

- date: 2026-09-03
- status: accepted
- context: The MVP tracker stored an unbounded `ScanSnapshot[]` array (every engine result persisted forever) and classified trends by comparing the latest two snapshots using `cwe_id::type` as the identity key. This was insufficient for time-based persistence, durable resolution tracking, recurrence detection, and cross-session analysis required by the research framework.
- decision: Replace the snapshot-based model with `FindingLifecycleRecord[]` + `SessionRecord`. Findings are matched by a `logicalFingerprint` (scanner SHA256 hash, or a temporary derived key until the fingerprinting teammate's work lands). Lifecycle records track confirmation count, observed duration, absence grace period, provisional/durable resolution, recurrence, and identical-restoration toggles. The four public statuses are Persisting, Improving, Resolved, and Recurring — `new` is removed from the public taxonomy (new findings are internal "candidates"). A serial write queue prevents concurrent workspaceState races.
- consequences: Breaking storage migration — old `ariadne.scanSnapshots` data is discarded. The lifecycle engine is a pure logic module with no vscode dependency, enabling unit testing. Cross-repo dependency: the scanner team needs to emit `logicalFingerprint` / `contentFingerprint` / `scopeFingerprint` fields for faithful scope-aware matching. Observation classification (live vs full scan) is deferred to a teammate's separate task.
- task: docs/ai/tasks/2026-09-03-trends-framework.md

### Save-triggered scan as the lifecycle engine gate (with valid + settled)

- date: 2026-09-06
- status: accepted
- context: The MVP's `onFindings` callback fed every engine result into `processObservation`,
  `setSessionBaseline`, and the Session Metrics panel without any quality gate.
  The overhaul framework (`ariadne-trends-framework-realtime-stability-and-cohort-clarification.md`,
  Section 2) requires a two-gate check before any lifecycle or Trends update:
  (1) **valid** — the result belongs to the correct pending save revision; and
  (2) **settled** — no tracked-file change for two seconds after the valid result arrives.
- decision: All gate logic is in the TypeScript extension; no Rust scanner changes required.
  A `workspaceRevision` counter in `revisionTracker.ts` increments on every tracked-file
  mutation (change, create, delete, rename). `documentEvents.ts` increments the revision at
  save-time and passes it to `extension.ts` via `onSaveTrigger(revision)`. Any mutation fires
  `onRevisionChange(revision)`. In `extension.ts`, `pendingSaveRevision` records which revision
  the scan was for. When `onFindings` arrives: if `pendingSaveRevision` is null → live result,
  update UI only. If revision mismatches → stale, discard for Trends. If revision matches →
  valid, start a 2-second `setTimeout`. If any tracked file changes during those 2 seconds,
  `cancelSettlement()` fires via `onRevisionChange`. If the timer expires cleanly → settled,
  run `processObservation`, set session baseline (initial checkpoint condition), update Session
  Metrics panel. `SaveScanState` tracks `totalSettledCancellations` for debugging.
- consequences: Trends and lifecycle records now only update on a settled save. Save-and-
  immediately-type does not falsely update FLCs. The initial-checkpoint condition (session
  baseline) is now correctly gated: only the first settled save creates the baseline.
  Rapid saves within 2 seconds of each other cancel each other's settlement windows — the
  latest save gets the next chance to settle.
- task: docs/ai/tasks/2026-09-06-save-triggered-scan.md

### Strict 1-to-1 finding lifecycle record (FLC) mapping

- date: 2026-09-07
- status: accepted
- context: In `metadataToObservedFindings()`, findings emitted by the scanner were previously grouped by `deriveLogicalFingerprint()`, collapsing multiple sink occurrences in the same method into a single `ObservedFinding` with `occurrenceCount > 1`. On `arinda-backend-trend-test`, this caused a discrepancy where the Active Vulnerabilities UI showed 20 items while the lifecycle debug dump showed 18 FLCs. Furthermore, when a student fixed one sink in a multi-sink method, the FLC entered `improving` instead of awarding immediate `resolved` credit, producing $F = 0.00$ because the $F = (R / B) \times 10$ formula counts durably resolved FLC members.
- decision: Adopt a strict 1-to-1 mapping where every scanner-reported `VulnerabilityMetadata` item produces exactly one `ObservedFinding` and one FLC with `occurrenceCount = 1`. The primary identity key uses the scanner's `instance_fingerprint` (which incorporates rule, CWE, scope, and normalized sink slice), with fallback to `${logical_fingerprint}:${content_fingerprint}`.
- consequences: Perfect 1-to-1 parity between the Active Vulnerabilities UI (20 items) and lifecycle records (20 FLCs). Fixing an individual sink removes that specific FLC, transitioning it to `resolved` and immediately increasing the student's Fixing Rate ($F$) and reducing Persistence Pressure ($P$). Category-level improvement is reported in Trends rather than on a single collapsed FLC.
- task: docs/ai/tasks/2026-09-07-1-to-1-flc-mapping.md

### Synchronous Shutdown Persistence for Session Finalization

- date: 2026-09-12
- status: accepted
- context: In VS Code, `context.workspaceState.update()` communicates over an internal RPC channel from the Extension Host process to the main window process. During extension deactivation (window closing), VS Code tears down the main-thread RPC listeners, immediately cancelling or failing to resolve outbound `workspaceState.update()` promises. In the previous implementation, `await store.appendCompletedSession()` and `await store.clearActiveSession()` inside `deactivate()` hung indefinitely until the extension host was force-killed by the OS/watchdog. On next activation, startup recovery found the abandoned active session and unconditionally marked it `incomplete`. This broke the research framework because Trend ($T = F_{\text{current}} - F_{\text{prev\_completed}}$) requires comparing against a prior `completed` session; with all sessions becoming `incomplete`, $T$ could never be calculated.
- decision: Implement a synchronous local flush pattern via Node.js native `fs.writeFileSync`. Inside `deactivate()`, when a session is finalized (either clean as `'completed'` or timed-out/failed as `'incomplete'`), `SessionStore.saveFinalizedSessionSync()` writes a local JSON file (`pending-finalized-session.json`) in `context.storageUri` in <1ms without using VS Code's IPC. On next activation, `SessionStore.recoverPendingFinalizedSession()` checks for this file, safely loads it into `completedSessions` in `workspaceState` (while IPC is 100% healthy), and unlinks the file. Only if no pending finalized file exists is an abandoned active session recovered as `incomplete` (handling abrupt power cuts or SIGKILL).
- consequences: Clean shutdowns reliably persist as `completed`, restoring the Trend ($T$) calculation baseline across student sessions. Zero changes to the Rust scanner core or live scan debouncing. Zero background file overhead during normal typing.
- task: docs/ai/tasks/2026-09-12-eager-settled-persistence.md

### Prior Completed Session Baseline & Incomplete Skip Rule

- date: 2026-09-13
- status: accepted
- context: Calculating the user-facing pairwise Trend ($T$) metric requires comparing the current session's findings against the reference set ($C$) of findings known at the end of the prior completed session. However, when a session ends abnormally (e.g. power cuts, brownouts, SIGKILL, or deactivation scan timeouts), it is stamped as `incomplete`. Using an incomplete session's unfinalized state would corrupt the Trend calculation and penalize students for unobserved code changes.
- decision: Implement a backward-searching "Skip Rule" in `SessionStore.loadPriorCompletedSession()`. When a new session initializes its baseline, the store traverses `completedSessions` in reverse chronological order, skipping any session where `status !== 'completed'`. The first session with `status === 'completed'` is returned. Its final checkpoint findings and lifecycle summaries are frozen into `activeSession.trendComparisonByKey` via `extractTrendComparisonBaseline()`. If no completed session exists in storage (e.g., Session 1 or all prior sessions were incomplete), `null` is returned and $T$ gracefully evaluates to `N/A`.
- consequences: Incomplete sessions remain preserved for auditing and debugging, but never corrupt cross-session metrics. When Ervin and Kenn implement the $T$ formula, they receive a clean, pre-calculated, frozen comparison baseline ($C$) and denominator without having to navigate storage, handle incomplete edge cases, or risk runtime division-by-zero errors.
- task: docs/ai/tasks/2026-09-12-pull-previous-completed-session.md

### GitHub sign-in required for all extension features

- date: 2026-09-14
- status: accepted
- context: Upcoming anonymous activity collection needs explicit consent before students use Ariadne. Previously only Ask Ariadne required GitHub sign-in; the SAST engine spawned on activation regardless of auth.
- decision: Gate the entire product on GitHub OAuth plus terms and analytics consent. The `ariadne session` process starts only after a valid signed-in state, and is killed on sign-out (diagnostics cleared). The sidebar is an Account / Scripting / Session accordion. AI explanations are locked to Gemini Flash (`gemini-3.5-flash`); other Copilot models are not selectable. Rule scripts are initialized with `ariadne init` and reset with `ariadne init --force` after a modal confirmation.
- consequences: Unsigned users see no live scan results. Existing GitHub sessions still need current terms version (`1.1`) because the terms now cover scanning, not only AI feedback. Session accordion remains a placeholder.
- task: docs/ai/tasks/2026-09-14-sidebar-settings-auth-gate.md

### Common Vulnerabilities — Cross-Session Type-Level Awareness Metric

- date: 2026-09-14
- status: accepted
- context: The existing lifecycle engine tracks individual finding instances within and across sessions (Persisting, Improving, Resolved, Recurring). However, it does not surface which vulnerability *categories* (by CWE/type) a student encounters repeatedly across sessions. Faculty feedback and the research framework require a type-level awareness signal that tells students "you keep running into SQL Injection" rather than just "this specific finding persists." The metric must also reward students who demonstrate sustained remediation and prevention.
- decision: Implement a Common Vulnerabilities engine as a pure computation module (`commonVulnerabilities.ts`) that aggregates `FindingLifecycleRecord[]` across `SessionRecord[]` by `cweId::type`. A type is "Common" when it appears in K ≥ 2 distinct sessions. Graduation requires all findings of that type to be durably resolved AND the type to be absent for G ≥ 2 consecutive completed sessions. If a graduated type reappears, the session counter resets (Leitner-style box reset) — the type must re-establish a pattern of K sessions before re-entering Common. Graduation history is persisted as a `Record<string, TypeGraduationState>` in a new `workspaceState` key (`ariadne.graduationHistory`). K and G are configurable policy constants. The engine is framework-free (no `vscode` imports) for testability.
- consequences: Students see a "Common Vulnerabilities" panel in Session Metrics showing which categories they encounter repeatedly, with session frequency and active finding count. The panel dynamically reflects graduation — types drop off when students demonstrate sustained mastery. The session-count reset on re-entry prevents a single slip from immediately re-labeling a graduated type. New workspaceState key adds ~100 bytes per graduated type. Cleared alongside other lifecycle data on debug reset.
- task: docs/ai/tasks/2026-09-14-common-vulnerabilities.md

### Common Vulnerabilities — Prevention-aware counting and graduation

- date: 2026-09-19
- status: accepted
- context: An alignment review revealed two misalignments in the Common Vulnerabilities engine. (1) Session counting was based on type *presence* — if a single finding persisted across 3 hourly checkpoints, it reached K=3 by itself, falsely labeling a one-time occurrence as "common." The intended behavior was to count only sessions where a *new* instance was created. (2) Graduation only required all instances to be resolved, not that the student stopped *creating* new ones — conflating "learned to fix" with "learned to prevent."
- decision: Two changes to `commonVulnerabilities.ts`. **Counting**: Replace session-presence counting with a cumulative seen-fingerprint set. A milestone only increments the session count if it contains a `logicalFingerprint` not yet seen (new instance). Persisting findings do not inflate the count. **Graduation**: Require BOTH (a) all current FLCs of the type are durably resolved AND (b) no new instances were created for G=2 consecutive completed sessions. The `csNewTypes` array tracks which completed sessions had new instances, and graduation walks backwards through this array.
- consequences: A single persisting finding no longer self-qualifies as Common (sessionCount=1 instead of 3). Students must demonstrate both fixing AND prevention competence before a type graduates. No storage migration required — `TypeGraduationState` shape and `graduatedAfterSessionIndex` semantics are unchanged. The new-instance counting also correctly handles recurring findings (same fingerprint reappearing after absence) — they are not counted as new.
- supersedes: Common Vulnerabilities — Cross-Session Type-Level Awareness Metric (counting and graduation logic only; entry threshold K=3 and panel rendering unchanged)
- task: docs/ai/tasks/2026-09-19-common-vuln-realignment.md

<!-- Add new post-MVP decisions above this line -->


