<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Hourly Auto Full Scan

## Summary

- task: Implement hourly auto full scan and seamless session rollover, update K=3 threshold, and sort common vulnerabilities descending
- requested outcome: Align observation sessions with 1-hour instructional blocks so students can see their Common Vulnerabilities within a single 3-hour weekly lab class
- primary constraint: Pure TypeScript/VS Code changes; zero modifications to private Rust scanner core

## Linked artifacts

- spec: docs/specs/2026-09-16-hourly-auto-full-scan.md
- plan: docs/plans/2026-09-16-hourly-auto-full-scan.md

## Current state

- status: completed
- current owner: ABEL
- next action: Ready for review and merge into feat/session-finding-records
- blockers: none
- last checked: 2026-09-16

## Progress checklist

- [x] Update COMMON_VULN_POLICY.K to 3 in commonVulnerabilities.ts
- [x] Sort Common Vulnerabilities descending by session count and active count
- [x] Implement hourly scan interval and seamless session rollover in extension.ts
- [x] Update unit tests in sessionMetrics.test.ts
- [x] Record ADR in decisions.md
- [x] Validate with npm test, npm run lint, npm run compile

## Scope

- in scope: Hourly timer, auto full scan dispatch, seamless session finalization and new session initialization, Common Vulnerabilities K=3 and descending sort, status bar notification
- out of scope: Remote cloud sync, scanner binary modifications

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: ABEL
- implementer: ABEL
- reviewer: ABEL
- tester: ABEL

## Relevant files

- src/modules/tracker/analysis/commonVulnerabilities.ts
- src/modules/tracker/views/sessionMetrics.ts
- src/extension.ts
- src/test/sessionMetrics.test.ts

## Acceptance criteria

- Timer fires every 60 minutes when active session is running
- Auto scan finalizes current session as completed and starts next session with new findings as baseline
- Common Vulnerabilities K threshold set to 3
- Common Vulnerabilities list sorted descending
- All unit tests pass cleanly

## Validation

- npm test
- npm run lint
- npm run compile

## Risks or dependencies

- Timer handles must be disposed cleanly on deactivation to prevent memory leaks

## Handoff notes

- Rollover uses existing finalizeSession and startSession methods in lifecycleEngine
