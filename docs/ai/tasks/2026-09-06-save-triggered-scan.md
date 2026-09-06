# Task Brief: Save-Triggered Scan with Initial Checkpoint Condition

- slug: save-triggered-scan
- created: 2026-09-06
- status: completed
- next action: none
- blockers: none
- spec: none
- plan: none
- branch: feature/save-triggered-scan
- assignee: Rence

## Summary

Implement the save-triggered scan path, the valid + 2-second settled gate, and the
first-scan / initial-checkpoint condition. Fully implemented in TypeScript — no Rust
scanner changes required.

Live edit scans (debounced) update Active Vulnerabilities and inline diagnostics only.
Save-triggered scans go through a two-gate check before driving lifecycle engine updates,
session baseline, and Session Metrics:
  1. **Valid**: the workspace revision is still the same as when the Analyze IPC was sent.
  2. **Settled**: no tracked-file change occurred during a 2-second idle window after
     the valid result arrived.

## Scope

**In scope (this task):**
- `revisionTracker.ts` (new) — `workspaceRevision` counter + `pendingSaveRequest` state
- `documentEvents.ts` — increments revision on all tracked-file mutations (change, create,
  delete, rename); cancels pending debounce on save; calls `onSaveTrigger(revision)` and
  `onRevisionChange(revision)` callbacks
- `extension.ts` — replaces boolean `saveScanPending` flag with full valid-gate +
  2-second settlement timer; `cancelSettlement()` helper fires on any revision change
- `sessionStore.ts` — adds `totalSettledCancellations` to `SaveScanState`
- Debug commands updated to show revision, timer status, and cancellation count

**Still out of scope (later overhaul tasks):**
- Scanner `requestId` / `reason` response envelope (Rust side)
- Recurring FLCs, baseline groups, F/P/T calculations
- Final-session scan at deactivation
- Pairwise T across completed sessions

## Cross-repo dependencies

None for this task. All changes are in the TypeScript extension.

## Files changed

- src/modules/detection/bridge/revisionTracker.ts (NEW)
- src/modules/detection/bridge/documentEvents.ts
- src/modules/tracker/storage/sessionStore.ts
- src/extension.ts
- docs/ai/decisions.md
- docs/ai/tasks/2026-09-06-save-triggered-scan.md

## Status

- [x] Branch created
- [x] Task brief created
- [x] Phase 1: boolean routing flag (commit f861263)
- [x] Phase 2: workspaceRevision + 2-second settlement gate
- [x] Compile check — tsc --noEmit exits 0
- [x] Finalize
