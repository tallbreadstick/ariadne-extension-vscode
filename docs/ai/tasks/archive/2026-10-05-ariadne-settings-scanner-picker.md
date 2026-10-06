<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Ariadne Settings Scanner Picker

## Summary

- task: Move sidebar account, scripting, and session controls onto an Ariadne Settings page, open the bottom panel from the activity bar, and add an Auto / OS / binary scanner picker.
- requested outcome: Activity-bar button focuses the bottom panel when signed in and opens settings when sign-in is required. Scanner Auto defaults on and is saved in VS Code settings. Manual mode picks an OS and binary, downloads it, and shows a check plus trash for downloaded binaries. A broken binary is reported in the vulnerabilities panel.
- primary constraint: Reuse the existing settings HTML, global settings storage, and release download path. No new dependencies.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: agent
- next action: Reload the extension host and try the activity-bar button, Ariadne Settings, and a broken-binary empty state.
- blockers: none
- last checked: 2026-10-05

## Progress checklist

- [x] Settings page holds Account, Scripting, Session, and Scanner
- [x] Activity bar opens the bottom panel or settings
- [x] Auto toggle, OS and binary dropdowns, download check, trash, and delete-all confirmation
- [x] Broken scanner replaces the clean empty state

## Scope

- in scope: activity-bar launcher, settings webview, scanner preferences, health check, vulnerabilities empty state
- out of scope: Marketplace packaging, scanner core changes

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- file or directory 1: src/extension.ts
- file or directory 2: src/modules/feedback/views/signInPanel.ts
- file or directory 3: src/modules/core/scannerRelease.ts
- file or directory 4: src/modules/core/ariadneExecutable.ts

## Acceptance criteria

- criterion 1: Signed-in activity-bar click focuses ariadne.panel.activeVulnerabilities. Signed-out click opens Ariadne Settings.
- criterion 2: Auto defaults on. Manual mode lists Windows, Linux, and macOS, then that OS's binaries, and downloads the selection.
- criterion 3: Downloaded binaries show a check and a trash control. Delete all asks for confirmation.
- criterion 4: A scanner process that exits is shown as "The current scanner binary is not working".

## Validation

- command 1: npx tsc --noEmit
- command 2: npx mocha --require /tmp/mock-vscode.cjs out/test/sidebarSettings.test.js out/test/scannerRelease.test.js

## Risks or dependencies

- risk 1: VS Code's activity bar must host a view, so the icon briefly opens a sidebar and then closes it.
- dependency 1: Binaries still come from the latest public ariadne-core release.

## Handoff notes

- notes for the next agent: Preferences: Open Ariadne Settings opens the page while signed in. ariadne.executable still overrides the picker when it points at a real file.
