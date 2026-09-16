# Sidebar Settings Auth Gate Implementation Plan

**Goal:** Ship an accordion settings sidebar (Account / Scripting / Session), lock explanations to Gemini Flash, and require GitHub sign-in before the SAST engine or other features run.

**Architecture:** Keep the existing `ariadne.sidebar.signIn` webview. Expand its HTML builder into three `<details>` sections. Extract `ariadne init` / `init --force` argv helpers and a small CLI runner next to executable resolution. Make `runSession()` lazy (`start()` / `kill()`) so `extension.ts` starts the child process only after `GitHubAuthService.isAuthenticated()`.

**Tech Stack:** TypeScript, VS Code webview + `authentication` + `window.showWarningMessage`, existing Copilot SDK quota RPC, `child_process.spawn` for the `ariadne` CLI.

---

## References

- spec: [2026-09-14-sidebar-settings-auth-gate.md](../specs/2026-09-14-sidebar-settings-auth-gate.md)
- task brief: [2026-09-14-sidebar-settings-auth-gate.md](../ai/tasks/2026-09-14-sidebar-settings-auth-gate.md)

## Steps

- [ ] Write HTML/CLI unit tests (accordion sections, no model picker, locked Gemini Flash, init/reset argv)
- [ ] Rebuild the sidebar HTML as Account / Scripting / Session accordions; persist open state
- [ ] Remove Copilot model picker and force `gemini-3.5-flash`
- [ ] Add `runAriadneCli` + init/reset handlers with a modal confirm on reset
- [ ] Lazy-start / kill the SAST session on sign-in / sign-out; clear diagnostics on sign-out
- [ ] Update terms, PRODUCT.md, architecture notes, and a post-MVP ADR
- [ ] Run `npm run compile` and `npm test`

## Validation

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`

## Risks

- `ariadne init --force` may not be the reset flag; surface CLI errors instead of guessing a second protocol.
- Stopping the engine on sign-out leaves document event listeners installed; `send()` already no-ops when the process is dead, and `start()`/`restart()` re-bootstraps via `onRestarted`.

## Handoff notes

- Session accordion is placeholder-only by design.
- Do not commit private scanner URLs or init implementation details from the Rust repo.
