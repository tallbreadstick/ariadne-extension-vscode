# Common Vuln Realignment Implementation Plan

**Goal:** Implement hybrid presence counting for K=3 entry threshold and post-fix clean session verification for G=2 graduation.

**Architecture:** Pure TypeScript calculation in `commonVulnerabilities.ts` that consumes `SessionRecord[]`, active session checkpoints, and live `FindingLifecycleRecord[]` to evaluate K presence and G graduation with true post-fix probation.

**Tech Stack:** TypeScript, Mocha, VS Code Extension Test Runner.

---

## References

- spec: [2026-09-19-common-vuln-realignment.md](../specs/2026-09-19-common-vuln-realignment.md)
- task brief: [2026-09-19-common-vuln-realignment.md](../ai/tasks/2026-09-19-common-vuln-realignment.md)

## Steps

- [x] Implement hybrid counting in `computeCommonVulnerabilities()` (presence for K, distinct FLCs for totalInstanceCount)
- [x] Implement clean completed session verification in Phase 3 graduation check (checking active summaries, active checkpoints, and new instances)
- [x] Fix missing `totalInstanceCount` mock fields in `sessionMetrics.test.ts`
- [x] Add unit tests for inactive session resolution, post-fix probation, and checkpoint awareness
- [x] Update ADR in `decisions.md`

## Validation

- [x] `npx tsc --noEmit`
- [x] `npm run compile-tests`
- [x] `npm run lint`
- [x] `npm run workflow -- check`

## Risks

- Legacy test fixtures lacking `hourlyCheckpoints`: addressed using optional chaining and defaults.

## Handoff notes

- Graduation now strictly requires G clean completed sessions after all instances are resolved. Resolving an active vulnerability within an active session will not graduate it until subsequent sessions run cleanly.
