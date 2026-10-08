# Task B6 Common Vuln Graduation Toasts

## Summary

- task: Implement Common Vulnerabilities Graduation Toast Notifications (Task B6 refinement)
- requested outcome: Two informational toast notifications: (1) Pre-graduation warning toast in the session before disappearance ("graduating soon"), (2) Final graduation toast when the common vulnerability item disappears from the Common Vulnerabilities list. No gamification.
- primary constraint: No gamification (no points/XP/badges). Informational VS Code toasts. Persistent deduplication via graduationHistory so toasts fire exactly once per transition/session.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: agent
- next action: ready for review and commit
- blockers: none
- last checked: 2026-10-08

## Progress checklist

- [x] Add GraduationToastEvents and graduation toast detection logic in commonVulnerabilities.ts
- [x] Add toast message formatters in candidateToasts.ts (or commonVulnerabilities.ts)
- [x] Add toast display handlers in notificationToast.ts
- [x] Wire graduation toast triggering into extension.ts scan pipeline
- [x] Add comprehensive unit tests in test suite
- [x] Validate tests pass and brief checks clean

## Scope

- in scope:
  - Pre-graduation warning toast ("on track to graduate") 1 session before disappearance
  - Graduation toast when common vulnerability disappears
  - Deduplication via TypeGraduationState in sessionStore / workspaceState
  - Unit tests covering 1-session-before and final disappearance transitions
- out of scope:
  - Gamification (XP, badges, points, trophies)

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/tracker/analysis/commonVulnerabilities.ts
- src/modules/tracker/analysis/candidateToasts.ts
- src/modules/tracker/views/notificationToast.ts
- src/extension.ts
- src/test/sessionMetrics.test.ts
- src/test/candidateToast.test.ts

## Acceptance criteria

- criterion 1: Pre-graduation toast fires when all instances of a common vulnerability are resolved and consecutive clean sessions equals G - 1.
- criterion 2: Graduation toast fires when a common vulnerability reaches G clean sessions and disappears from Common Vulnerabilities.
- criterion 3: Toasts do not spam on repeated saves within the same session or across VS Code restarts.
- criterion 4: All tests pass with 0 failures.

## Validation

- command 1: npm.cmd run compile
- command 2: npm.cmd test
- command 3: npm.cmd run workflow -- check

## Risks or dependencies

- risk 1: Accidental toast spam if session index or notification flag is not persisted in graduationHistory. Mitigated by persisting notifiedGraduatingSoonSessionIndex and notifiedGraduatedSessionIndex in TypeGraduationState.

## Handoff notes

- notes for the next agent: Follow Ponytail decision ladder and no-gamification mandate.

