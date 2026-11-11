<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Sidebar Configuration Accordion

## Summary

- task: Surface configurable VS Code settings directly in a new Configuration accordion inside the Ariadne sidebar
- requested outcome: Allow students and users to view and edit scan interval, notification level, custom binary path, and metrics ingest settings directly in the sidebar without opening VS Code settings JSON
- primary constraint: Persist values to `vscode.workspace.getConfiguration('ariadne')` and keep the UI in two-way sync

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: implementer
- next action: none
- blockers: none
- last checked: 2026-11-11

## Progress checklist

- [x] Define configuration types and view models in `src/modules/feedback/types.ts`
- [x] Read and write VS Code settings in `src/extension.ts`
- [x] Add `CONFIGURATION` accordion section in `src/modules/feedback/views/signInPanel.ts`
- [x] Add client-side input handlers and message passing for instant setting updates
- [x] Add unit tests for the configuration accordion in `src/test/sidebarSettings.test.ts`
- [x] Verify compilation and tests with `npm run compile` and `npm run workflow -- check`

## Scope

- in scope: Exposing `ariadne.notifications.level`, `ariadne.autoScan.intervalMinutes`, `ariadne.executable`, and `ariadne.metricsIngest.*` in the sidebar accordion
- out of scope: Modifying the scanner core or core detection logic

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: user
- tester: agent

## Relevant files

- file or directory 1: src/modules/feedback/types.ts
- file or directory 2: src/modules/feedback/views/signInPanel.ts
- file or directory 3: src/extension.ts
- file or directory 4: src/test/sidebarSettings.test.ts

## Acceptance criteria

- criterion 1: A new `CONFIGURATION` accordion item appears in the sidebar settings view
- criterion 2: Notification level (`milestones`, `all`, `quiet`) can be adjusted via a dropdown and persists to configuration
- criterion 3: Auto-scan interval (in minutes) can be updated via a number input and updates the hourly/interval timer
- criterion 4: Executable override and metrics ingest options can be updated directly from the sidebar
- criterion 5: UI adheres to Impeccable design guidelines and handles dark/light VS Code themes seamlessly

## Validation

- command 1: npm run compile
- command 2: npm run workflow -- check

## Risks or dependencies

- risk 1: Updating workspace settings via `ConfigurationTarget.Global` vs `ConfigurationTarget.Workspace` — should default to Global or active target
- dependency 1: none

## Handoff notes

- notes for the next agent: The accordion should follow the existing details/summary structure in `signInPanel.ts`.
