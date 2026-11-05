<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Non Invasive Toast Notifications

## Summary

- task: Make toast notifications non-invasive by gating Persisting alerts to first-time transitions, preventing multi-toast stacking, and adding a notification verbosity setting
- requested outcome: Persisting toasts only fire once when a vulnerability transitions into persisting (no 60s repeating loop); at most 1 toast per save scan; ariadne.notifications.level setting ('milestones' | 'all' | 'quiet')
- primary constraint: Maintain existing candidate, recurring, and resolved toast coverage without regression

## Linked artifacts

- spec: none
- plan: docs/plans/2026-09-18-non-invasive-toast-notifications.md

## Current state

- status: completed
- current owner: Antigravity
- next action: ready for review and merge
- blockers: none
- last checked: 2026-09-18

## Progress checklist

- [x] Merge origin/fix/mock-uat-bug-fix into feat/candidate-toast
- [x] Add isNewPersisting to FindingClassification and lifecycleEngine.ts
- [x] Add newPersistingFindings to SessionAnalysis and snapshotAnalyzer.ts
- [x] Add ariadne.notifications.level to package.json ('milestones', 'all', 'quiet')
- [x] Update notificationToast.ts with setting reader, transition-only gating, and priority single-toast dispatcher
- [x] Add unit tests in candidateToast.test.ts
- [x] Validate typecheck, lint, and full test suite

## Scope

- in scope: notificationToast.ts, lifecycleEngine.ts, lifecycleTypes.ts, analysisTypes.ts, snapshotAnalyzer.ts, package.json, candidateToast.test.ts
- out of scope: scanner core modifications, Session Metrics UI layout changes

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: RENCE / ERVIN
- tester: ERVIN

## Relevant files

- src/modules/tracker/analysis/lifecycleTypes.ts
- src/modules/tracker/analysis/lifecycleEngine.ts
- src/modules/tracker/analysis/analysisTypes.ts
- src/modules/tracker/analysis/snapshotAnalyzer.ts
- src/modules/tracker/views/notificationToast.ts
- package.json
- src/test/candidateToast.test.ts

## Acceptance criteria

- criterion 1: In 'milestones' mode (default), persisting toasts only fire when an issue first transitions into persisting state (isNewPersisting === true)
- criterion 2: Steady-state persisting issues do NOT trigger repeating toasts every 60s
- criterion 3: When multiple categories qualify on a single save, at most one prioritized toast is shown (Recurring > Resolved > Fix Applied / Absent Candidate > New Candidate > Newly Persisting)
- criterion 4: In 'quiet' mode, no popup toasts are displayed
- criterion 5: In 'all' mode, legacy cooldown-based repeating persists for debugging
- criterion 6: All existing unit tests and new notification tests pass cleanly

## Validation

- command 1: npm run check-types
- command 2: npm run lint
- command 3: npm test

## Risks or dependencies

- risk 1: Initial session scan should alert on existing persisting patterns so developer is aware of issues present at start of session

## Handoff notes

- notes for the next agent: ariadne.notifications.level controls notification verbosity. Defaults to 'milestones'.

