# TDD evidence: Fingerprint Phase 1

## Source plan

Journeys were derived from the Phase 1 fingerprint contract (queued sent buffers, extension-only SHA-256 hashes). Spec: `docs/specs/2026-08-31-fingerprint-phase-1.md`. Plan: `docs/plans/2026-08-31-fingerprint-phase-1.md`.

## User journeys

- As a Trends implementer, I want each finding hashed from the file text that was sent for that analysis, so live editor edits after send cannot change the hash.
- As a student, I want inserting blank lines above a finding not to break continuity, so identity is not tied to line numbers.
- As a Trends matcher, I want two findings that share version+logical+scope in one scan marked ambiguous, so they are not treated as a unique match.

## Task report

| Behavior | Command | Result | Guarantee |
|---|---|---|---|
| RED: tests compiled against unimplemented stubs | Prior session: `npx tsc -p tsconfig.test.json` then mocha TDD UI | Failures on missing `fingerprint` exports / unimplemented behavior (19 cases) | Tests exercised the intended API before production code existed |
| GREEN: fingerprint module + queue + ineligibility | `./node_modules/.bin/tsc -p tsconfig.test.json` then `./node_modules/.bin/mocha --ui tdd out/test/fingerprint.test.js` | **23 passing** (2026-08-31) | See specification table |
| Compile | `npm run compile` | PASS (tsc + eslint + esbuild) | Extension host bundle typechecks and lints |

Checkpoint git commits were **not** created: repository policy is commit-only-when-asked.

## Test specification

| # | What is guaranteed | Test | Type | Result | Evidence |
|---|--------------------|------|------|--------|----------|
| 1 | Workspace-relative POSIX path under root | `workspaceRelativePath` relativizes | unit | PASS | mocha 23 passing |
| 2 | Path outside root is rejected | `workspaceRelativePath` undefined | unit | PASS | mocha 23 passing |
| 3 | Java enclosing path is package.class.method | `deriveEnclosingSymbolPath` two methods | unit | PASS | mocha 23 passing |
| 4 | One-line type body keeps class scope | `deriveEnclosingSymbolPath` one-line class | unit | PASS | mocha 23 passing |
| 5 | Field line uses class, not a method | class-level field | unit | PASS | mocha 23 passing |
| 6 | Out-of-range line has no path | line 0 / 99 | unit | PASS | mocha 23 passing |
| 7 | Dequeue matches buffers as of enqueue | FIFO tracker | unit | PASS | mocha 23 passing |
| 8 | `recordFile` does not enqueue | tracker | unit | PASS | mocha 23 passing |
| 9 | Rename drops the old path key | tracker | unit | PASS | mocha 23 passing |
| 10 | Blank lines above do not change hashes | fingerprintScan shift | unit | PASS | mocha 23 passing |
| 11 | Same rule in two methods differs logically and in scope | two methods | unit | PASS | mocha 23 passing |
| 12 | `instance_name` rename changes logical only | instance_name | unit | PASS | mocha 23 passing |
| 13 | Detector title is not hashed | type change | unit | PASS | mocha 23 passing |
| 14 | Taint origin+sink content hash differs from line slice | taint vs line | unit | PASS | mocha 23 passing |
| 15 | Empty instance_name on secrets rule is ineligible | missing-enclosing-path | unit | PASS | mocha 23 passing |
| 16 | Duplicate continuity keys are ambiguous even if content differs | ambiguous scan | unit | PASS | mocha 23 passing |
| 17 | Missing `rule_id` is ineligible | missing-rule-id | unit | PASS | mocha 23 passing |
| 18 | Missing file buffer is ineligible | missing-buffer | unit | PASS | mocha 23 passing |
| 19 | Missing snapshot is ineligible | missing-snapshot | unit | PASS | mocha 23 passing |
| 20 | `.env` hygiene rule is excluded | excluded-project-finding | unit | PASS | mocha 23 passing |
| 21 | Config content hash is the property value | config_property_value | unit | PASS | mocha 23 passing |
| 22 | NFC and NFD content hashes differ | unicode | unit | PASS | mocha 23 passing |
| 23 | `//` comments outside strings are stripped; string literals kept | comment vs literal | unit | PASS | mocha 23 passing |

## Coverage and known gaps

No project coverage reporter is configured (`npm run test:coverage` does not exist). Gaps:

- `documentEvents.ts` / `extension.ts` wiring is not unit-tested (VS Code host).
- Ineligibility reasons `missing-relative-path` and `missing-content` have no dedicated tests.
- No E2E coverage of FIFO desync.

## Merge evidence

RED (unimplemented API) → GREEN (`fingerprint.ts` + buffer queue + findings callback). No refactor-only checkpoint. Do not squash away this file if commits are later combined.
