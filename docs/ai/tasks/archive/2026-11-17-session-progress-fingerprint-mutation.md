<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Task Brief: Session Progress Fingerprint Mutation Bug Fix

## Summary

- task: Fix bug where editing fields/values (e.g. `dbPassword = "admin123"` to `"admin1234"`) falsely registers phantom resolved issues in the Session Progress counter (`X of Y Issues Resolved`) and inflates the issue denominator.
- requested outcome: Typing in a vulnerable line or field maintains accurate session progress; phantom resolved issues are not generated; `totalSessionIssues` is not inflated; editing existing findings preserves lifecycle continuity.
- primary constraint: Zero modifications to private scanner core; public repository boundary compliance (no internal URLs or private logic); clean unit test coverage.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: Antigravity
- next action: none
- blockers: none
- last checked: 2026-11-17

## Progress checklist

- [x] Remove `seenFingerprints` unbounded accumulator from `src/extension.ts` and use stable session baseline
- [x] Remove `content_fingerprint` from `instanceGroupKey` fallback in `src/modules/detection/bridge/convert.ts`
- [x] Implement live presence verification and mutated finding matching in `countLiveSessionProgress` in `src/modules/tracker/analysis/lifecycleEngine.ts`
- [x] Implement live lifecycle fingerprint reconciliation in `src/extension.ts`
- [x] Add unit tests in `src/test/sessionProgressCount.test.ts`
- [x] Run `npm run check-types` and unit test suites
- [x] Run `npm run workflow -- check`

## Scope

- in scope: `src/extension.ts`, `src/modules/tracker/analysis/lifecycleEngine.ts`, `src/modules/detection/bridge/convert.ts`, `src/test/sessionProgressCount.test.ts`
- out of scope: private scanner core modifications, webview styling changes

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: User
- tester: Antigravity

## Relevant files

- `src/extension.ts`
- `src/modules/tracker/analysis/lifecycleEngine.ts`
- `src/modules/detection/bridge/convert.ts`
- `src/test/sessionProgressCount.test.ts`

## Acceptance criteria

- Typing or appending characters within a finding's value/line (e.g. `admin123` -> `admin1234`) does NOT increment `resolvedCount` in `Session Progress: X of Y Issues Resolved`.
- `totalSessionIssues` does NOT inflate on keystrokes.
- Actually removing or fixing a finding correctly increments `resolvedCount` and updates progress.
- Findings commented out are properly identified and excluded from resolved count.
- All unit tests pass cleanly.

## Validation

- command 1: npm run check-types
- command 2: npm run compile-tests; npx mocha out/test/sessionProgressCount.test.js out/test/activeVulnerabilities.test.js out/test/candidateToast.test.js
- command 3: npm run workflow -- check

## Risks or dependencies

- risk 1: Ensure distinct sinks in the same method (e.g. line 85 and line 92) remain independently resolvable.
- dependency 1: none

## Handoff notes

- notes for the next agent: Bug resolved cleanly across bridge conversion, lifecycle engine live progress calculation, and extension baseline handling.
