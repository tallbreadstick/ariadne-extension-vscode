<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Session Data Clear Export

## Summary

- task: Add Clear session data and Export session data actions to the sidebar Session settings section
- requested outcome: Users can export local tracker session data to JSON, and can wipe all workspace session tracking after a modal warning
- primary constraint: Reuse SessionStore and the existing Scripting reset confirmation pattern; do not touch GitHub auth, rule scripts, or the scanner

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: implementer
- next action: none
- blockers: none
- last checked: 2026-09-22

## Progress checklist

- [x] scaffold task brief
- [x] RED tests for SessionStore export/clear and sidebar buttons
- [x] implement SessionStore snapshot + full wipe
- [x] Session accordion UI + extension host handlers
- [x] GREEN tests + compile

## Scope

- in scope:
  - Session accordion: Export session data and Clear session data buttons
  - Modal warning before clear (same `showWarningMessage({ modal: true })` pattern as rule-script reset)
  - Wipe all workspace session tracking: active/completed sessions, lifecycles, graduation history, save-scan state, dismissed notifications, expanded-vuln key, session meta, pending finalized-session file
  - Export those same records as a versioned local JSON file via the native Save dialog
  - Reset in-memory tracker state and refresh Session Metrics after a confirmed clear
- out of scope:
  - GitHub auth / Copilot quota
  - Rule scripts
  - Import session data
  - Cloud/instructor upload
  - Scanner-core changes

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: none
- implementer: current agent
- reviewer: code-reviewer after implementation
- tester: current agent

## Relevant files

- src/modules/tracker/storage/sessionStore.ts
- src/modules/feedback/views/signInPanel.ts
- src/extension.ts
- src/test/sidebarSettings.test.ts
- src/test/sessionStore.test.ts

## Acceptance criteria

- Session section shows Export session data and Clear session data controls (no placeholders)
- Clear asks for confirmation in a modal warning and does nothing if cancelled
- Confirmed clear wipes all local session tracking for the workspace, not GitHub auth or user config
- Export writes a JSON snapshot of session tracking data via the native Save dialog
- Session Metrics refresh after a successful clear

## Validation

- command 1: `npx tsc --noEmit` (pass)
- command 2: `npx mocha --ui bdd --timeout 20000 out/test/sessionStore.test.js out/test/sidebarSettings.test.js` (22 passing)

## Risks or dependencies

- risk: none remaining
- dependency: none

## Handoff notes

- notes for the next agent: Clear is destructive and local-only. Export is write-only; there is no import path yet. Reload the extension window to see the new Session buttons.
