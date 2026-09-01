# Fingerprint Phase 1 Implementation Plan

**Goal:** Compute extension-only finding fingerprints from queued sent buffers, without scanner or SessionStore format changes.

**Architecture:** Keep hashing in `src/modules/detection/bridge/fingerprint.ts` (vscode-free). `documentEvents.ts` owns the live-buffer tracker and enqueues on analysis-triggering IPC. `extension.ts` dequeues on `onFindings` and calls `fingerprintScan`. Hashes stay in memory; existing panels keep using unfingerprinted findings.

**Tech Stack:** TypeScript, Node `crypto`, Mocha TDD UI (`npm run test:unit`), `npm run compile`.

---

## References

- spec: [2026-08-31-fingerprint-phase-1.md](../specs/2026-08-31-fingerprint-phase-1.md)
- task brief: [2026-08-31-fingerprint-phase-1.md](../ai/tasks/archive/2026-08-31-fingerprint-phase-1.md)

## Steps

- [x] Write unit tests for relative path, enclosing path, FIFO tracker, hashes, ambiguity, ineligibility
- [x] Implement `fingerprint.ts` (canonical strings, SHA-256, heuristic enclosing path, ineligibility)
- [x] Thread `AnalysisBufferTracker` through `documentEvents.ts`; enqueue on Init / Create / Delete / Rename / Update
- [x] Wire `fingerprintScan` in `onFindings`; log counts only; do not persist hashes
- [x] Record post-MVP decision, architecture data-flow note, TDD evidence
- [x] Validate with `npm run test:unit` and `npm run compile`

## Validation

- [x] `npm run test:unit` (23 passing)
- [x] `npm run compile`

## Risks

- risk 1: Line-slice collisions under the same continuity key (mitigation: mark the scan ambiguous)
- risk 2: FIFO desync (mitigation: missing snapshot → ineligible, do not guess)
- risk 3: `Init` empty snapshot (accepted; do not hash later `OpenFile` text)

## Handoff notes

- anything the next agent needs to know: Fingerprints are not in workspaceState. Do not change the scanner. Treat ambiguous continuity keys as inconclusive. `onFindings` remains unqueued SessionStore read-modify-write. Spec and plan were added after implementation because the first pass under-classified the work as brief-only.
