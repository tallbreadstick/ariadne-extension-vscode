# Task Brief: Save-Triggered Scan with Initial Checkpoint Condition

- **slug**: save-triggered-scan
- **created**: 2026-09-06
- **status**: in-progress
- **branch**: feature/save-triggered-scan
- **assignee**: Rence

## Summary

Implement the save-triggered scan path and the first-scan / initial-checkpoint condition.

Live edit scans (debounced) continue to update Active Vulnerabilities and inline diagnostics.
Save-triggered scans drive lifecycle engine updates, session baseline, and Session Metrics.

## Scope

**In scope:**
- onDidSaveTextDocument handler in documentEvents.ts sends Analyze IPC + triggers save callback
- saveScanPending flag in extension.ts to route onFindings results
- Initial-checkpoint condition: baseline set only on first save-triggered result
- SaveScanState persistence (initialCheckpointDoneAt, totalSaveScansThisSession)
- Two debug commands: Show Save Scan State, Reset Save Scan State

**Out of scope:**
- workspaceRevision tracking
- requestId / reason scanner envelope
- 2-second settlement window
- Recurring FLCs, F/P/T calculations

## Cross-repo dependencies

None for this task.

## Files changed

- src/modules/detection/bridge/documentEvents.ts
- src/modules/tracker/storage/storageKeys.ts
- src/modules/tracker/storage/sessionStore.ts
- src/extension.ts
- package.json
- docs/ai/decisions.md

## Status

- [x] Branch created
- [x] Task brief created
- [ ] Implementation
- [ ] Compile check
- [ ] Finalize
