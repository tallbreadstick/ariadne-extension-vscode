<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Synchronous Shutdown Persistence & Recovery

## Summary

- task: Implement synchronous local file flush on deactivation and startup recovery to ensure clean sessions persist as 'completed'
- requested outcome: Clean sessions survive VS Code window closing without getting corrupted or dropped into 'incomplete' state by VS Code IPC teardown
- primary constraint: Synchronous flush must complete in <1ms without depending on VS Code main-thread RPC replies; un-settled edits or crashes must still safely recover as 'incomplete'

## Linked artifacts

- spec: docs/specs/2026-09-12-synchronous-shutdown-persistence.md
- plan: none

## Current state

- status: completed
- current owner: Abel (Antigravity)
- next action: ready for integration with previous session recovery task
- blockers: none
- last checked: 2026-09-12

## Progress checklist

- [x] Add `saveFinalizedSessionSync` and `recoverPendingFinalizedSession` to `sessionStore.ts`
- [x] Update `extension.ts` deactivation handler to write synchronous snapshot before `session.kill()`
- [x] Update `extension.ts` startup logic to import pending finalized session before checking stale active sessions
- [x] Add unit tests for synchronous file flush and recovery in `lifecycleEngine.test.ts`
- [x] Validate: `npm test && npm run check-types && npm run lint`
- [x] Record ADR in `docs/ai/decisions.md`

## Scope

- in scope: `sessionStore.ts`, `extension.ts`, `lifecycleEngine.test.ts`, `docs/specs/`, `docs/ai/decisions.md`
- out of scope: Rust scanner core, live scan debounce, FLC calculation formulas

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Abel (Antigravity)
- implementer: Abel (Antigravity)
- reviewer: Ervin
- tester: Abel & Rence

## Relevant files

- `src/modules/tracker/storage/sessionStore.ts`
- `src/extension.ts`
- `src/test/lifecycleEngine.test.ts`

## Acceptance criteria

- `saveFinalizedSessionSync` writes `finalized-session.json` synchronously via `fs.writeFileSync`
- Clean deactivation writes `finalized-session.json` with `status: 'completed'`
- Next activation imports `finalized-session.json` into `completedSessions` with `status: 'completed'` and deletes file
- Dirty deactivation with aborted/failed final scan writes `finalized-session.json` with `status: 'incomplete'`
- Next activation imports dirty session as `status: 'incomplete'`
- Power cut / crash before `deactivate()` safely falls back to recovering stale active session as `incomplete`
