<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Recurring → Persisting Transition

## Summary

- task: Enable recurring findings to transition to persisting when they meet the persisting time and confirmation thresholds
- requested outcome: A finding that recurs after durable resolution is initially classified as 'recurring', then graduates to 'persisting' once it has re-established itself (≥ 30s observed age, ≥ 2 settled confirmations)
- primary constraint: Preserve recurrenceCount so downstream consumers (metrics panel, notifications) can still tell the finding has a recurrence history

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: RENCE
- next action: ready for commit and push
- blockers: none
- last checked: 2026-09-11

## Progress checklist

- [x] Update `classifyFinding()` in `lifecycleEngine.ts` to allow recurring → persisting transition
- [x] Update existing test in section 6 for long-lived recurrence (now expects 'persisting')
- [x] Add test for short-lived recurrence (stays 'recurring')
- [x] Update section 9 direct `classifyFinding` verification for new behavior
- [x] Add section 11: Recurring → Persisting transition tests (end-to-end and direct)
- [x] Verify compilation, type-check, and lint via `npm run compile`
- [x] Validate task brief with `npm run workflow -- check`

## Scope

- in scope: `classifyFinding()` logic in `lifecycleEngine.ts`, test updates in `lifecycleEngine.test.ts`
- out of scope: F/P/T calculations, presentation layer changes (recurring count is already wired from previous task)

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: RENCE
- implementer: RENCE
- reviewer: ABEL / ZYDRIC
- tester: RENCE

## Relevant files

- `src/modules/tracker/analysis/lifecycleEngine.ts`: Classification logic
- `src/test/lifecycleEngine.test.ts`: Lifecycle engine tests

## Acceptance criteria

- A finding that recurs but has NOT met persisting thresholds (< 30s age or < 2 confirmations) is classified as `'recurring'`
- A finding that recurs AND has met persisting thresholds (≥ 30s age AND ≥ 2 confirmations) is classified as `'persisting'`
- `recurrenceCount` is never cleared — preserved for downstream use
- All existing tests pass with updated expectations
- Clean type-check and lint

## Validation

- `npm run compile`
- `npm run workflow -- check`

## Risks or dependencies

- Threshold semantics: observedAge uses `firstConfirmedAt` (original detection), not recurrence timestamp — this means long-lived findings that recur may quickly meet the thresholds
- Presentation impact: the Session Metrics panel's "Recurring Patterns" count comes from `analysis.recurringPatterns` in snapshotAnalyzer, which counts deltas with `status === 'recurring'`. After this change, a finding that graduated to persisting will no longer appear in the recurring count — it will appear in the persisting count instead. This is correct behavior.

## Handoff notes

- The change is a single ternary expression in `classifyFinding()`. The function already computes `meetsThresholds` before the recurring check, so the only addition is `return meetsThresholds ? 'persisting' : 'recurring'` instead of `return 'recurring'`.
