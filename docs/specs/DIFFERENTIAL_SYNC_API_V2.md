# Differential Session Sync & Chunking Specification (API v2)

This specification defines the contract between the **Ariadne VS Code Extension (Client)** and the **Ariadne Collection Server (Backend)**. It replaces full-snapshot session forwarding with state-hash handshaking, differential updates, and chunked transfers to prevent HTTP 413 (Payload Too Large) errors and stay comfortably within hosting storage limits (e.g., Railway 5 GB quota).

---

## 1. Protocol Architecture & Flow

Instead of dispatching massive full snapshots upon every save, synchronization follows a 2-step handshake-and-diff flow:

```text
┌─────────────────────────┐                               ┌─────────────────────────┐
│  VS Code Client         │                               │  Collection Server      │
│  (SessionForwarder)     │                               │  (Railway Backend)      │
└────────────┬────────────┘                               └────────────┬────────────┘
             │                                                         │
             │  1. Compute local state hash                            │
             │  2. POST /v1/session-forward/handshake                  │
             ├────────────────────────────────────────────────────────►│
             │     { clientId, workspaceId, clientStateHash }          │ Check if clientStateHash
             │                                                         │ matches stored state.
             │  3. Handshake Response                                  │
             │◄────────────────────────────────────────────────────────┤
             │     status: "up-to-date" | "need-diff"                  │
             │                                                         │
   [ If status == "up-to-date" ]                                       │
             │                                                         │
             │  ► Stop. No network bandwidth or DB storage used.       │
             │                                                         │
   [ If status == "need-diff" ]                                        │
             │                                                         │
             │  4. Extract modified entities & feature deltas          │
             │  5. Slice into chunks if payload exceeds threshold      │
             │  6. Compress payload with Gzip (Content-Encoding: gzip) │
             │  7. POST /v1/session-forward/diff                       │
             ├────────────────────────────────────────────────────────►│
             │     { chunk, baseStateHash, targetStateHash, delta }    │ Validate baseStateHash,
             │                                                         │ upsert diffs into DB,
             │  8. Diff ACK Response                                   │ update stored stateHash.
             │◄────────────────────────────────────────────────────────┤
             │     { success: true, currentServerStateHash }           │
             │                                                         │
```

---

## 2. Authentication & Common Headers

All API calls must include standard Bearer authorization:

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

For diff payloads that are compressed:
```http
Content-Encoding: gzip
```

---

## 3. Endpoint 1: Handshake

- **Route**: `POST /v1/session-forward/handshake`
- **Purpose**: Verify if the server already has the client's current state.

### Request Body (`HandshakeRequest`)

```typescript
export interface HandshakeRequest {
  format: "ariadne-sync-handshake";
  version: 2;
  timestamp: string; // ISO 8601

  /** SHA-256 hash of GitHub account ID (or null if unauthenticated) */
  clientId: string | null;

  /** Stable SHA-256 hash of workspace root path */
  workspaceId: string;

  /**
   * Deterministic SHA-256 hash of all findings + sessions + counts
   * Representing the current state of the workspace.
   */
  clientStateHash: string;

  /** High-level seeds to quickly identify session resets */
  meta: {
    sessionIdSeed: number;
    totalScansCount: number;
  };
}
```

### Response Body (`HandshakeResponse`)

#### Case A: Server is already in sync with client state
HTTP Status: `200 OK`
```json
{
  "status": "up-to-date",
  "serverStateHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
*Client action: Done. Abort sync immediately.*

#### Case B: Server requires diff update
HTTP Status: `200 OK`
```json
{
  "status": "need-diff",
  "serverStateHash": "d41d8cd98f00b204e9800998ecf8427e",
  "knownCompletedSessionIds": ["session-001", "session-002"],
  "lastSyncedTimestamp": 1794837600000
}
```

---

## 4. Endpoint 2: Diff / Delta Ingestion

- **Route**: `POST /v1/session-forward/diff`
- **Purpose**: Receive and apply only modified entities, sliced into manageable chunks if necessary.

### Request Body (`DiffRequest`)

```typescript
export interface DiffRequest {
  format: "ariadne-session-diff";
  version: 2;
  timestamp: string; // ISO 8601
  trigger: "save" | "close";

  clientId: string | null;
  workspaceId: string;

  /** Hash server should currently be on (from handshake) */
  baseStateHash: string | null;

  /** Target hash the server will reach after applying this diff */
  targetStateHash: string;

  /** Client environment details */
  client: {
    extensionVersion: string;
    vscodeVersion: string;
    platform: string;
  };

  /** Chunking envelope */
  chunk: {
    chunkId: string;     // Unique UUID per sync batch
    index: number;       // 1-indexed (e.g. 1)
    totalChunks: number; // Total chunks in this batch (e.g. 3)
  };

  /** The differential changes to apply */
  delta: {
    /** Any completed sessions not present in server's knownCompletedSessionIds */
    newCompletedSessions: SessionRecord[];

    /** Active session state (only sent if active session modified) */
    activeSessionUpdate: {
      sessionId: string;
      startedAt: number;
      status: "completed" | "incomplete" | "active";
      latestCheckpoint?: {
        timestamp: number;
        findingsCount: number;
        severityCounts: Record<string, number>;
      };
    } | null;

    /** Only finding lifecycles updated or created since lastSyncedTimestamp */
    upsertLifecycles: FindingLifecycleRecord[];

    /** Interaction increments observed since the previous sync */
    featureCountIncrements: {
      explainVulnerabilityDelta: number;
      auditGraphOpenDelta: number;
      fileLocationOpenDelta: number;
    };
  };
}
```

### Response Body (`DiffResponse`)

#### Success Response
HTTP Status: `200 OK`
```json
{
  "success": true,
  "chunkReceived": 1,
  "chunksRemaining": 0,
  "currentServerStateHash": "a6b8c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

#### Re-sync Required (Hash Mismatch / Conflict)
HTTP Status: `409 Conflict`
```json
{
  "success": false,
  "error": "STATE_HASH_MISMATCH",
  "serverStateHash": "actual-server-hash",
  "message": "Server state does not match baseStateHash. Initiate fresh handshake."
}
```

---

## 5. Chunking Rules & Slicing Threshold

1. **Threshold**:
   - If the serialized delta JSON payload is **> 64 KB** uncompressed, the client must slice `upsertLifecycles` across multiple chunk requests.
2. **Chunk Assembly**:
   - Each chunk has identical `chunk.chunkId`, incrementing `chunk.index`, and fixed `chunk.totalChunks`.
   - The server buffers incoming chunks by `chunkId`.
   - When all chunks arrive (`chunk.index === chunk.totalChunks`), the server executes an atomic database transaction to persist the entities.
3. **Chunk Failure**:
   - If any chunk fails (network drop / timeout), the client retries that specific chunk or re-initiates the sync on the next save cycle.

---

## 6. Server Database Upsert Semantics

To prevent disk runaway on Railway (5 GB limit), the server **must not** append duplicate rows on every sync. Instead, it must execute **upserts**:

1. **Findings Table (`finding_lifecycles`)**:
   ```sql
   INSERT INTO finding_lifecycles (client_id, workspace_id, logical_fingerprint, data, updated_at)
   VALUES ($1, $2, $3, $4, NOW())
   ON CONFLICT (client_id, workspace_id, logical_fingerprint)
   DO UPDATE SET
     data = EXCLUDED.data,
     updated_at = NOW();
   ```

2. **Sessions Table (`completed_sessions`)**:
   ```sql
   INSERT INTO completed_sessions (client_id, workspace_id, session_id, data, completed_at)
   VALUES ($1, $2, $3, $4, NOW())
   ON CONFLICT (client_id, workspace_id, session_id)
   DO NOTHING;
   ```

3. **Workspace State Record (`workspace_state`)**:
   ```sql
   INSERT INTO workspace_state (client_id, workspace_id, state_hash, feature_counts, updated_at)
   VALUES ($1, $2, $3, $4, NOW())
   ON CONFLICT (client_id, workspace_id)
   DO UPDATE SET
     state_hash = EXCLUDED.state_hash,
     feature_counts = EXCLUDED.feature_counts,
     updated_at = NOW();
   ```

---

## 7. Concrete Example: Typical Diff Payload

```json
{
  "format": "ariadne-session-diff",
  "version": 2,
  "timestamp": "2026-11-18T08:45:00.000Z",
  "trigger": "save",
  "clientId": "a35f79bc89234857ef1234567890abcdef1234567890abcdef1234567890abcd",
  "workspaceId": "f78234891234abcdef567890abcdef1234567890abcdef1234567890abcdef12",
  "baseStateHash": "1111111111111111111111111111111111111111111111111111111111111111",
  "targetStateHash": "2222222222222222222222222222222222222222222222222222222222222222",
  "client": {
    "extensionVersion": "0.1.5",
    "vscodeVersion": "1.100.0",
    "platform": "linux-x64"
  },
  "chunk": {
    "chunkId": "3b29c118-20da-4a57-8176-7871b658d3c1",
    "index": 1,
    "totalChunks": 1
  },
  "delta": {
    "newCompletedSessions": [],
    "activeSessionUpdate": {
      "sessionId": "session-002",
      "startedAt": 1794837600000,
      "status": "active",
      "latestCheckpoint": {
        "timestamp": 1794837900000,
        "findingsCount": 1,
        "severityCounts": { "critical": 1, "high": 0, "medium": 0, "low": 0 }
      }
    },
    "upsertLifecycles": [
      {
        "logicalFingerprint": "CWE-89:query:src/Main.java:24",
        "cweId": "CWE-89",
        "type": "SQL Injection",
        "severity": "critical",
        "lifecycleState": "persisting",
        "confirmationCount": 4,
        "recurrenceCount": 0,
        "baselineOccurrenceCount": 1,
        "currentOccurrenceCount": 1,
        "firstObservedAt": 1794837600000,
        "lastObservedAt": 1794837900000,
        "missingSince": null,
        "provisionalResolutionAt": null,
        "durableResolutionAt": null
      }
    ],
    "featureCountIncrements": {
      "explainVulnerabilityDelta": 1,
      "auditGraphOpenDelta": 0,
      "fileLocationOpenDelta": 0
    }
  }
}
```
