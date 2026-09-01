<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Fingerprint Phase 1

## Summary

- task: Extension-only finding fingerprints (SHA-256 logical/content/scope) with queued sent-buffer pairing
- requested outcome: Compute and attach hashes in the extension without scanner-core changes; do not persist Trends lifecycle data
- primary constraint: No scanner IPC or payload changes; no SessionStore / snapshotAnalyzer replacement

## Linked artifacts

- spec: docs/specs/2026-08-31-fingerprint-phase-1.md
- plan: docs/plans/2026-08-31-fingerprint-phase-1.md

## Current state

- status: completed
- current owner: implementer
- next action: none (archived; spec and plan backfilled)
- blockers: none
- last checked: 2026-08-31

## Progress checklist

- [x] Unit tests for hashing, enclosing path, snapshot queue, ambiguity, ineligibility
- [x] Fingerprint module (vscode-free)
- [x] Queue sent buffers on analysis-triggering IPC
- [x] Wire fingerprintScan on findings callback without persisting hashes
- [x] Validation (`compile`, unit tests)
- [x] Record post-MVP decision and TDD evidence

## Scope

- in scope: TypeScript fingerprint derivation from existing scanner metadata plus queued sent file text; continuity-key ambiguity marking; `.env` hygiene exclusion
- out of scope: scanner-core fields, request envelopes, FLC/session records, F/P/T, save-settlement, SessionStore write queue, UI Trends rewrite

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none (inbound payload unchanged; hashes are extension-side only)

## File ownership

- planner: none
- implementer: fingerprint module, documentEvents queue, extension callback
- reviewer: follow-up
- tester: src/test/fingerprint.test.ts

## Relevant files

- src/modules/detection/bridge/fingerprint.ts
- src/modules/detection/bridge/documentEvents.ts
- src/extension.ts
- src/test/fingerprint.test.ts
- docs/specs/2026-08-31-fingerprint-phase-1.md
- docs/plans/2026-08-31-fingerprint-phase-1.md
- docs/testing/fingerprint-phase-1.tdd.md
- docs/ai/decisions.md
- docs/ai/architecture.md

## Acceptance criteria

- Hashes are SHA-256 hex from length-prefixed canonical strings; line numbers are not hash inputs
- Enclosing symbol path is derived from snapshot text + line_number (Java) or property key (config)
- Missing rule_id, missing snapshot/buffer, failed enclosing path, or `.env` hygiene findings are continuity-ineligible
- Continuity key is (version, logical, scope); duplicate keys in one scan are ambiguous even when content differs
- Ambiguous/ineligible rows are not treated as matches; no raw source is stored
- Scanner core and SessionStore snapshot format are unchanged

## Validation

- command 1: npx tsc -p tsconfig.test.json
- command 2: npx mocha --ui tdd out/test/fingerprint.test.js
- command 3: npm run compile
- command 4: npm run test:unit

## Risks or dependencies

- risk 1: Line-level content slices collide for two findings in the same method with the same instance_name
- risk 2: FIFO buffer queue can desync if a findings line arrives without a matching analysis send
- risk 3: First Init findings are often ineligible because OpenFile does not enqueue
- dependency 1: none

## Handoff notes

- notes for the next agent: Fingerprints are computed on each findings callback and counted in the debug log only. Do not persist them into workspaceState until a later Trends task. Do not change the scanner. Treat ambiguous continuity keys as inconclusive. `onFindings` remains unqueued read-modify-write on SessionStore (known follow-up, not this slice).
