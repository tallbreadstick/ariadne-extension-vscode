# Common Vulnerabilities — Finalized Strategy

## Summary

**Common Vulnerabilities** is a type-level awareness metric that identifies which vulnerability categories a student frequently encounters across coding sessions. It operates at the `cweId::type` level (e.g., "SQL Injection") rather than individual finding instances.

**Strategy:** Option C (Session-Boundary Threshold) + Strategy 2 (Resolution-Aware Decay) + Session-Count Reset on Graduation Revocation.

**Parameters:**

| Parameter | Name | Value | Meaning |
|---|---|---|---|
| **K** | Entry threshold | 2 | Sessions the type must appear in to be classified as Common |
| **G** | Graduation threshold | 2 | Consecutive clean sessions (all FLCs resolved, no new instances) to graduate |

Both are configurable policy constants, not empirically-proven magic numbers. See [Literature Justification](#literature-justification) for defense rationale.

---

## Formal Definition

### Entry

$$\text{IsCommon}(\tau) \iff \text{session\_presence}(\tau) \geq K \;\wedge\; \neg\,\text{Graduated}(\tau)$$

where `session_presence(τ)` counts sessions **after the most recent graduation point** (or from the beginning if the type has never graduated).

### Graduation

$$\text{Graduated}(\tau) \iff \text{AllResolved}(\tau) \;\wedge\; \text{consecutive\_clean\_sessions}(\tau) \geq G$$

- **AllResolved(τ):** Every `FindingLifecycleRecord` with matching `cweId::type` has `durableResolutionAt !== null`
- **consecutive_clean_sessions(τ):** Count of most-recent consecutive sessions where no FLC of type τ was active (`durableResolutionAt === null && missingSince === null`)

### Re-entry After Graduation

When a graduated type reappears:
1. Graduation is revoked
2. `session_presence` resets — only sessions **after** the graduation point are counted
3. The type must accumulate K new sessions to re-enter Common

**Rationale:** K = 2 means "a pattern requires 2 sessions." A single reappearance after graduation is a slip, not a pattern. The same entry threshold applies to re-entry for consistency.

### In Plain Language

> A vulnerability type is a **Common Vulnerability** if:
> 1. The student has encountered it in **2 or more coding sessions** (counting only from the last graduation, if any), AND
> 2. The student has NOT **graduated** from it (all findings resolved AND absent for 2 consecutive sessions).
>
> If a graduated type reappears, the session counter resets — the student gets a clean slate and must show a pattern of reintroduction (2+ sessions) before it's flagged as Common again.

---

## Complete Pseudocode

```typescript
import type {
    FindingLifecycleRecord,
    SessionRecord,
} from './lifecycleTypes.js';

/** Result for a single Common Vulnerability type. */
interface CommonVulnerabilityEntry {
    type: string;
    cweId: string;
    sessionCount: number;
    totalSessions: number;
    isGraduated: boolean;
    totalRecurrences: number;
    activeFindingCount: number;
}

/** Tracks graduation history for session-count reset. */
interface TypeGraduationState {
    /** Index into completedSessions after which this type last graduated.
     *  Null if the type has never graduated. */
    graduatedAfterSessionIndex: number | null;
}

/**
 * Computes Common Vulnerabilities across all sessions.
 *
 * A vulnerability TYPE is "Common" if it appeared in >= K sessions
 * (counting only from the last graduation point) and has not graduated
 * (all findings resolved for >= G consecutive recent sessions).
 *
 * @param completedSessions  All completed SessionRecords (chronological)
 * @param activeSession      The current active session (null if none)
 * @param currentLifecycles  Live FindingLifecycleRecord[] for active session
 * @param graduationHistory  Per-type graduation state (persisted)
 * @param K                  Session-presence threshold (default: 2)
 * @param G                  Graduation threshold (default: 2)
 */
function computeCommonVulnerabilities(
    completedSessions: SessionRecord[],
    activeSession: SessionRecord | null,
    currentLifecycles: FindingLifecycleRecord[],
    graduationHistory: Map<string, TypeGraduationState>,
    K: number = 2,
    G: number = 2,
): Map<string, CommonVulnerabilityEntry> {

    // Build list of all sessions (completed + active)
    const allSessions = [...completedSessions];
    if (activeSession) {
        allSessions.push({
            ...activeSession,
            lifecycleSummaries: currentLifecycles,
        });
    }

    const totalSessions = allSessions.length;

    // Step 1: Count session presence per type (from last graduation point)
    const typeData = new Map<string, {
        type: string;
        cweId: string;
        sessionCount: number;
    }>();

    for (const [sessionIdx, session] of allSessions.entries()) {
        const typesInSession = new Set<string>();

        for (const flc of session.lifecycleSummaries) {
            const key = `${flc.cweId}::${flc.type}`;
            if (typesInSession.has(key)) continue;
            typesInSession.add(key);

            // Only count sessions AFTER the last graduation point
            const gradState = graduationHistory.get(key);
            const countFrom = gradState?.graduatedAfterSessionIndex ?? -1;
            if (sessionIdx <= countFrom) continue;

            const entry = typeData.get(key) ?? {
                type: flc.type,
                cweId: flc.cweId,
                sessionCount: 0,
            };
            entry.sessionCount++;
            typeData.set(key, entry);
        }
    }

    // Step 2: Check graduation and build result
    const common = new Map<string, CommonVulnerabilityEntry>();

    for (const [key, data] of typeData) {
        if (data.sessionCount < K) continue;

        // Aggregate lifecycle data for this type from current state
        const typeFLCs = currentLifecycles.filter(
            flc => `${flc.cweId}::${flc.type}` === key,
        );

        const allResolved = typeFLCs.length > 0 && typeFLCs.every(
            flc => flc.durableResolutionAt !== null,
        );

        // Count consecutive recent clean sessions (walk backwards)
        let consecutiveClean = 0;
        if (allResolved) {
            for (let i = completedSessions.length - 1; i >= 0; i--) {
                const hasActive = completedSessions[i].lifecycleSummaries.some(
                    flc => `${flc.cweId}::${flc.type}` === key
                        && flc.durableResolutionAt === null
                        && flc.missingSince === null,
                );
                if (hasActive) break;
                consecutiveClean++;
            }
        }

        const graduated = allResolved && consecutiveClean >= G;

        if (graduated) {
            // Record graduation point for future session-count reset
            graduationHistory.set(key, {
                graduatedAfterSessionIndex: completedSessions.length - 1,
            });
            continue; // Graduated types are not Common
        }

        const totalRecurrences = typeFLCs.reduce(
            (sum, flc) => sum + flc.recurrenceCount, 0,
        );
        const activeFindingCount = typeFLCs.filter(
            flc => flc.missingSince === null && flc.durableResolutionAt === null,
        ).length;

        common.set(key, {
            type: data.type,
            cweId: data.cweId,
            sessionCount: data.sessionCount,
            totalSessions,
            isGraduated: false,
            totalRecurrences,
            activeFindingCount,
        });
    }

    return common;
}
```

---

## Behavior Table

| Scenario | session_presence | Graduated? | Common? |
|---|---|---|---|
| SQL Injection in 1 session | 1 (< K) | — | **No** |
| SQL Injection in 2 sessions, active FLCs | 2 (≥ K) | No (active FLCs) | **Yes** |
| SQL Injection in 3 sessions, all resolved, 1 clean session | 3 (≥ K) | No (1 < G) | **Yes** |
| SQL Injection in 3 sessions, all resolved, 2 clean sessions | 3 (≥ K) | **Yes** | **No** (graduated) |
| Graduated, reappears in 1 new session | 1 (reset, < K) | Revoked | **No** (single slip) |
| Graduated, reappears in 2 new sessions | 2 (reset, ≥ K) | Revoked | **Yes** (pattern re-established) |

---

## Worked Example — SQL Injection with Graduation and Re-entry

### Timeline

| Session | Event | session_presence (post-reset) | Graduated? | Common? |
|---|---|---|---|---|
| 1 | FLC `A` created (LoginController.java) | 1 | No | **No** (< K) |
| 2 | FLC `B` created (UserRepo.java). `A` still active | 2 | No | **Yes** |
| 3 | `A` and `B` both durably resolved | 3 | No (0 clean) | **Yes** |
| 4 | No SQL Injection. Clean session. | 3 | No (1 clean) | **Yes** |
| 5 | No SQL Injection. Clean session. | 3 | **Yes** (2 clean) | **No** ✅ |
| 6 | No SQL Injection | — | Graduated | **No** |
| 7 | FLC `C` created (AdminController.java) — slip | 1 (reset) | Revoked | **No** (1 < K) |
| 8 | No SQL Injection. `C` still active | 1 | No | **No** (1 < K) |
| 9 | FLC `D` created (ReportService.java) | 2 (reset) | No | **Yes** ← pattern re-established |

### Key observations

- **Session 5:** Graduation triggers. Student demonstrated both remediation (all resolved) and prevention (2 clean sessions).
- **Session 7:** Single reappearance after graduation. Session count resets to 1. Not immediately re-labeled as Common — the student gets a fair chance.
- **Session 9:** Second post-graduation session with SQL Injection. Now K = 2 is met again → Common. The pattern is re-established.

---

## Edge Cases

| Edge Case | Behavior |
|---|---|
| Same CWE/type, different files/lines | Same type key — all contribute to one Common entry |
| Fewer than K sessions total | No type qualifies. Panel: "Not enough session data yet." |
| Type persists every session, never fixed | Common forever. Cannot graduate (AllResolved is false) |
| Type graduated, reappears once, then disappears | session_presence = 1 (reset). Never reaches K again → stays graduated effectively |
| Type graduates multiple times | Each graduation resets the counter. Only post-latest-graduation sessions count |
| Active session has findings but no completed sessions | Active session counts toward session_presence but graduation requires completed sessions |

---

## Schema Impact

### Existing fields used (no changes needed)

| Field | Source | Used for |
|---|---|---|
| `cweId` | `FindingLifecycleRecord` | Type identity key |
| `type` | `FindingLifecycleRecord` | Type identity key |
| `durableResolutionAt` | `FindingLifecycleRecord` | AllResolved check |
| `missingSince` | `FindingLifecycleRecord` | Active finding detection |
| `recurrenceCount` | `FindingLifecycleRecord` | Dashboard display |
| `lifecycleSummaries` | `SessionRecord` | Per-session type presence |
| `sessionId` | `SessionRecord` | Session identity |

### New state needed

| Field | Type | Purpose |
|---|---|---|
| `graduatedAfterSessionIndex` | `number \| null` | Per-type. Tracks when the type last graduated for session-count reset. Persisted alongside graduation history. |

This is a small addition to the `workspaceState` persistence — a `Map<string, TypeGraduationState>` stored alongside existing lifecycle and session data.

---

## Literature Justification

The threshold values K = 2 and G = 2 are **configurable policy constants** — initial values proposed for pilot deployment, subject to empirical tuning.

### Defense rationale

| Parameter | Justification | Literature Category |
|---|---|---|
| **K = 2** | Minimum observations to establish a non-singleton pattern. One error is a slip; two indicate a systematic knowledge gap. | Repeated error analysis, formative assessment thresholds, statistical pattern minimum |
| **G = 2** | Minimum spaced demonstrations of mastery. One clean session could be coincidence; two across spaced intervals suggests internalization. | Bloom's mastery learning, Leitner system, criterion-referenced thresholds, spacing effect |
| **Session-count reset** | Analogous to Leitner box reset — a relapse sends the learner back to the start of the assessment cycle, requiring re-demonstration of the pattern. A single relapse is not immediately equated with the original pattern. | Leitner system, skill regression models, behavioral extinction/spontaneous recovery |
| **Configurable constants** | Domain-specific thresholds in adaptive learning systems are heuristic starting points refined through empirical observation. | Bayesian Knowledge Tracing, educational data mining |

Full literature search guide: [`common_vulnerabilities_literature_justification.md`](file:///c:/Users/Ervin/Downloads/common_vulnerabilities_literature_justification.md)

---

## Relationship to Existing Metrics

```
                          ┌───────────────────────────────┐
                          │   INSTANCE-LEVEL LIFECYCLE    │
                          │   (per FindingLifecycleRecord)│
                          │   Scope: current session      │
                          │                               │
                          │  → Persisting Patterns        │
                          │  → Improving Trends           │
                          │  → Resolved This Session      │
                          │  → Recurring Patterns         │
                          │                               │
                          │  → Trends section             │
                          └───────────────────────────────┘

                          ┌───────────────────────────────┐
                          │   TYPE-LEVEL AWARENESS        │
                          │   (per cweId::type, across    │
                          │    ALL sessions)              │
                          │   Scope: cross-session        │
                          │                               │
                          │  → Common Vulnerabilities     │
                          │    (with graduation +         │
                          │     session-count reset)      │
                          │                               │
                          │  → Own dedicated section      │
                          └───────────────────────────────┘
```

Common Vulnerabilities is **independent** of the four instance-level lifecycle statuses. A finding can be Persisting, Improving, Resolved, or Recurring — regardless of its lifecycle status, if its *type* has appeared in K+ sessions, the type is flagged as Common. The lifecycle statuses tell the student what's happening with individual findings *right now*; Common Vulnerabilities tells them which *categories* they keep encountering and should study prevention for.

---

## Capstone Defense Explanation (2–3 sentences)

> Common Vulnerabilities is a type-level awareness metric that identifies which vulnerability categories a student frequently encounters across coding sessions by aggregating per-finding lifecycle records by their CWE ID and type name. A vulnerability type enters the Common list when it appears in K ≥ 2 distinct sessions and graduates out when all of its findings are durably resolved and it remains absent for G ≥ 2 consecutive sessions; if a graduated type reappears, the session counter resets so that the type must re-establish a pattern of K sessions before being re-classified as Common. This graduation-with-reset mechanism, grounded in mastery learning and spaced repetition principles, ensures the metric dynamically reflects the student's current preventative awareness rather than permanently labeling historical encounters.
