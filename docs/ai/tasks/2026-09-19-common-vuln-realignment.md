<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Common Vuln Realignment

## Summary

- task: Redesign Common Vulnerabilities counting and graduation logic
- requested outcome: Session counting only increments on new-instance detection; graduation requires both all-resolved AND no-new-instances for G=2 sessions
- primary constraint: No storage migration; TypeGraduationState shape unchanged

## Linked artifacts

- spec: docs/specs/2026-09-19-common-vuln-realignment.md
- plan: docs/plans/2026-09-19-common-vuln-realignment.md

## Current state

- status: in progress
- current owner: Antigravity
- next action: Validate test results
- blockers: none
- last checked: 2026-09-19

## Progress checklist

- [x] Rewrite computeCommonVulnerabilities() with fingerprint-based counting
- [x] Implement prevention-aware graduation (allResolved + noNewInstancesForG)
- [x] Update module doc comments and strategy description
- [x] Update unit tests (persisting doesn't inflate, new instances count, graduation tests)
- [x] Record ADR in decisions.md
- [ ] Validate: check-types, lint, test (in progress)

## Scope

- in scope: commonVulnerabilities.ts counting logic, graduation logic, unit tests, ADR
- out of scope: Panel rendering (sessionMetrics.ts), snapshotAnalyzer.ts mapping, K/G constant values

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: User
- tester: Antigravity

## Relevant files

- src/modules/tracker/analysis/commonVulnerabilities.ts
- src/test/sessionMetrics.test.ts
- docs/ai/decisions.md

## Acceptance criteria

- A single persisting finding across 3 milestones does NOT reach K=3
- Three distinct fingerprints across 3 milestones DO reach K=3
- Graduation requires BOTH allResolved AND consecutiveNoNew >= G
- Active instances prevent graduation even with clean sessions
- Recurring findings (same fingerprint) do not inflate count

## Validation

- npm run check-types
- npm run lint
- npm test

## Risks or dependencies

- risk: Hourly checkpoint comparison requires logicalFingerprint on ObservedFinding (confirmed available)
- dependency: none

## Handoff notes

- No storage migration needed — old graduation history is still valid
- The new logic applies stricter graduation conditions going forward
