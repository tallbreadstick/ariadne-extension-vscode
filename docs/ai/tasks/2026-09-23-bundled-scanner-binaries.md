<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Bundled Scanner Binaries

## Summary

- task: Ship Linux and Windows x64 scanner binaries with the extension and select the host binary at activation
- requested outcome: Session, CLI, and rule-script spawns use the packaged binary for the current OS; no PATH or cargo build required
- primary constraint: Do not commit private scanner repo URLs or internals; keep an explicit `ariadne.executable` override for local debugging

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: implementer
- next action: none
- blockers: none
- last checked: 2026-09-23

## Progress checklist

- [x] scaffold task brief
- [x] RED tests for platform binary path selection
- [x] copy linux-x64 and win32-x64 binaries into `bin/`
- [x] resolve bundled binary at activation and on every spawn
- [x] GREEN tests + typecheck + lint
- [x] update architecture / README / setting copy

## Scope

- in scope:
  - Package x64 Linux and Windows scanner binaries under `bin/`
  - Select the matching binary when the extension activates
  - Use that binary for session, `ariadne init` / reset, and rule diagnostics
  - Runtime chmod on the Linux binary so git checkouts stay executable
  - Explicit `ariadne.executable` path still overrides the bundle
- out of scope:
  - macOS / ARM builds
  - Download-at-install
  - Changing the IPC contract

## Cross-repo dependencies

- scanner core changes needed: none (prebuilt binaries already exist)
- bridge contract changes: none

## File ownership

- planner: none
- implementer: current agent
- reviewer: code-reviewer after implementation
- tester: current agent

## Relevant files

- src/modules/core/bundledAriadneBinary.ts
- src/modules/core/ariadneExecutable.ts
- src/extension.ts
- src/test/bundledAriadneBinary.test.ts
- bin/linux-x64/ariadne
- bin/win32-x64/ariadne.exe
- package.json
- README.md
- docs/ai/architecture.md
- docs/ai/project-context.md
- docs/ai/decisions.md

## Acceptance criteria

- Linux x64 uses `bin/linux-x64/ariadne`
- Windows x64 uses `bin/win32-x64/ariadne.exe`
- Unsupported platform/arch has no bundled path
- Activation configures the resolver from `context.extensionPath` before any spawn
- A real `ariadne.executable` path still wins when it exists
- Packaged binaries are included in the VSIX (not ignored)

## Validation

- command 1: `npx tsc --noEmit` (pass)
- command 2: `npx mocha --ui bdd --timeout 20000 out/test/bundledAriadneBinary.test.js` (6 passing)

## Risks or dependencies

- risk: Linux binary is dynamically linked to glibc/libgcc; very old distros may fail to start it
- risk: macOS and ARM hosts have no bundled binary until those builds exist
- dependency: none

## Handoff notes

- notes for the next agent: Do not document the private scanner checkout path. Replace files in `bin/` when new scanner builds are ready.
