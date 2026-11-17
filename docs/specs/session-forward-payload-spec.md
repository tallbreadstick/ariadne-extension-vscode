# Ariadne Session Forward Payload Specification

This document specifies the HTTP request and JSON body format that the **Ariadne VS Code extension** sends to the collection server endpoint.

---

## 1. HTTP Request Overview

- **Method**: `POST`
- **Route**: `/v1/session-forward`
- **Full URL**: `${ariadne.metricsIngest.baseUrl}/v1/session-forward`
- **Headers**:
  ```http
  Authorization: Bearer <API_KEY>
  Content-Type: application/json
  Content-Length: <BYTE_LENGTH>
  ```
- **Expected Response**:
  - `200 OK` (or any `2xx` HTTP status code) indicating success.

---

## 2. Top-Level Payload Schema

```typescript
interface SessionForwardPayload {
  /** Fixed format identifier */
  format: "ariadne-session-forward";

  /** Schema version */
  version: 1;

  /** ISO 8601 timestamp when forwarded */
  forwardedAt: string;

  /** What caused the forward: 'save' (1-min debounce timer) or 'close' (editor exit) */
  trigger: "save" | "close";

  /** GitHub numeric account ID (e.g., "12345678"), or null if unavailable */
  githubAccountId: string | null;

  /** One-way SHA-256 hashed GitHub account ID, or null if unavailable */
  githubUsername: string | null;

  /** Client environment metadata */
  client: {
    extensionVersion: string; // e.g. "0.1.4"
    vscodeVersion: string;      // e.g. "1.100.0"
    platform: string;           // e.g. "linux-x64", "darwin-arm64", "win32-x64"
  };

  /** Counts of user interactions with tracked features */
  featureCounts: {
    explainVulnerabilityCount: number;
    auditGraphOpenCount: number;
    fileLocationOpenCount: number;
  };

  /** Complete session tracking snapshot (exact same structure as 'Export session data') */
  sessionSnapshot: SessionDataExport;
}
```

---

## 3. Session Snapshot Structure (`sessionSnapshot`)

```typescript
interface SessionDataExport {
  format: "ariadne-session-export";
  version: 1;
  exportedAt: string;

  /** In-progress session, or null if no session has settled yet */
  activeSession: SessionRecord | null;

  /** History of completed sessions in this workspace */
  completedSessions: SessionRecord[];

  /** All finding lifecycle states tracked in this workspace */
  findingLifecycles: FindingLifecycleRecord[];

  /** Session seeds and metadata */
  sessionMeta: {
    sessionStartTime: number;
    totalScansCount: number;
    scanIdSeed: number;
    sessionIdSeed: number;
  };

  /** State of save-triggered scan routing */
  saveScanState: {
    initialCheckpointDoneAt: number | null;
    totalSaveScansThisSession: number;
    totalSettledCancellations: number;
  };

  /** Progression history for common vulnerability types */
  graduationHistory: Record<string, {
    consecutiveSessionsFixed: number;
    graduatedAt: number | null;
  }>;

  /** Notification IDs dismissed by the user */
  dismissedNotifications: string[];

  /** Session persisted synchronously on abrupt shutdown (if recovered) */
  pendingFinalizedSession: SessionRecord | null;

  /** Last expanded vulnerability card ID in the UI */
  expandedVulnKey?: string;
}
```

---

## 4. Key Nested Record Shapes

### `SessionRecord`
```typescript
interface SessionRecord {
  sessionId: string;            // e.g. "session-001"
  startedAt: number;            // epoch ms
  endedAt?: number;             // epoch ms
  status?: "completed" | "incomplete";
  baselineCheckpoint?: {
    timestamp: number;
    findings: ObservedFinding[];
  };
  finalCheckpoint?: {
    timestamp: number;
    findings: ObservedFinding[];
  };
  hourlyCheckpoints?: Array<{
    timestamp: number;
    findings: ObservedFinding[];
  }>;
  finalScores?: {
    f: number;                  // Fix score
    p: number;                  // Persistence score
    t: number | null;           // Trend score
  };
  lifecycleSummaries?: FindingLifecycleRecord[];
}
```

### `FindingLifecycleRecord`
```typescript
interface FindingLifecycleRecord {
  logicalFingerprint: string;   // e.g. "CWE-89:rawQuery:src/Database.java:42"
  cweId: string;                // e.g. "CWE-89"
  type: string;                 // e.g. "SQL Injection"
  severity: "critical" | "high" | "medium" | "low";
  lifecycleState: "candidate" | "confirming" | "persisting" | "improving" | "resolved" | "recurring";
  confirmationCount: number;
  recurrenceCount: number;
  baselineOccurrenceCount: number;
  currentOccurrenceCount: number;
  firstObservedAt: number;
  lastObservedAt: number;
  missingSince: number | null;
  provisionalResolutionAt: number | null;
  durableResolutionAt: number | null;
  isCommentedOut?: boolean;
}
```

---

## 5. Concrete JSON Example

```json
{
  "format": "ariadne-session-forward",
  "version": 1,
  "forwardedAt": "2026-11-16T14:55:00.000Z",
  "trigger": "save",
  "githubAccountId": "12345678",
  "githubUsername": "octocat",
  "client": {
    "extensionVersion": "0.1.4",
    "vscodeVersion": "1.100.0",
    "platform": "linux-x64"
  },
  "featureCounts": {
    "explainVulnerabilityCount": 5,
    "auditGraphOpenCount": 2,
    "fileLocationOpenCount": 8
  },
  "sessionSnapshot": {
    "format": "ariadne-session-export",
    "version": 1,
    "exportedAt": "2026-11-16T14:55:00.000Z",
    "activeSession": {
      "sessionId": "session-002",
      "startedAt": 1794837600000,
      "status": "completed",
      "baselineCheckpoint": {
        "timestamp": 1794837600000,
        "findings": []
      },
      "hourlyCheckpoints": []
    },
    "completedSessions": [],
    "findingLifecycles": [
      {
        "logicalFingerprint": "CWE-89:query:src/Main.java:24",
        "cweId": "CWE-89",
        "type": "SQL Injection",
        "severity": "critical",
        "lifecycleState": "persisting",
        "confirmationCount": 3,
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
    "sessionMeta": {
      "sessionStartTime": 1794837600000,
      "totalScansCount": 14,
      "scanIdSeed": 14,
      "sessionIdSeed": 2
    },
    "saveScanState": {
      "initialCheckpointDoneAt": 1794837600000,
      "totalSaveScansThisSession": 4,
      "totalSettledCancellations": 1
    },
    "graduationHistory": {},
    "dismissedNotifications": [],
    "pendingFinalizedSession": null,
    "expandedVulnKey": "CWE-89:query:src/Main.java:24"
  }
}
```
