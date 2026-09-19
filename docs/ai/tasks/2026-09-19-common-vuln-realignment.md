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

- status: completed
- current owner: Antigravity
- next action: Review walkthrough with user
- blockers: none
- last checked: 2026-09-20

## Progress checklist

- [x] Rewrite computeCommonVulnerabilities() with hybrid presence counting & totalInstanceCount
- [x] Implement post-fix probation graduation (allResolved + G clean completed sessions)
- [x] Enforce clean completed session check (no active findings in summaries or checkpoints, no new instances)
- [x] Prevent active-session born & resolved findings from prematurely graduating before G clean completed sessions
- [x] Exclude findings resolved prior to session start from milestone presence counting
- [x] Guard against resurrection of graduated vulnerabilities as "All Resolved"
- [x] Persist graduation history in buildCurrentSessionMetrics()
- [x] Update module doc comments and strategy description
- [x] Update unit tests (reproduction test for inaction, post-fix probation, checkpoint awareness, active-session born/resolved, resurrection prevention)
- [x] Record ADR in decisions.md
- [x] Validate: check-types, compile-tests, lint, test execution

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

- [x] Milestone presence counts toward K=3 threshold
- [x] Distinct FLC count tracked in totalInstanceCount without inflation
- [x] Graduation requires BOTH allResolved AND consecutiveClean >= G
- [x] Active instances in summaries or checkpoints prevent graduation even across inactive sessions
- [x] Resolving after G sessions of inaction does NOT graduate immediately
- [x] Recurring findings (same fingerprint) do not inflate count

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
