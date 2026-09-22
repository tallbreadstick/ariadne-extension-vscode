<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Common Vulnerabilities

## Summary

- task: Implement the Common Vulnerabilities type-level awareness metric
- requested outcome: Students see which vulnerability categories they encounter frequently across sessions, with graduation when sustained mastery is demonstrated
- primary constraint: Must follow the finalized strategy from docs/handoff/common_vuln_implementation_plan.md exactly (Option C + Strategy 2 + session-count reset)

## Linked artifacts

- spec: docs/specs/2026-09-14-common-vulnerabilities.md
- plan: docs/plans/2026-09-14-common-vulnerabilities.md

## Current state

- status: completed
- current owner: agent
- next action: none
- blockers: none
- last checked: 2026-09-14

## Progress checklist

- [x] Core computation engine (commonVulnerabilities.ts)
- [x] Storage key (storageKeys.ts)
- [x] Session store graduation history persistence (sessionStore.ts)
- [x] Panel types (panelTypes.ts)
- [x] Snapshot analyzer adapter (snapshotAnalyzer.ts)
- [x] Session metrics panel rendering (sessionMetrics.ts)
- [x] Extension orchestration (extension.ts)
- [x] Type-check passes
- [x] Lint passes
- [x] Full build passes
- [x] ADR recorded in decisions.md

## Scope

- in scope: computeCommonVulnerabilities engine, graduation history persistence, Common Vulnerabilities panel rendering, extension wiring
- out of scope: unit tests (deferred — engine is pure logic and testable), graduated types display, graduation notifications

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- implementer: agent

## Relevant files

- src/modules/tracker/analysis/commonVulnerabilities.ts (NEW)
- src/modules/tracker/storage/storageKeys.ts
- src/modules/tracker/storage/sessionStore.ts
- src/modules/presentation/panelTypes.ts
- src/modules/tracker/analysis/snapshotAnalyzer.ts
- src/modules/tracker/views/sessionMetrics.ts
- src/extension.ts

## Acceptance criteria

- computeCommonVulnerabilities correctly identifies types present in >= K sessions
- Graduated types (all resolved + G consecutive clean sessions) are excluded
- Session-count reset on graduation revocation works correctly
- Graduation history persisted in workspaceState and cleared on debug reset
- Common Vulnerabilities panel renders real data with type, CWE, session count, active findings
- Empty states handled: "Not enough session data yet" vs "No common vulnerabilities"

## Validation

- npx tsc --noEmit (pass)
- npm run lint (pass)
- npm run compile (pass)

## Risks or dependencies

- Graduation history grows unboundedly if students encounter many different CWE types — acceptable for the pilot since the number of unique CWE types is small (OWASP Top 10 / CWE Top 25)
- The engine reads completedSessions on every settled scan — could become slow if session history grows very large (mitigated by the fact that sessions accumulate slowly)

## Handoff notes

- K and G are in COMMON_VULN_POLICY and can be tuned without code changes
- The computation engine is a pure function with no vscode dependency — easy to unit test
- The graduation history mutation pattern (pass object in, mutated in-place, persist after) follows the handoff pseudocode exactly
