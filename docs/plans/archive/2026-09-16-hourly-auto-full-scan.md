# Hourly Auto Full Scan Implementation Plan

**Goal:** Implement an hourly automated full-workspace scan and seamless session rollover mechanism in the VS Code extension, update Common Vulnerabilities policy threshold to $K=3$, and sort common vulnerabilities descending.

**Architecture:**
- Background timer managed in `src/extension.ts` (cleared on stop/deactivation).
- On timer tick, flushes editor buffers via `flushAllPendingUpdates(session)` and sends `{ type: 'Analyze', path: null }`.
- Processes observation via `lifecycleEngine.processObservation()`, finalizes active session as `'completed'`, appends to `completedSessions`, and seamlessly initializes the next session with the settled snapshot as its baseline.
- Updates `COMMON_VULN_POLICY.K` to `3` in `commonVulnerabilities.ts` and sorts output by `sessionCount` and `activeFindingCount` descending.
- Adds comprehensive unit tests for sorting, $K=3$ threshold, and hourly rollover lifecycle.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js Timers, Mocha/Assert.

---

## References

- spec: [2026-09-16-hourly-auto-full-scan.md](../specs/2026-09-16-hourly-auto-full-scan.md)
- task brief: [2026-09-16-hourly-auto-full-scan.md](../ai/tasks/2026-09-16-hourly-auto-full-scan.md)

## Steps

- [ ] Step 1: Update `commonVulnerabilities.ts` — set `COMMON_VULN_POLICY.K = 3` and sort common entries descending.
- [ ] Step 2: Implement hourly auto full scan and session rollover in `extension.ts`, with timer management and clean disposal.
- [ ] Step 3: Update and expand unit tests in `sessionMetrics.test.ts` and `lifecycleEngine.test.ts`.
- [ ] Step 4: Record ADR in `docs/ai/decisions.md`.
- [ ] Step 5: Validate with `npm test`, `npm run lint`, and `npm run compile`.

## Validation

- [ ] `npm test` passes all test suites.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run compile` completes cleanly.

## Risks

- Long-running timer in Extension Host: mitigated by unreferencing/disposing timer handles in `deactivate()` and on `stopScanner`.

## Handoff notes

- The hourly interval constant (`HOURLY_SCAN_INTERVAL_MS = 60 * 60 * 1000`) is exported or exposed for testing so unit tests can invoke the rollover logic with accelerated or mock timestamps.
