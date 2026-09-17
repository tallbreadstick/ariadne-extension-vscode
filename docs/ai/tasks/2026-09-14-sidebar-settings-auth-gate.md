<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Sidebar Settings Auth Gate

## Summary

- task: Accordion sidebar settings plus GitHub sign-in required for all features including SAST
- requested outcome: Account / Scripting / Session accordion; Gemini Flash only; init/reset rule scripts; SAST does not run until signed in
- primary constraint: Reuse the existing sidebar webview and GitHub OAuth flow; do not add dependencies or expose private scanner internals

## Linked artifacts

- spec: docs/specs/2026-09-14-sidebar-settings-auth-gate.md
- plan: docs/plans/2026-09-14-sidebar-settings-auth-gate.md

## Current state

- status: in progress
- current owner: agent
- next action: exclusive accordion, privacy policy, and signed-out panel states are in; remaining review/reload in the extension host
- blockers: none
- last checked: 2026-09-14

## Progress checklist

- [ ] Accordion sidebar HTML (Account, Scripting, Session)
- [ ] Gemini Flash locked (no model picker)
- [ ] Initialize / reset rule scripts
- [ ] SAST engine gated on GitHub sign-in
- [ ] Terms and docs updated
- [ ] Tests and compile pass

## Scope

- in scope: sidebar accordion, locked model, rule-script buttons, auth gate for SAST and other features, terms copy
- out of scope: session-data settings beyond placeholders; analytics upload pipeline; scanner-core CLI changes

## Cross-repo dependencies

- scanner core changes needed: none if `ariadne init` and `ariadne init --force` already exist
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/feedback/views/signInPanel.ts
- src/modules/feedback/settings/extensionSettings.ts
- src/modules/feedback/auth/githubAuthService.ts
- src/modules/detection/bridge/iostream.ts
- src/modules/core/ariadneExecutable.ts
- src/extension.ts
- package.json

## Acceptance criteria

- criterion 1: Sidebar accordion has Account, Scripting, and Session sections
- criterion 2: Account shows GitHub status, token usage, and a non-editable Gemini Flash label
- criterion 3: Scripting can initialize rules via `ariadne init` and reset via confirmed `ariadne init --force`
- criterion 4: SAST session process does not spawn until the user is signed in, and stops on sign-out

## Validation

- command 1: npm run compile
- command 2: npm test

## Risks or dependencies

- risk 1: `init --force` flag name may differ on the binary
- dependency 1: local `ariadne` executable on PATH or via `ariadne.executable`

## Handoff notes

- notes for the next agent: Session settings are placeholders. Auth now gates detection as well as AI feedback because upcoming data collection needs consent.
