# Fingerprint Phase 1 — what shipped

Status as of 2026-08-31 / commit on `feature/fingerprint-phase-1`.
This note is a factual account of the extension-only slice. It is not a claim that Trends matching, F/P/T, or live-session accuracy have been measured.

Related:

- Spec: [docs/specs/2026-08-31-fingerprint-phase-1.md](specs/2026-08-31-fingerprint-phase-1.md)
- Plan: [docs/plans/2026-08-31-fingerprint-phase-1.md](plans/2026-08-31-fingerprint-phase-1.md)
- Task brief (archived): [docs/ai/tasks/archive/2026-08-31-fingerprint-phase-1.md](ai/tasks/archive/2026-08-31-fingerprint-phase-1.md)
- Decision: `docs/ai/decisions.md` → Post-MVP, “Derive finding fingerprints in the extension from queued sent buffers”
- Unit-test evidence: [docs/testing/fingerprint-phase-1.tdd.md](testing/fingerprint-phase-1.tdd.md)

---

## What Phase 1 did

Phase 1 adds **per-finding hashes in the VS Code extension**, computed from:

1. Fields already present on scanner `VulnerabilityMetadata` (`rule_id`, `cwe_id`, `instance_kind`, `instance_name`, `file_path`, `line_number`, optional `taint_trace`).
2. A **queued snapshot of file text** that was last sent on analysis-triggering IPC.

It does **not** change the scanner binary, the stdin/stdout message types, or the SessionStore snapshot JSON. Panels, diagnostics, and session metrics still consume the same unfingerprinted findings as before. Hashes exist only for the duration of the `onFindings` callback (plus whatever the caller keeps in memory). They are not written to `workspaceState`.

The implementation lives in:

| File | Role |
|---|---|
| `src/modules/detection/bridge/fingerprint.ts` | vscode-free hasher, FIFO tracker, enclosing-path heuristic |
| `src/modules/detection/bridge/documentEvents.ts` | Records/enqueues buffers when analysis-triggering IPC is sent |
| `src/extension.ts` | Dequeues one snapshot per findings batch and calls `fingerprintScan` |
| `src/test/fingerprint.test.ts` | Mocha TDD unit tests for the hasher and tracker |

---

## Why the scanner core was left unchanged

The scanner payload already has type, CWE, severity, path, line, optional `rule_id`, optional `taint_trace` (`origin_line`, `sink_line`, `path_summary`), `instance_name`, and `instance_kind`. It does **not** currently include enclosing-symbol path, finding start/end ranges, taint source/sink ranges, or hashes.

Phase 1 therefore **derives** the missing identity inputs in TypeScript instead of extending that payload.

### What that choice buys

- The public extension repo can ship this slice without a coordinated scanner-contract change.
- Existing IPC (`Init`, `OpenFile`, `UpdateFile`, `CreateFile`, `DeleteFile`, `RenameFile`, `CloseFile`) stays as-is.
- SessionStore and `analyzeSession` keep grouping by CWE/type as they did before this work.

### What that choice costs (observed, not hypothetical product claims)

- **Coarser content.** Content is a normalized **line** (or two lines when `taint_trace` is present), not a byte range. Two different statements on the same line, or two findings that share method + `instance_name` and only differ by line slice, can share a continuity key. The code then marks **both** rows `continuityAmbiguous` rather than picking a winner.
- **Heuristic enclosing path.** Java `package.class.method` is inferred by a brace-depth scan of snapshot text, not by the scanner’s AST. Nested types, lambdas, compact constructors, and unusual formatting can yield a wrong or missing path. A missing path makes the finding **ineligible**, not a guessed identity.
- **Init vs editor buffers.** `Init` analyses the workspace on disk before `OpenFile` sends editor text. Phase 1 pairs `Init` with an **empty** snapshot so those findings are ineligible, rather than hashing later `OpenFile` text the scanner did not use for that analysis.
- **FIFO pairing is an approximation.** Each analysis-triggering send enqueues one buffer map; each findings callback dequeues one. If a findings line arrives without a matching send, or sends and findings get out of order, the snapshot is missing or wrong. Missing snapshot → ineligible. There is no repair heuristic.
- **Secret-bearing lines.** Content hashes include string literals and parsed property **values**. Identical secrets produce identical content hashes. Hashes are not logged; they are also not persisted. They still exist in process memory during the callback.
- **`.env` hygiene is excluded.** Rule `config.env.not_gitignored` is never continuity-eligible.

---

## What it does currently (runtime)

### When buffers are recorded vs enqueued

| Event | Records live buffer | Enqueues a snapshot (pairs with a findings batch) |
|---|---|---|
| `Init` | reset, then empty map | yes (empty on purpose) |
| `OpenFile` | yes | no |
| `UpdateFile` (debounced) | yes | yes |
| `CreateFile` | yes (empty content, same as before) | yes |
| `DeleteFile` | delete path | yes |
| `RenameFile` | rename key | yes |
| `CloseFile` | no (flush pending update first if any) | no (CloseFile itself does not analyse) |

On session restart, pending debounce timers are cleared and the tracker is reset, then `Init` runs again.

### What `fingerprintScan` produces

For each finding, a `FindingFingerprint`:

- `fingerprintVersion` — currently `1`
- `logicalFingerprint` — SHA-256 of the logical canonical string
- `contentFingerprint` — SHA-256 of the content canonical string
- `scopeFingerprint` — SHA-256 of the scope canonical string
- `continuityEligible` / `continuityAmbiguous`
- `ineligibilityReason` when not eligible

Canonical strings are:

```text
ariadne-fp v1 <kind>
name:<utf8ByteLength>:<payload>
```

fields joined by newlines. Hashes are lowercase hex from Node `crypto` SHA-256.

**Logical fields:** `rule_id`, `cwe_id`, `instance_kind`, `instance_name`, `enclosing_symbol_path`. Detector `type` (title) is not hashed when `rule_id` is present.

**Scope fields:** workspace-relative file path, `enclosing_symbol_path`.

**Content:**

- Java without taint: normalized finding line (`//` outside strings stripped, whitespace collapsed, string literals kept, no NFC rewrite).
- Java with `taint_trace` origin and sink lines both `> 0`: those two normalized lines.
- `application.properties` or `config.secrets.*`: parsed property **value** only.

**Continuity key** used for intra-scan duplicate detection: `(fingerprintVersion, logicalFingerprint, scopeFingerprint)`. Content is **not** part of that key. Content is the restoration discriminator for a later phase; Phase 1 only computes it.

**Ineligible when:** missing `rule_id`; rule is `config.env.not_gitignored`; no dequeued snapshot; file not in that snapshot; path not under the workspace root; enclosing path cannot be derived; content slice/value missing.

### What the UI and store do with this

Nothing, except a Debug Console count line:

`Fingerprints: <unique-eligible> unique-eligible, <ambiguous> ambiguous, <ineligible> ineligible`

Active Vulnerabilities, diagnostics, Session Metrics, status bar, and toasts still use the raw findings / CWE-type snapshot path. No fingerprint is stored.

---

## What changed in this repo

**Added**

- `src/modules/detection/bridge/fingerprint.ts`
- `src/test/fingerprint.test.ts`, `src/test/tsconfig.json`
- `tsconfig.test.json`
- `npm run test:unit`
- Spec, plan, archived task brief, TDD evidence, this note

**Modified**

- `documentEvents.ts` — `registerDocumentEvents` returns `AnalysisBufferTracker`; analysis-triggering sends enqueue snapshots
- `extension.ts` — dequeue + `fingerprintScan` on `onFindings`; log counts only
- `docs/ai/architecture.md` — fingerprint step in the data-flow diagram
- `docs/ai/decisions.md` — Post-MVP decision recorded
- `docs/ai/future-work.md` — persist / range-hash / SessionStore write-queue called out
- `docs/ai/standards.md` — `fingerprint` listed on the bridge layer
- `package.json` / `tsconfig.json` — test compile uses `tsconfig.test.json`; main tsconfig types are `node` only (tests load mocha via the test tsconfig)

**Unchanged**

- Scanner IPC types in `messages.ts`
- `metadataToScanSnapshot` / SessionStore schema
- `analyzeSession` matching (still CWE/type adjacent-diff)
- Webview HTML and Trends UI (there is no new Trends UI)

---

## How the system behaves now (end-to-end)

```text
editor event
  → documentEvents sends IPC
  → if that IPC triggers analysis, enqueue a copy of last-sent file texts
  → scanner writes VulnerabilityMetadata[] on stdout
  → iostream calls onFindings
  → dequeue one snapshot (or undefined)
  → fingerprintScan(findings, snapshot, workspaceRoot)
  → existing convert → panels / diagnostics / SessionStore
  → debug log: fingerprint counts only
```

From a student’s point of view, squiggles and the Active Vulnerabilities list should look as they did before this slice. The only visible addition is extra text on the existing `[Ariadne Analysis]` console line, after a findings batch that also runs session analysis.

Known first-scan behaviour: the first findings after activation are usually **ineligible** (`missing-snapshot` or `missing-buffer`) because they belong to `Init`. Eligible hashes start after an analysis-triggering send that had recorded buffers (typically a debounced `UpdateFile`).

---

## What can be built on this

These are follow-ons that the current types and queue support. None of them are implemented.

1. **Persist fingerprints** on a scan record (or a parallel store) so two scans can be compared by continuity key instead of CWE/type counts.
2. **Match across scans in one session** using `(version, logical, scope)`, treating ambiguous and ineligible rows as inconclusive, and using `contentFingerprint` only as “same text restored” vs “same identity, different body”.
3. **Wire F / P / T (or whatever the Trends spec names) to those matches** — still a later task; Phase 1 does not compute them.
4. **If the scanner later emits ranges or enclosing path**, replace the line-slice / brace-depth inputs without changing the hash field names, by bumping `FINGERPRINT_VERSION` when the canonical string shape changes.
5. **Queue SessionStore writes.** `onFindings` is still `async` with unqueued `appendSnapshot`. Fast consecutive scans can interleave. That bug predates fingerprints and is unchanged.

Do not treat Phase 1 hashes as Trends scores. They are identity material only.

---

## Next plans / tasks (suggested order)

Not started; no new active task brief exists after Phase 1 was archived.

1. **Live wiring check (manual).** F5 Run Extension on a Java workspace. Expect Init findings mostly ineligible; after editing a `.java` file, unique-eligible should become non-zero if `rule_id` and enclosing path resolve. This has not been recorded as a passing test in-repo.
2. **Captured-scan fixture (optional).** Save one real `VulnerabilityMetadata[]` plus the file text from that analysis, and assert hashes / eligibility in a unit test. That is the first measurement against scanner output rather than synthetic Java.
3. **Session matching task.** New spec/plan/brief: persist hashes, compare consecutive scans, define match / absent / restored / ambiguous. Out of scope for Phase 1: save-settlement, SessionStore write-queue, UI rewrite, scanner payload changes.
4. **SessionStore write-queue** when scan rate makes lost snapshots visible.
5. **Scanner ranges** only if line-slice collisions show up on real findings and the team accepts a contract change.

---

## Accuracy and precision (what is actually known)

### What the tests prove

`npm run test:unit` compiled `tsconfig.test.json` and ran Mocha TDD UI: **23 passing** (2026-08-31). `npm run compile` (tsc + eslint + esbuild) passed.

Those 23 cases use a small `UserRepo` fixture, a one-line class, a properties line, and a `.env` hygiene stub. They show that, **on those fixtures**:

- Blank lines above a finding do not change the three hashes (line number is not a hash input).
- The same rule in two methods gets different logical and scope hashes.
- Renaming `instance_name` changes logical only.
- Changing detector `type` does not change hashes.
- Duplicate continuity keys in one scan are both marked ambiguous even when content hashes differ.
- Listed ineligibility reasons behave as coded (`missing-rule-id`, `missing-snapshot`, `missing-buffer`, `missing-enclosing-path` for empty secrets `instance_name`, `.env` exclusion).
- Config content hash equals SHA-256 of the length-prefixed property **value** `s3cret` in that test.
- NFC vs NFD of the same letter produce different content hashes.
- `//` comments outside strings are stripped; the string `"hardcoded"` remains in the content hash.

The FIFO class tests show dequeue returns the map as of enqueue, `recordFile` does not enqueue, and rename drops the old path.

### What has not been measured

- No test opens VS Code, sends IPC, or reads a real scanner stdout line.
- `documentEvents.ts` enqueue points and `extension.ts` dequeue are **untested**.
- No coverage reporter (`npm run test:coverage` does not exist).
- No captured payload from the scanner against `arinda-backend-trend-test` or any other project.
- Enclosing-path behaviour on nested classes, records, lambdas, or files with mixed braces on one line is **not** characterised beyond the fixtures above.
- Collision rate of line-level content slices on real multi-finding methods is **unknown**.
- FIFO desync rate under live debounce (`DEBOUNCE_MS = 300`) is **unknown**.
- Hashing has not been compared to a scanner-side AST path or to a human-labelled “same finding” set.

So: Phase 1 is **precise relative to its written canonical strings and the 23 fixtures**. It is **not** a measured accuracy figure for “this is the same finding the student edited” on a real session. Claiming a percentage would be invented.

### How to read Debug Console counts

- **Unique-eligible** — rows that hashed and did not share a continuity key with another eligible row in that batch.
- **Ambiguous** — eligible rows whose continuity key appeared more than once in that batch.
- **Ineligible** — rows that were not hashed (including typical Init).

Those counts are not a quality score. A high ineligible count on the first batch is expected. A high ambiguous count on a later `UpdateFile` batch means the current key is not unique enough for those rows, not that hashing “failed.”
