<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Abrupt Close Diagnostics And Auto Scan

## Summary

- task: Add popup window containing diagnostics for abrupt close recovery and make auto-scan duration configurable
- requested outcome: Show a diagnostic modal and webview panel on startup if an unfinalized session is recovered, and allow users to configure auto-scan interval in settings
- primary constraint: Maintain non-invasive UX, clean shutdown persistence compatibility, and test coverage

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: Antigravity
- next action: ready for team review and merge
- blockers: none
- last checked: 2026-09-21

## Progress checklist

- [x] Create AbruptSessionDiagnosticPanel webview and diagnostics builder
- [x] Wire up abrupt close detection and modal popup in extension.ts
- [x] Add ariadne.autoScan.intervalMinutes setting in package.json and extensionSettings.ts
- [x] Dynamically bind auto-scan timer to configured interval with change listener
- [x] Add unit tests and verify full test suite passes

## Scope

- in scope: Abrupt session recovery diagnostics presentation, auto-scan interval configuration setting, unit tests
- out of scope: Changing scanner binary protocol or modifying FLC lifecycle engine transitions

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: Ervin
- tester: Antigravity

## Relevant files

- src/modules/tracker/views/abruptSessionPanel.ts: Diagnostic webview panel
- src/extension.ts: Startup recovery popup hook & auto-scan timer binding
- package.json: ariadne.autoScan.intervalMinutes setting definition
- src/modules/feedback/settings/extensionSettings.ts: Auto-scan interval helper functions
- src/test/abruptRecovery.test.ts: Unit tests for diagnostic builder and config validation

## Acceptance criteria

- criterion 1: When an unfinalized session exists on startup, a modal alert warns the user and provides a "View Diagnostics" action
- criterion 2: "View Diagnostics" opens a webview panel detailing the incomplete session metadata, crash duration, and active findings
- criterion 3: ariadne.autoScan.intervalMinutes setting exists and dynamically re-arms the auto-scan interval
- criterion 4: All unit tests pass cleanly with zero lint or type check errors


## Validation

- command 1:
- command 2:

## Risks or dependencies

- risk 1:
- dependency 1:

## Handoff notes

- notes for the next agent:
