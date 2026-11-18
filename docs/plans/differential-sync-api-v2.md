# Implementation Plan: Differential Session Sync & Chunking (API v2)

## 1. Overview
Upgrade `SessionForwarder` from transmitting full raw JSON snapshots on every save to a differential, state-hashed, and chunked protocol to eliminate HTTP 413 errors and protect Railway storage limits.

---

## 2. Key Architecture Decisions

| Component | Responsibility |
|---|---|
| `stateHasher.ts` | Computes a deterministic SHA-256 hash of the workspace tracking state (`FindingLifecycleRecord[]`, `completedSessions`, `sessionMeta`). |
| `diffEngine.ts` | Calculates the delta between current workspace state and the server's known state (`upsertLifecycles`, `newCompletedSessions`, `featureCountIncrements`). |
| `chunker.ts` | Slices large diffs (>64 KB) into batch chunks and applies Gzip compression (`zlib.gzip`). |
| `sessionForwarder.ts` | Orchestrates the handshake -> diff -> chunking flow on save (1-min debounce) and close (instant). |

---

## 3. Implementation Steps

### Phase 1: Client Utilities (`src/modules/tracker/ingest/diff/`)
- [ ] Create `stateHasher.ts`:
  - Stable serialization and SHA-256 hash generation for local session state.
- [ ] Create `diffEngine.ts`:
  - Filters `FindingLifecycleRecord[]` modified since `lastSyncedTimestamp`.
  - Filters `completedSessions` by server's `knownCompletedSessionIds`.
  - Computes feature count increments since last successful forward.
- [ ] Create `chunker.ts`:
  - Measures payload size; if > 64 KB, slices `upsertLifecycles` array across multiple chunk payloads.
  - Compresses payload buffers via Node's native `node:zlib` (Gzip).

### Phase 2: Client Forwarder Refactoring (`sessionForwarder.ts`)
- [ ] Add `postHandshake()` method:
  - Calls `POST /v1/session-forward/handshake`.
  - If `status === "up-to-date"`, immediately exits with zero further I/O.
- [ ] Add `postDiff()` method:
  - Takes diff chunks and POSTs them sequentially to `POST /v1/session-forward/diff`.
  - Uses `Content-Encoding: gzip`.
- [ ] Update `dispatch()` workflow:
  - Perform handshake first.
  - If `need-diff`, build diff, chunk, and transmit.
  - Update `lastSyncedTimestamp` and `lastSyncedStateHash` upon success.

### Phase 3: Unit Testing & Verification
- [ ] Unit tests for `stateHasher`: Verify hash stability across identical states.
- [ ] Unit tests for `diffEngine`: Verify only modified lifecycles and new completed sessions are included.
- [ ] Unit tests for `chunker`: Verify slicing on large arrays and Gzip round-trip.
- [ ] Integration validation with mock HTTP server testing both `up-to-date` and multi-chunk flows.

---

## 4. Backend Deliverable
The backend agent should implement the routes defined in:
`docs/specs/DIFFERENTIAL_SYNC_API_V2.md`
- `POST /v1/session-forward/handshake`
- `POST /v1/session-forward/diff` (with gzip body parser and upsert semantics)
