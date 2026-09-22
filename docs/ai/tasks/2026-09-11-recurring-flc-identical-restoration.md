<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Recurring Flc Identical Restoration

## Summary

- task: Complete identical restoration and in-session toggle detection for recurring and reappearing FLCs per reference documentation
- requested outcome: When an absent finding reappears with identical content and scope fingerprints, the engine invalidates provisional resolution, increments identical restoration and toggle counters, flags the classification, and reflects integrity counters in session metrics
- primary constraint: Zero Rust scanner modifications; leverage existing SHA-256 fingerprints delivered across the bridge

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: RENCE
- next action: ready for review and commit
- blockers: none
- last checked: 2026-09-11

## Progress checklist

- [x] Scan repository instructions, AGENTS.md, and Response reference docs
- [x] Create git branch `feature/recurring-flc-identical-restoration`
- [x] Create implementation plan clarifying Rust scanner scope and deleted vs commented-out mechanics
- [x] Implement `commentDetector.ts` to inspect source files for line/block comments
- [x] Update `lifecycleTypes.ts` with `isIdenticalRestoration`, `isCommentedOut`, `lastLineNumber`, and `lastEndLine`
- [x] Update `lifecycleEngine.ts` to flag identical restoration and retain commented-out findings as persisting (Option 1)
- [x] Wire `getWorkspaceFileContent` in `src/extension.ts`
- [x] Expose toggle metrics in `snapshotAnalyzer.ts` / `SessionAnalysis`
- [x] Add comprehensive test coverage in `lifecycleEngine.test.ts` (27 passing tests)
- [x] Validate typecheck, lint, and workflow brief

## Scope

- in scope: `commentDetector.ts`, `lifecycleEngine.ts`, `lifecycleTypes.ts`, `snapshotAnalyzer.ts`, `extension.ts`, `convert.ts`, `lifecycleEngine.test.ts`
- out of scope: Rust scanner modifications, UI redesign of metrics cards

## Cross-repo dependencies

- scanner core changes needed: none (fingerprints already provided by bridge)
- bridge contract changes: none

## File ownership

- planner: RENCE
- implementer: RENCE
- reviewer: ABEL / ZYDRIC
- tester: RENCE

## Relevant files

- `src/modules/tracker/analysis/lifecycleTypes.ts`: Classification and lifecycle types
- `src/modules/tracker/analysis/lifecycleEngine.ts`: Identical restoration detection
- `src/modules/tracker/analysis/snapshotAnalyzer.ts`: Presentation mapping
- `src/test/lifecycleEngine.test.ts`: Test suite

## Acceptance criteria

- An active finding that disappears and returns with matching `contentFingerprint` and `scopeFingerprint` increments `identicalRestorationCount` and `inSessionToggleCount`
- Provisional resolution is cancelled upon identical restoration
- Returning with different content (a genuine edit) does not increment identical restoration counts
- `isIdenticalRestoration` flag is exposed on the classification result
- Clean build, typecheck, lint, and tests pass

## Validation

- `npx mocha out/test/lifecycleEngine.test.js`
- `npm run check-types`
- `npm run lint`
- `npm run workflow -- check`

## Risks or dependencies

- Absence of code between scans cannot distinguish deletion from comment-out without AST analysis, but identical restoration reliably catches restoration on reappearance.
