# Session Not Started Badge

## Summary

- task: Display red dot and "SESSION X · NOT STARTED YET" in Session Metrics header when a session has not started
- requested outcome: When an active session is not in progress (activeSession === null), the session badge in the Full Report header renders a red dot with text "SESSION X · NOT STARTED YET". When active, it displays the standard green/accent dot and "SESSION X".
- primary constraint: Maintain existing clean styling, preserve backward compatibility when isSessionActive is omitted, no breaking changes.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: agent
- next action: ready for review and commit
- blockers: none
- last checked: 2026-10-12

## Progress checklist

- [x] Add isSessionActive?: boolean to SessionMetrics in panelTypes.ts
- [x] Add isSessionActive parameter and assignment in snapshotAnalyzer.ts
- [x] Pass isSessionActive in extension.ts (buildCurrentSessionMetrics and fallback)
- [x] Update sessionMetrics.ts HTML/CSS to render red dot and "· NOT STARTED YET" when isSessionActive is false
- [x] Add unit tests in sessionMetricsView.test.ts
- [x] Verify test suite and compile pass

## Scope

- in scope:
  - SessionMetrics.isSessionActive boolean field
  - session-badge and session-dot CSS styling for not-started state
  - "SESSION X · NOT STARTED YET" text rendering
  - Unit tests for both active and not-started badge states
- out of scope:
  - Scanner changes or external API changes

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/presentation/panelTypes.ts
- src/modules/tracker/analysis/snapshotAnalyzer.ts
- src/modules/tracker/views/sessionMetrics.ts
- src/extension.ts
- src/test/sessionMetricsView.test.ts

## Acceptance criteria

- criterion 1: When isSessionActive is false, session dot is styled red and badge text displays "SESSION X · NOT STARTED YET".
- criterion 2: When isSessionActive is true or undefined, session dot is standard accent color and badge text displays "SESSION X".
- criterion 3: All tests pass and TypeScript compiles cleanly.

## Validation

- command 1: npm.cmd run compile
- command 2: npx.cmd mocha --ui bdd out/test/sessionMetricsView.test.js
- command 3: npm.cmd run workflow -- check

## Risks or dependencies

- risk 1: None. Purely additive property and styling.

## Handoff notes

- notes for the next agent: Follow chosen label format "SESSION X · NOT STARTED YET".

