<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Comment Out False Positive Remediation

## Summary

- task: Prevent false-positive "Commented out" detections when remediating code with Javadoc/comments nearby
- requested outcome: Remediated vulnerabilities (such as Sensitive Data in toString() or type conversion) properly resolve when fixed, even if adjacent docstrings or prose comments mention the symbol/instance name, while genuinely commented-out code remains withheld from resolution.
- primary constraint: Do not break genuine commented-out code detection or regress existing lifecycle tests; do not commit private scanner URLs or proprietary details.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: implementer
- next action: none
- blockers: none
- last checked: 2026-11-17

## Progress checklist

- [x] Investigate root cause in commentDetector.ts
- [x] Refactor isCodeCommentedOut to distinguish docstrings/prose from commented-out code and verify active code at target location
- [x] Add unit test suite for docstrings, inline comments, and remediations
- [x] Verify test suite passes with npm test / mocha
- [x] Verify TypeScript types and build bundle

## Scope

- in scope: src/modules/tracker/analysis/commentDetector.ts, unit tests
- out of scope: private scanner backend, UI styling

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/tracker/analysis/commentDetector.ts
- src/modules/tracker/analysis/lifecycleEngine.ts
- src/test/commentDetector.test.ts
- src/test/lifecycleEngine.test.ts

## Acceptance criteria

- criterion 1: Remediating a method with Javadocs or docstrings mentioning the symbol (e.g. toString with docstring mentioning password) resolves normally and is not flagged as commented out.
- criterion 2: Explanatory prose comments mentioning the symbol (e.g. // VULN: ..., // Note: ...) do not cause remediated active code to be flagged as commented out.
- criterion 3: Genuinely commented-out code (e.g. // const res = executeQuery(...) or /* const res = ... */) is still accurately detected as commented out and withheld from resolution.
- criterion 4: All existing tests in lifecycleEngine.test.ts and sessionProgressCount.test.ts pass.

## Validation

- command 1: npm.cmd run check-types
- command 2: npx mocha out/test/commentDetector.test.js out/test/lifecycleEngine.test.js out/test/sessionProgressCount.test.js
- command 3: npm.cmd run compile

## Risks or dependencies

- risk 1: Over-restricting comment detection could allow genuinely commented-out code to resolve. Mitigated by verifying against all existing test cases and explicitly detecting code statement syntax.
- dependency 1: none
