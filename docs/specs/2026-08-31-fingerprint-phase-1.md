# Spec: Fingerprint Phase 1

## Purpose

Give each scanner finding extension-side logical, content, and scope hashes so later Trends work can match findings across scans without changing the scanner payload or persisting lifecycle data yet.

## Scope

- in scope:
  - SHA-256 fingerprints derived in TypeScript from existing finding metadata plus queued sent file text
  - FIFO pairing of analysis-triggering IPC with the next findings callback
  - Continuity-key ambiguity marking within a single scan
  - Ineligibility when required inputs are missing or the finding is `.env` hygiene
- out of scope:
  - Scanner-core fields, ranges, or hashes
  - Request envelopes / revision ids
  - FLC / session records, F / P / T
  - Baseline groups, save-settlement, Trends UI
  - Persisting fingerprints in SessionStore
  - SessionStore write-queue for `onFindings`

## Proposed behavior

On every IPC that triggers analysis (`Init`, `CreateFile`, `DeleteFile`, `RenameFile`, `UpdateFile`), snapshot the last-sent file texts into a FIFO. `OpenFile` and `CloseFile` update or leave live buffers but do not enqueue. When findings arrive, dequeue one snapshot and hash against that text, not the live editor.

Canonical strings are `ariadne-fp v1 <kind>` plus `name:<utf8ByteLength>:<payload>` fields joined by newlines. Hashes are lowercase SHA-256 hex.

- **Logical** includes `rule_id`, `cwe_id`, `instance_kind`, `instance_name`, `enclosing_symbol_path`. Detector `type` is omitted when `rule_id` is present.
- **Scope** includes workspace-relative file path and `enclosing_symbol_path`.
- **Content** is a normalized Java line, taint origin+sink lines when `taint_trace` is present, or the parsed properties value (not `key=value`). Line comments outside strings are stripped; string literals are kept; Unicode is not NFC-normalized.
- **Enclosing path** is a brace-depth heuristic on snapshot Java, or the property key / `instance_name` for config secrets. Line numbers are not hash inputs.

Continuity key is `(fingerprintVersion, logicalFingerprint, scopeFingerprint)`. If more than one eligible row in a scan shares that key, every such row is `continuityAmbiguous` even when content hashes differ. Ambiguous and ineligible rows are not treated as matches.

`Init` is sent before `OpenFile`. Pair it with an empty snapshot so those findings are ineligible rather than hashing later editor text. Missing `rule_id`, snapshot, file buffer, relative path, enclosing path, or content, and rule `config.env.not_gitignored`, are ineligible. Store hashes only in memory; log counts, not hashes or source.

## Acceptance criteria

- [x] Hashes are SHA-256 hex from length-prefixed canonical strings; line numbers are not hash inputs
- [x] Enclosing symbol path comes from snapshot text + `line_number` (Java) or property key (config)
- [x] Missing `rule_id`, missing snapshot/buffer, failed enclosing path, or `.env` hygiene findings are continuity-ineligible
- [x] Duplicate continuity keys in one scan are ambiguous even when content differs
- [x] No raw source is stored; SessionStore snapshot format and scanner IPC are unchanged
- [x] Findings hash the dequeued sent snapshot, not the live editor buffer

## Constraints

- technical: vscode-free fingerprint module; Node `crypto` SHA-256; no new dependencies; brace-depth Java heuristic, not a parser
- product: extension-only so the private scanner does not need a contract change
- delivery: Phase 1 computes and counts fingerprints; Trends matching and persistence are later work

## Cross-repo impact

- scanner core: none
- bridge contract: none (inbound payload unchanged; hashes are extension-side only)

## Risks and open questions

- risk 1: Line-level content slices collide for two findings in the same method with the same `instance_name`
- risk 2: FIFO desync if a findings line arrives without a matching analysis send
- risk 3: First `Init` findings are usually ineligible
- question 1: Whether later phases persist fingerprints and replace line slices with scanner ranges

## Related docs

- plan: [2026-08-31-fingerprint-phase-1.md](../plans/2026-08-31-fingerprint-phase-1.md)
- task brief: [2026-08-31-fingerprint-phase-1.md](../ai/tasks/archive/2026-08-31-fingerprint-phase-1.md)
- decision: `docs/ai/decisions.md` (Post-MVP: derive fingerprints in the extension)
- TDD evidence: [fingerprint-phase-1.tdd.md](../testing/fingerprint-phase-1.tdd.md)
- status note: [fingerprint-phase-1.md](../fingerprint-phase-1.md)
