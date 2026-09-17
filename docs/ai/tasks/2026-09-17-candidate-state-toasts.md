<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Candidate State Toasts

## Summary

- task: Implement state-transition toast notifications for Candidate findings during full-scan saves
- requested outcome: Separate toast notifications for (1) new vulnerability -> Candidate transition, and (2) previously detected vulnerability -> Candidate transition (disappearance)
- primary constraint: Split into two separate commits; do not modify or interfere with existing toast notifications (resolved, persisting, recurring, improving)

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: in progress
- current owner: agent
- next action: implement Commit 1 (new-vulnerability -> Candidate toast)
- blockers: none
- last checked: 2026-09-17

## Progress checklist

- [x] Commit 1: Track previousState in FindingClassification and add new-vulnerability -> Candidate toast
- [x] Commit 1: Add unit tests for new-vulnerability -> Candidate toast
- [x] Commit 1: Verify typecheck, lint, and tests, then commit
- [ ] Commit 2: Add previously detected vulnerability -> Candidate toast on absence
- [ ] Commit 2: Add unit tests for absence -> Candidate toast
- [ ] Commit 2: Verify typecheck, lint, and tests, then commit

## Scope

- in scope:
  - Preserving previousState in FindingClassification during processObservation
  - Adding newCandidateFindings and absentCandidateFindings to SessionAnalysis
  - Implementing showNewCandidateToast and showAbsentCandidateToast in notificationToast.ts with independent cooldowns
  - Maintaining all existing toasts untouched
  - Unit tests
- out of scope:
  - Changes to scanner core
  - Changes to public taxonomy or Trends card display

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/tracker/analysis/lifecycleTypes.ts: FindingClassification interface
- src/modules/tracker/analysis/lifecycleEngine.ts: processObservation state recording
- src/modules/tracker/analysis/analysisTypes.ts: SessionAnalysis fields
- src/modules/tracker/analysis/snapshotAnalyzer.ts: buildSessionAnalysis candidate grouping
- src/modules/tracker/views/notificationToast.ts: candidate toast builders
- src/extension.ts: save-scan settlement wiring
- src/test/notificationToast.test.ts: unit tests

## Acceptance criteria

- criterion 1: A toast notification appears when a new vulnerability transitions to Candidate ("A new vulnerability has been detected. Checking validity...")
- criterion 2: A separate toast notification appears when a previously detected active vulnerability transitions to Candidate due to absence ("Vulnerability is no longer detected. Resolution status is being processed...")
- criterion 3: Neither toast fires repeatedly on subsequent save scans while remaining in Candidate state
- criterion 4: Existing toast notifications (showResolvedToast, showPersistingToast, showRecurringToast, showImprovingToast) are not modified or interfered with
- criterion 5: The implementation is delivered across two separate git commits

## Validation

- command 1: npm.cmd run check-types
- command 2: npm.cmd run lint
- command 3: npm.cmd run compile-tests
- command 4: npm.cmd run workflow -- check

## Risks or dependencies

- risk 1: none
- dependency 1: none

## Handoff notes

- notes for the next agent: Two commits required by user. Commit 1 is new-vulnerability -> Candidate; Commit 2 is previously detected -> Candidate.

