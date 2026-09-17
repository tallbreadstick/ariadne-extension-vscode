# Spec: Hourly Auto Full Scan and Session Rollover

## Purpose

Enable hourly automated full-workspace scans and seamless session rollover during active student coding sessions. This aligns session boundaries with 1-hour instructional blocks in university lab classes (typically 3 hours once per week), allowing Common Vulnerabilities ($K=3$) and learning trends to populate within a single lab period.

## Scope

- in scope:
  - Background hourly timer (`HOURLY_SCAN_INTERVAL_MS = 60 * 60 * 1000`, with configurable override for testing) that runs while an active session exists.
  - Idle & buffer flush: sync in-flight editor changes to the Rust engine before triggering full workspace analysis (`Analyze`).
  - Seamless session rollover: cleanly finalize current active session with status `'completed'`, append to `completedSessions`, and start the subsequent session with the new scan as its initial baseline.
  - Common Vulnerabilities policy: set entry threshold $K=3$ sessions (matching the 3-hour lab block).
  - Common Vulnerabilities sorting: sort entries descending by session count and active finding count.
  - Status bar / unobtrusive notification on hourly rollover.
- out of scope:
  - Scanner core changes (the Rust engine already accepts `{ type: 'Analyze', path: null }`).
  - Remote analytics synchronization.

## Proposed behavior

1. **Hourly Timer Lifecycle**:
   - When `activeSession` is initiated (upon the first settled save scan of the window), an hourly rollover timer is registered.
   - The timer fires every 60 minutes (`3,600,000 ms`).
   - If the extension is deactivated or the scanner stops, the timer is cleared.
2. **Rollover Execution**:
   - Flushes all pending editor updates to the engine (`flushAllPendingUpdates(session)`).
   - Sends `{ type: 'Analyze', path: null }` and awaits the full workspace finding results.
   - Invokes `processObservation()` to bring finding lifecycles up to date.
   - Calls `finalizeSession(activeSession, lifecycles, timestamp, 'completed')`.
   - Appends finalized session to `completedSessions` and persists synchronously to disk if needed.
   - Initializes a new `activeSession` (e.g. `session-002`) with the new findings as its baseline checkpoint.
   - Re-evaluates Session Metrics and Common Vulnerabilities.
   - Displays an unobtrusive status bar message: `"Ariadne: Hourly lab checkpoint completed (Hour N)"`.
3. **Common Vulnerabilities Sorting & Threshold**:
   - `COMMON_VULN_POLICY.K` updated to `3`.
   - `computeCommonVulnerabilities()` returns entries sorted descending:
     `b.sessionCount - a.sessionCount || b.activeFindingCount - a.activeFindingCount`.

## Acceptance criteria

- [ ] Hourly background timer initiates upon active session creation and disposes cleanly upon scanner stop/deactivation.
- [ ] At the 1-hour mark, a full workspace scan is dispatched and current session is finalized cleanly as `completed`.
- [ ] A new session immediately starts with the settled findings as its `baselineCheckpoint`.
- [ ] `COMMON_VULN_POLICY.K` is set to 3.
- [ ] Common Vulnerabilities list is sorted descending by frequency and active findings.
- [ ] All existing and new unit tests pass without regressions.

## Constraints

- technical: Zero modifications to the Rust scanner binary; must use existing stdio IPC protocol (`Analyze`).
- product: Rollover must be non-invasive—no modal dialogs or disruptive focus changes while a student is coding.
- delivery: Must be modular and testable with mock timers.

## Cross-repo impact

- scanner core: none
- bridge contract: none

## Risks and open questions

- risk: If a student is in the middle of typing when the 60-minute mark hits, an immediate scan might analyze partially typed code.
  - mitigation: Flush in-memory buffer before `Analyze` and run through the standard observation processing.

## Related docs

- plan: [2026-09-16-hourly-auto-full-scan.md](../plans/2026-09-16-hourly-auto-full-scan.md)
- task brief: [2026-09-16-hourly-auto-full-scan.md](../ai/tasks/2026-09-16-hourly-auto-full-scan.md)
