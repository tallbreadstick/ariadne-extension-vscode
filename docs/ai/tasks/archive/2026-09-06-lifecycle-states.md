<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Task Brief: Lifecycle States (Candidate, Active, Persisting, Resolved, Recurring)

## Summary

- task: Formalize lifecycle state transitions, conditions, and record updates in lifecycleEngine.ts and lifecycleTypes.ts
- requested outcome: A complete, fully tested state machine supporting the five lifecycle states (Candidate, Active, Persisting, Resolved, Recurring) plus identical-restoration toggle handling and observation-gating (settled vs unsettled)
- primary constraint: Pure business logic with no `vscode` imports in tracker/analysis; maintain compatibility with Rence's upcoming save-triggered settlement gate and Ervin's SessionStore

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: ABEL
- next action: handoff to Rence for save-settlement gating integration
- blockers: none
- last checked: 2026-09-06

## Progress checklist

- [x] Create feature branch feature/lifecycle-states from origin/feat/session-finding-records
- [x] Refine `lifecycleTypes.ts` with explicit `FindingLifecycleState` (Candidate, Active, Persisting, Improving, Resolved, Recurring)
- [x] Add `isSettled` observation support in `processObservation` / `lifecycleEngine.ts`
- [x] Refine transition conditions for Candidate, Active, Persisting, Resolved, and Recurring
- [x] Ensure `identicalRestorationCount` and `inSessionToggleCount` update correctly with real fingerprints
- [x] Create unit test suite `src/test/lifecycleEngine.test.ts`
- [x] Validate typecheck (`npx tsc --noEmit`) and lint (`npm run lint`)
- [x] Run workflow check

## Scope

- in scope: `src/modules/tracker/analysis/lifecycleTypes.ts`, `src/modules/tracker/analysis/lifecycleEngine.ts`, `src/test/lifecycleEngine.test.ts`
- out of scope: save-trigger file event listeners (Rence's task), F/P/T formulas (Ervin/Kenn), onDeactivation async trigger (Abel's later task)

## Cross-repo dependencies

- scanner core changes needed: none (already emitted in core/fingerprint-metadata)
- bridge contract changes: none

## File ownership

- planner: ABEL
- implementer: ABEL
- reviewer: ERVIN
- tester: ABEL

## Relevant files

- `src/modules/tracker/analysis/lifecycleTypes.ts`
- `src/modules/tracker/analysis/lifecycleEngine.ts`
- `src/modules/tracker/analysis/snapshotAnalyzer.ts`
- `src/test/lifecycleEngine.test.ts`

## Acceptance criteria

- `lifecycleTypes.ts` exports clean finding lifecycle states including `candidate`, `active`, `persisting`, `improving`, `resolved`, `recurring`
- Newly detected findings start as `candidate`
- First settled confirmation transitions a finding to `active`
- Findings active for >= 30,000ms with >= 2 settled confirmations transition to `persisting`
- Missing findings enter provisional resolution after 5,000ms grace period, and durable resolution on subsequent settled absence
- Durably resolved findings that reappear transition to `recurring` with incremented `recurrenceCount`
- Reappearance with identical `contentFingerprint` and `scopeFingerprint` increments `identicalRestorationCount` and `inSessionToggleCount`
- Unsettled observations (`isSettled: false`) do not prematurely advance durable resolution or confirmation counts
- Unit test suite covers all transitions and passes cleanly
- `npm run check-types` and `npm run lint` pass

## Validation

- command 1: npm run check-types
- command 2: npm run lint
- command 3: npm run workflow -- check

## Risks or dependencies

- risk 1: Ensure `classifyFinding` outputs cleanly map to the 4 public Trends statuses in `sessionMetrics.ts` while preserving internal state distinction

## Handoff notes

- notes for the next agent: `processObservation` accepts an optional `isSettled` flag (defaulting to true for backward compatibility). When Rence finishes the save-triggered settlement timer, he can pass `isSettled: true` on settled save scans and `isSettled: false` on live typing scans.
