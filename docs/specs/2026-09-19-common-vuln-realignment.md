# Spec: Common Vuln Realignment

## Purpose

Realign the Common Vulnerabilities engine with the 3-hour lab session model using hybrid presence counting for the $K=3$ threshold and enforce a strict post-fix probation period for the $G=2$ graduation requirement.

## Scope

- in scope:
  - `computeCommonVulnerabilities` counting and graduation logic in `src/modules/tracker/analysis/commonVulnerabilities.ts`
  - Per-type clean session verification across completed sessions (verifying no active instances in `lifecycleSummaries`, no active instances in `hourlyCheckpoints`, and no new instances in `csNewTypes`)
  - Prevention of premature graduation during inactive sessions with persisting findings
  - Sorting by `totalInstanceCount` descending
  - Unit test coverage in `src/test/sessionMetrics.test.ts`
- out of scope:
  - Scanner core communication or bridge contract changes
  - Storage migration (preserves existing `TypeGraduationState` schema)

## Proposed behavior

1. **Threshold K=3 Counting**:
   - Increments whenever a vulnerability type is present in a milestone (hourly checkpoint or session final state).
   - Persisting findings carried across 3 hourly milestones qualify for K=3.
   - `totalInstanceCount` accurately reflects distinct FLC instances without inflation from milestone presence.
2. **Graduation G=2 Post-Fix Probation**:
   - A type graduates only when BOTH:
     1. `allResolved`: All current FLCs of that type in `currentLifecycles` have non-null `durableResolutionAt`.
     2. `consecutiveClean >= G (2)`: Walking backwards from the most recent completed session, G consecutive sessions must each be confirmed clean for that type:
        - `!csNewTypes[i].has(key)`: No new instance was detected during the session.
        - `!cs.lifecycleSummaries.some(...)`: No instance of this type was active (`durableResolutionAt === null && missingSince === null`) at session end.
        - `!(cs.hourlyCheckpoints ?? []).some(...)`: No instance of this type was active during any hourly checkpoint in the session.
   - If any condition is violated for a completed session, the clean streak breaks immediately.
   - Sessions at or before a prior graduation index (`countFrom`) are ignored.

## Acceptance criteria

- [x] Milestone presence counts toward K=3 threshold.
- [x] Persisting instances do not inflate `totalInstanceCount`.
- [x] Inaction on an active finding across G sessions does NOT graduate immediately upon resolution.
- [x] Graduation occurs only after G consecutive clean completed sessions post-fix.
- [x] Active hourly checkpoints in a completed session prevent that session from being counted as clean.
- [x] Cards sort primarily by `totalInstanceCount` descending, secondarily by `sessionCount` descending.

## Constraints

- technical: Pure computation in `commonVulnerabilities.ts` without VS Code API imports.
- product: Consistent with the 3-hour weekly laboratory model.
- delivery: No breaking storage changes.

## Cross-repo impact

- scanner core: none
- bridge contract: none

## Risks and open questions

- risk 1: Synthetic sessions in legacy unit tests with missing checkpoint arrays. Mitigated with nullish coalescing `cs.hourlyCheckpoints ?? []`.

## Related docs

- plan: [2026-09-19-common-vuln-realignment.md](../plans/2026-09-19-common-vuln-realignment.md)
- task brief: [2026-09-19-common-vuln-realignment.md](../ai/tasks/2026-09-19-common-vuln-realignment.md)
