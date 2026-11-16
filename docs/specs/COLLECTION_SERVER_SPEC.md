# Ariadne Collection Server API Specification

This document provides the API contract and JSON payload format sent by the **Ariadne VS Code extension** when forwarding session telemetry to the collection server.

---

## 1. HTTP Endpoint

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
  - `200 OK` (or any `2xx` HTTP status code)
  - The extension operates in a fire-and-forget manner; the response body is ignored.

---

## 2. Dispatch Triggers & Rules

| Trigger | Description | Timing Behavior |
|---|---|---|
| `save` | Triggered by file save events in the workspace. | Debounced by **60 seconds (1 minute)**. Rapid successive saves reset the timer; payload sends only after 1 quiet minute. |
| `close` | Triggered when the extension host shuts down (VS Code window close / reload). | Dispatched **immediately**, bypassing the debounce timer. |

---

## 3. Top-Level Payload Schema

```typescript
export interface SessionForwardPayload {
  /** Fixed format identifier */
  format: "ariadne-session-forward";

  /** Schema version number */
  version: 1;

  /** ISO 8601 timestamp when forwarded */
  forwardedAt: string;

  /** What caused the forward: 'save' (1-min debounce timer) or 'close' (editor exit) */
  trigger: "save" | "close";

  /** Numeric GitHub account ID (or null if unauthenticated) */
  githubAccountId: string | null;

  /** GitHub username handle (or null if unauthenticated) */
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

## 4. Session Snapshot Schema (`sessionSnapshot`)

```typescript
export interface SessionDataExport {
  format: "ariadne-session-export";
  version: 1;
  exportedAt: string;

  /** In-progress session, or null if no session has settled yet */
  activeSession: SessionRecord | null;

  /** History of completed sessions in this workspace */
  completedSessions: SessionRecord[];

  /** All finding lifecycle states tracked in this workspace */
  findingLifecycles: FindingLifecycleRecord[];

  /** Session seeds and scan count metadata */
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

## 5. Nested Object Definitions

### `SessionRecord`
```typescript
export interface SessionRecord {
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
export interface FindingLifecycleRecord {
  logicalFingerprint: string;   // e.g. "CWE-89:query:src/Main.java:24"
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

### `ObservedFinding`
```typescript
export interface ObservedFinding {
  logicalFingerprint: string;
  cweId: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  filePath: string;
  line: number;
  occurrenceCount: number;
}
```

---

## 6. Full JSON Example

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
        "findings": [
          {
            "logicalFingerprint": "CWE-89:query:src/Main.java:24",
            "cweId": "CWE-89",
            "type": "SQL Injection",
            "severity": "critical",
            "filePath": "src/Main.java",
            "line": 24,
            "occurrenceCount": 1
          }
        ]
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
