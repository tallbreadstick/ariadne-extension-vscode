<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Async Deactivation Scan

## Summary

- task: Implement asynchronous onDeactivation scan, buffer flushing, and graceful session finalization
- requested outcome: Cleanly finalize active sessions on extension deactivation with status 'completed' (or 'incomplete' if finalization fails/times out), flushing dirty editor buffers and honoring VS Code's shutdown constraints
- primary constraint: Respect VS Code's 5-second shutdown limit with a 3000ms safety timeout; never fabricate metrics on dirty or un-settled workspaces

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: in progress
- current owner: Abel (Antigravity)
- next action: implement models and deactivation handler
- blockers: none
- last checked: 2026-09-11

## Progress checklist

- [x] Fast-forward merge live-scan-observability into local branch
- [x] Create branch feature/async-deactivation-scan
- [x] Add SessionStatus ('active' | 'completed' | 'incomplete') to lifecycleTypes.ts
- [x] Update startSession and finalizeSession in lifecycleEngine.ts
- [x] Export buffer flush & timer cancellation utilities in documentEvents.ts
- [x] Implement async deactivate() handler in extension.ts
- [x] Add unit tests for session finalization status transitions
- [x] Validate: npm run check-types && npm run lint

## Scope

- in scope: extension.ts deactivate(), lifecycleTypes.ts, lifecycleEngine.ts, documentEvents.ts, unit tests
- out of scope: T trend comparison calculations (Ervin & Kenn's task), scanner core modifications

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Abel (Antigravity)
- implementer: Abel (Antigravity)
- reviewer: Ervin
- tester: Abel & Rence

## Relevant files

- src/modules/tracker/analysis/lifecycleTypes.ts
- src/modules/tracker/analysis/lifecycleEngine.ts
- src/modules/detection/bridge/documentEvents.ts
- src/extension.ts
- src/test/lifecycleEngine.test.ts

## Acceptance criteria

- If no activeSession exists, deactivate() completes cleanly and immediately
- If activeSession exists and workspace revision matches last settled save, session finalizes immediately as 'completed'
- If activeSession exists and files were dirty or modified, buffers are flushed and final scan is requested with 3000ms timeout
- If final scan completes successfully, session finalizes as 'completed' and is persisted to completedSessions
- If final scan times out or fails on a dirty workspace, session finalizes as 'incomplete'
- Child process is cleanly terminated
- All unit tests, typechecks, and linter pass with 0 errors

## Validation

- command 1: npm run check-types
- command 2: npm run lint
- command 3: npm run compile

## Risks or dependencies

- risk 1: VS Code hard shutdown limit (~5s); mitigated with a 3000ms timeout guard
- risk 2: Incomplete session handling must be accounted for in subsequent session startup (Step 3 overhaul task)

## Handoff notes

- notes for the next agent: Active sessions now record status ('active' | 'completed' | 'incomplete'). When implementing 'New session after first, pull previous complete record', filter completedSessions for status === 'completed'.
