<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Live Scan Observability

## Summary

- task: live scan observability and save-flush safeguard
- requested outcome: provide clear console logging and UI state indicators for live-scanned findings, and prevent in-flight document edits from being lost on immediate save
- primary constraint: zero regression to session settlement and 1-to-1 lifecycle tracking

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: in progress
- current owner: Antigravity
- next action: test in extension development host with test project
- blockers: none
- last checked: 2026-09-10T21:18:00+08:00

## Progress checklist

- [x] Create feature branch `feature/live-scan-observability`
- [x] Scaffold workflow task brief
- [x] Create implementation plan artifact
- [x] Implement save-flush safeguard in `documentEvents.ts`
- [x] Implement live scan console logging in `extension.ts`
- [x] Add live scan status indicator in `activeVulnerabilities.ts`
- [x] Run test suite and linter validation
- [x] Run `npm run workflow -- check`

## Scope

- in scope:
  - debounced update scheduling logs and live scan findings logging
  - flushing pending buffer updates to Rust engine before sending `Analyze` on save
  - live scan text indicator in Active Vulnerabilities panel
- out of scope:
  - changes to private scanner repository
  - changes to lifecycle state machine logic

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: Abel / Ervin / Rence
- tester: Antigravity / Rence

## Relevant files

- file or directory 1: src/modules/detection/bridge/documentEvents.ts
- file or directory 2: src/extension.ts
- file or directory 3: src/modules/presentation/views/activeVulnerabilities.ts

## Acceptance criteria

- criterion 1: Live scans emit visible console logs with finding counts in debug console
- criterion 2: Typing and immediately saving does not drop dirty buffer edits
- criterion 3: Left panel visually reflects live scan status
- criterion 4: All existing mocha unit tests pass cleanly
