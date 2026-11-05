<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Resolved Toast Dedup

## Summary

- task: Deduplicate showResolvedToast so resolved notifications only fire for new resolution transitions rather than repeating across steady-state saves
- requested outcome: In 'milestones' mode, showResolvedToast only fires when findings newly transition into resolved state; steady-state resolved findings do not trigger repeat toasts on subsequent Ctrl+S saves; follow the established pattern used by newPersistingFindings
- primary constraint: Follow established patterns from candidate and persisting toasts; maintain quiet and all notification levels; do not break Session Metrics or scan pipeline

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: Antigravity
- next action: ready for review and merge
- blockers: none
- last checked: 2026-09-20

## Progress checklist

- [x] Add isNewResolved flag to FindingClassification and lifecycleEngine.ts
- [x] Add newResolvedFindings to SessionAnalysis and snapshotAnalyzer.ts
- [x] Update showResolvedToast, determinePrioritizedToast, and determineStackedToasts to gate on newResolvedFindings in milestones mode
- [x] Add unit tests verifying resolution transition firing vs steady-state suppression
- [x] Run validation commands (check-types, lint, test)

## Scope

- in scope: src/modules/tracker/analysis/lifecycleTypes.ts, src/modules/tracker/analysis/lifecycleEngine.ts, src/modules/tracker/analysis/analysisTypes.ts, src/modules/tracker/analysis/snapshotAnalyzer.ts, src/modules/tracker/analysis/candidateToasts.ts, src/modules/tracker/views/notificationToast.ts, src/test/candidateToast.test.ts, src/test/sessionMetrics.test.ts
- out of scope: scanner core modifications, UI layout changes in session metrics

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: team
- tester: team

## Relevant files

- src/modules/tracker/analysis/lifecycleTypes.ts
- src/modules/tracker/analysis/lifecycleEngine.ts
- src/modules/tracker/analysis/analysisTypes.ts
- src/modules/tracker/analysis/snapshotAnalyzer.ts
- src/modules/tracker/analysis/candidateToasts.ts
- src/modules/tracker/views/notificationToast.ts
- src/test/candidateToast.test.ts

## Acceptance criteria

- criterion 1: In 'milestones' mode (default), showResolvedToast only fires when an issue first transitions into resolved state (isNewResolved === true)
- criterion 2: Steady-state resolved issues do NOT trigger repeating toasts on subsequent full-scan saves (Ctrl+S) even after 60s cooldown expires
- criterion 3: When a genuinely new resolution occurs, showResolvedToast fires with the count of newly resolved patterns
- criterion 4: In 'all' mode, legacy cooldown-based repeating persists for debugging using resolvedThisSession
- criterion 5: In 'quiet' mode, no resolved toasts are displayed
- criterion 6: All existing unit tests and new notification tests pass cleanly

## Validation

- command 1: npm run check-types
- command 2: npm run lint
- command 3: npm test

## Risks or dependencies

- risk 1: Ensure Session Metrics panel's resolvedThisSession count is unaffected (it must remain cumulative for the session)

## Handoff notes

- notes for the next agent: Follows the exact pattern of isNewPersisting / newPersistingFindings
