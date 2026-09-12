# Spec: Synchronous Shutdown Persistence

## Purpose

Ensure session finalization state (`status = 'completed'` or `'incomplete'`) persists reliably across VS Code window closures and deactivations by writing a synchronous local snapshot during `deactivate()` that is safely imported into `workspaceState` upon next activation.

## Scope

- in scope:
  - Synchronous disk flush (`fs.writeFileSync`) in `SessionStore` targeting `context.storageUri` / `context.globalStorageUri`.
  - Startup recovery of pending finalized session files.
  - Updating `extension.ts` deactivation handler to write the synchronous snapshot before shutting down the Rust engine.
  - Distinguishing clean shutdowns (`completed`) from mid-scan crashes or un-settled edits (`incomplete`).
- out of scope:
  - Scanner core Rust binary modifications.
  - Live scan debounce and 2s save settlement rules.
  - Formula calculations for F, P, and T.

## Proposed behavior

1. When `deactivate()` runs:
   - Case A (Clean workspace): The session is finalized as `'completed'`. It immediately calls `store.saveFinalizedSessionSync(finalized)`, which synchronously writes `finalized-session.json` to `context.storageUri`. It also issues non-blocking async `workspaceState` updates and terminates the engine process (`session.kill()`).
   - Case B (Dirty workspace): It flushes editor buffers to the engine and awaits a final scan (up to 4000ms).
     - If the scan succeeds, the session is finalized as `'completed'` and synchronously written to `finalized-session.json`.
     - If the scan fails, times out, or is cancelled, the session is finalized as `'incomplete'` and synchronously written to `finalized-session.json`.
   - Node's synchronous file I/O executes in <1ms and does not depend on the VS Code main-thread RPC channel, avoiding the shutdown hang.
2. When the extension activates (`activate()`):
   - `SessionStore.recoverPendingFinalizedSession()` checks if `finalized-session.json` exists in `context.storageUri`.
   - If present: reads the JSON record, appends it to `completedSessions` in `workspaceState`, clears `activeSession`, and deletes `finalized-session.json`.
   - If not present: checks if an un-cleared `activeSession` exists (e.g. from an abrupt OS kill or power outage before `deactivate()` could run), and recovers it as `'incomplete'` per Section 9 of the trends framework.

## Acceptance criteria

- [ ] Clean deactivation (`currentRev === lastSettledRevision && !hasDirtyTrackedDocs`) persists `finalized-session.json` synchronously with `status: 'completed'`.
- [ ] On next activation, the clean session is recovered into `completedSessions` with `status: 'completed'`.
- [ ] Dirty deactivation with aborted/failed final scan persists `finalized-session.json` synchronously with `status: 'incomplete'`.
- [ ] On next activation, the dirty/aborted session is recovered into `completedSessions` with `status: 'incomplete'`.
- [ ] Unit tests verify synchronous serialization, file cleanup, and status assignment.

## Constraints

- technical: Must not block deactivation for more than 1ms for the file write; must handle cases where `context.storageUri` is undefined (fallback to `context.globalStorageUri`).
- product: Clean sessions must be recorded as `completed` so the Trend metric ($T$) has valid comparison baseline records.
- delivery: Zero changes to public extension APIs or Rust IPC protocol.

## Cross-repo impact

- scanner core: none
- bridge contract: none

## Risks and open questions

- risk: If storage directory permissions prevent writing to `storageUri`, must catch error and log a warning without crashing deactivation.

## Related docs

- task brief: [2026-09-12-eager-settled-persistence.md](../ai/tasks/2026-09-12-eager-settled-persistence.md)
- architecture decisions: [decisions.md](../ai/decisions.md)
