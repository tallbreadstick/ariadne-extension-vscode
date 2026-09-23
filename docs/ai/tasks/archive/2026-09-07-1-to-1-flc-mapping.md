<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Task Brief: 1-to-1 FLC Mapping (Instance Parity)

## Summary

- task: Transition from grouped logical-fingerprint collapsing to a strict 1-to-1 mapping between scanner findings and Finding Lifecycle Records (FLCs)
- requested outcome: UI item count and FLC count are strictly identical (e.g. 20 UI cards = 20 FLCs), keyed by the scanner's unique `instance_fingerprint`, ensuring fixing any sink awards immediate durable resolution credit
- primary constraint: Maintain full compatibility with `lifecycleEngine.ts`, `SessionStore`, and Rence's save-triggered settlement gate

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: ABEL
- next action: ready for integration with Ervin and Rence
- blockers: none
- last checked: 2026-09-07

## Progress checklist

- [x] Update `metadataToObservedFindings` in `src/modules/detection/bridge/convert.ts` to map findings 1-to-1 without grouping
- [x] Use `instance_fingerprint` (with composite fallback) for finding identity and set `occurrenceCount: 1`
- [x] Update / add unit tests in `src/test/lifecycleEngine.test.ts` to reflect 1-to-1 mapping
- [x] Append ADR to `docs/ai/decisions.md`
- [x] Verify unit tests pass (`npm run compile-tests && npx mocha out/test/lifecycleEngine.test.js`)
- [x] Verify `npm run check-types` and `npm run lint`
- [x] Run `npm run workflow -- check`

## Scope

- in scope: `src/modules/detection/bridge/convert.ts`, `src/test/lifecycleEngine.test.ts`, `docs/ai/decisions.md`
- out of scope: changes to Rust scanner (`ariadne-core` already emits `instance_fingerprint`), webview styling

## Cross-repo dependencies

- scanner core changes needed: none (already emitted in `VulnerabilityMetadata.instance_fingerprint`)
- bridge contract changes: none

## File ownership

- planner: ABEL
- implementer: ABEL
- reviewer: ERVIN
- tester: ABEL

## Relevant files

- `src/modules/detection/bridge/convert.ts`
- `src/modules/tracker/analysis/lifecycleTypes.ts`
- `src/modules/tracker/analysis/lifecycleEngine.ts`
- `src/test/lifecycleEngine.test.ts`
- `docs/ai/decisions.md`

## Acceptance criteria

- Every `VulnerabilityMetadata` item in `findings` maps 1-to-1 to an `ObservedFinding`
- `occurrenceCount` for each `ObservedFinding` is 1
- `logicalFingerprint` on `ObservedFinding` uses `instance_fingerprint` (or composite fallback) so distinct sinks in the same method do not collide
- Fixing an individual sink removes its FLC and allows it to transition to `resolved`
- 20 UI vulnerabilities = 20 FLCs in lifecycle debug dump
- All unit tests pass and linter/typecheck are clean

## Validation

- command 1: npm run compile-tests && npx mocha out/test/lifecycleEngine.test.js
- command 2: npm run check-types
- command 3: npm run lint
- command 4: npm run workflow -- check

## Risks or dependencies

- risk 1: Ensure existing tests expecting occurrence counts > 1 are updated to test 1-to-1 instance resolution while preserving multi-instance coverage

## Handoff notes

- notes for the next agent: `metadataToObservedFindings()` now emits 1 ObservedFinding per VulnerabilityMetadata item. FLC counts will now match Active Vulnerabilities count 1-to-1.
