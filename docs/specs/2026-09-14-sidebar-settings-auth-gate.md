# Spec: Sidebar Settings Auth Gate

## Purpose

Restructure the Ariadne sidebar into an accordion of Account, Scripting, and Session settings; lock AI explanations to Gemini Flash; and require GitHub sign-in (with terms + analytics consent) before any extension feature runs, including the SAST engine.

## Scope

- in scope:
  - Accordion layout on the existing sidebar webview (`ariadne.sidebar.signIn`)
  - Account: GitHub sign-in/out, Copilot token usage, locked Gemini Flash model label
  - Scripting: initialize rule scripts via `ariadne init`; reset to defaults with a modal warning
  - Session: placeholder content only
  - Gate SAST engine spawn, rule-script CLI actions, and existing AI feedback behind GitHub auth
  - Update terms copy so sign-in covers full extension use, not only AI feedback
- out of scope:
  - Session data management UI (clear/export) beyond placeholders
  - Instructor/cloud data-collection pipeline (consent is captured now; upload comes later)
  - Additional LLM models or a model picker
  - Scanner-core changes to the `init` CLI contract

## Proposed behavior

### Sidebar accordion

The left Ariadne view is a settings panel with three independently collapsible sections implemented as native `<details>` elements:

1. **Account** (open by default)
   - Signed-out: status, terms + analytics checkboxes, Sign in with GitHub. Copy states that sign-in is required to use Ariadne (scanning, rule scripts, and AI explanations).
   - Signed-in: account label, signed-in time, Copilot usage (existing quota bar), static **Gemini Flash** model label (not a picker), Sign out.
2. **Scripting**
   - **Initialize rule scripts** runs the workspace `ariadne init` CLI in the current workspace root.
   - **Reset rule scripts** shows a VS Code modal warning (`showWarningMessage` with `modal: true`) asking the user to confirm reverting rule scripts to defaults, then runs `ariadne init --force`.
   - Both actions require an open workspace folder and a signed-in session. Buttons are disabled when signed out.
3. **Session**
   - Placeholder copy only (local session data settings will land later). No working controls.

Accordion open/closed state is restored across HTML refreshes via the webview `setState` / `getState` API.

### Locked model

Ariadne always uses `gemini-3.5-flash` for Copilot explanations. The previous model enum/picker is removed. Older user settings for other models are ignored.

### Auth gate

GitHub sign-in with valid terms + analytics consent is required to use the extension:

- The SAST `ariadne session` process does not spawn until the user is signed in.
- On sign-out the engine is killed, inline diagnostics are cleared, and Active Vulnerabilities returns to empty.
- On sign-in the engine starts (or restarts) and bootstraps the workspace.
- Ask Ariadne remains gated (existing).
- Initialize / reset rule scripts remain gated.
- Signing in after a previous sign-out restarts scanning without reloading the window.

The OAuth prompt and terms text describe that sign-in enables the whole product (detection + explanations) and consent for future anonymous activity collection.

## Acceptance criteria

- [ ] Sidebar shows Account, Scripting, and Session accordion sections
- [ ] Account shows GitHub status, usage when signed in, and a non-editable Gemini Flash label
- [ ] No Copilot model `<select>` remains in the sidebar or `package.json` enum
- [ ] Initialize rule scripts invokes `ariadne init` in the workspace root
- [ ] Reset rule scripts asks for confirmation, then invokes `ariadne init --force`
- [ ] Session section renders placeholders only
- [ ] SAST engine does not run while signed out
- [ ] Sign-in starts the engine; sign-out stops it and clears diagnostics
- [ ] Ask Ariadne still requires sign-in

## Constraints

- technical: reuse the existing sidebar webview and `GitHubAuthService`; spawn CLI via the same `resolveAriadneExecutable()` path as `check` / `session`; no new dependencies
- product: consent is mandatory for all features because upcoming data collection needs it
- delivery: `ariadne init` / `init --force` are assumed public CLI flags on the already-integrated binary

## Cross-repo impact

- scanner core: none expected if `ariadne init` and `ariadne init --force` already exist; otherwise the private CLI must expose those commands
- bridge contract: none (stdio session messages unchanged)

## Risks and open questions

- risk: `init --force` flag name may differ on the binary; the extension surfaces CLI stderr if it fails
- question: none — Session UI is intentionally empty

## Related docs

- plan: [2026-09-14-sidebar-settings-auth-gate.md](../plans/2026-09-14-sidebar-settings-auth-gate.md)
- task brief: [2026-09-14-sidebar-settings-auth-gate.md](../ai/tasks/2026-09-14-sidebar-settings-auth-gate.md)
