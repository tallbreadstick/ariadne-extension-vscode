<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Fix Reintroduced Common Vuln Blank Instance

## Summary

- task: Prevent reintroduced vulnerabilities from erroneously triggering Improving Trends and rendering a blank instance with count (`— 1`)
- requested outcome: Reintroduced vulnerabilities appear exclusively under Recurring Patterns and never leak into Improving Trends
- primary constraint: Pure TypeScript tracker changes; preserve type-level improving detection for genuine partial-fix persisting instances

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: ABEL
- next action: open PR to fix/mock-uat-bug-fix
- blockers: none
- last checked: 2026-09-16

## Progress checklist

- [x] Update type-level improving detection in snapshotAnalyzer.ts to ignore recurring findings
- [x] Align buildCurrentSessionMetrics fallback in extension.ts to ignore recurring findings for improving trends
- [x] Safeguard buildImprovingSubItems in sessionMetrics.ts against rendering placeholders when items array is empty
- [x] Add unit test in sessionMetrics.test.ts verifying a reintroduced vulnerability only surfaces under recurringPatterns
- [x] Validate with npm test, npm run lint, and npm run workflow -- check

## Scope

- in scope: Correcting type-level aggregation for improving trends; ensuring recurring findings do not increment improvingTrends; safeguarding view rendering against empty sub-items
- out of scope: Changing lifecycle state transition rules or Common Vulnerabilities graduation thresholds

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: ABEL
- implementer: ABEL
- reviewer: ABEL
- tester: ABEL

## Relevant files

- src/modules/tracker/analysis/snapshotAnalyzer.ts
- src/extension.ts
- src/modules/tracker/views/sessionMetrics.ts
- src/test/sessionMetrics.test.ts

## Acceptance criteria

- Reintroducing a previously resolved or graduated vulnerability increments recurringPatterns and populates recurringItems
- Reintroducing a previously resolved or graduated vulnerability does NOT increment improvingTrends
- Improving Trends card never renders a blank placeholder (`— 1`) when no improving instances exist
- All unit tests pass cleanly

## Validation

- npm test
- npm run lint
- npm run workflow -- check

## Risks or dependencies

- Type-level improving detection must still work correctly for types with genuine partial progress (e.g. 2 persisting, 1 resolved)

## Handoff notes

- The bug was triggered because commit 723ed8e treated 'recurring' findings as active for improving checks without converting them in deltas
