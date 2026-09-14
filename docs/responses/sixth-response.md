Confirmed: use the second option.

`T` is the user-facing Trend metric. Keep `F` only in stored research data/exports, and keep `P` internal for ranking Persisting entries and alerts. Do not show raw `F` or `P` to students.

That makes the key example behave sensibly:

```text
Session 2: 4 of 5 old SQL FLCs fixed  → T = +8.00
Session 3: last old FLC fixed; one new SQL FLC appears → T = +2.00
```

The new SQL finding does not dilute `T`; it remains visible in Active Vulnerabilities and Session Notifications.

# Ariadne Trends Framework — Consolidated Implementation Decision Summary

This summary supersedes the older F/P/T material that uses either:

- one permanent baseline plus a “new since baseline” bucket; or
- separate baseline groups for later instances.

Neither model is approved for this implementation.

## 1. Core model

- One `FindingLifecycleRecord` (FLC) represents one matched finding instance.
- A live/raw finding does not create or change an FLC.
- An unmatched finding creates an FLC only after a valid, settled save measurement.
- Keep only these public statuses:

  - Persisting
  - Improving
  - Resolved
  - Recurring

`candidate`, `provisional resolution`, and matching ambiguity are internal tracker states, never public statuses.

## 2. Scan flow

There is one scanner and one complete result shape. Live and save scans differ in routing, not in detection capability.

```text
Tracked-file change
→ debounced live scan
→ update diagnostics and left Active Vulnerabilities panel
→ no FLC, SessionRecord, or Trends update

Tracked-file save
→ full-workspace measurement scan
→ validate result
→ wait two seconds with no tracked-file change
→ update FLCs, SessionRecord, right-side metrics, Trends, and notifications
```

A saved result is:

```text
valid   = matching request ID, reason, revision; successful and complete
settled = valid and no tracked-file change for two seconds after its result
```

There are only those two gates—do not reintroduce `accepted` as a third state.

The right Session Metrics panel should reflect the latest valid, settled saved state. While a save is waiting for settlement, it can show a compact “Waiting for saved scan to settle” state rather than treating typing results as official metrics.

## 3. Required protocol overhaul

The current engine emits bare finding arrays, so it cannot safely distinguish an old live response from a saved or final measurement response.

Every analysis result must carry:

```text
requestId
reason: initial_sync | live_edit | save_measurement | final_session
workspaceRevision
success
complete
findings
analysis-context/version information
```

The extension increments `workspaceRevision` whenever a tracked file changes, is created, deleted, or renamed.

Relevant changes are needed in [documentEvents.ts](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/detection/bridge/documentEvents.ts), [messages.ts](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/detection/bridge/messages.ts), [iostream.ts](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/detection/bridge/iostream.ts), [session.rs](/home/zdrco/Projects/School/ariadne-project/ariadne-core/src/cli/session.rs), and [messages.rs](/home/zdrco/Projects/School/ariadne-project/ariadne-core/src/iostream/messages.rs).

## 4. FLC lifecycle rules

- Persisting eligibility: still present, at least two valid-settled detections, and at least 30 seconds observed.
- Resolution: one valid-settled absence is provisional only.
- Durable resolution: a second valid-settled absence at least five seconds later.
- A timer alone must never resolve a finding.
- A finding that returns after durable resolution is matched to its old FLC and records recurrence history.
- A genuinely unmatched same-type finding is a new FLC, not a recurrence.

Fingerprint matching must be one-to-one and versioned. Rust needs additional stable identity metadata: reliable rule/detector ID, enclosing symbol/scope, finding ranges, and source/sink ranges for taint findings. The extension can store hashes and fingerprint versions, not raw source text solely for Trends.

## 5. Sessions and storage

A session does not begin merely because the extension activates.

```text
First valid, settled save measurement after activation
→ create the active SessionRecord
```

Later valid-settled saves update that same record.

At deactivation:

```text
stop ordinary updates
→ flush pending editor buffers
→ request final_session scan
→ validate and settle it
→ complete the SessionRecord
```

If finalization fails, Ariadne may use the latest valid-settled checkpoint only if no tracked file changed after it. Otherwise, mark the session incomplete. An incomplete session has no official final `T`.

Replace unbounded raw snapshot history with:

```text
FindingLifecycleRecord[]        // long-lived instance history
SessionRecord[]                 // compact completed/incomplete session history
optional temporary raw results  // debugging or approved research only
```

`SessionRecord` should store the frozen previous-session comparison set:

```ts
trendComparisonByKey: {
  sourceSessionId: string;
  flcIds: string[];
  denominator: number;
  resolvedAtSourceFinal: number;
}
```

It belongs alongside `perInstanceLifecycleSummaries`; do not recompute it later from mutable current FLC state.

## 6. Metrics

For one vulnerability type `k`:

```text
E = all FLCs of type k ever created from valid-settled observations
D = FLCs in E that are durably resolved
A = FLCs in E currently active
w = severity weight for an active FLC
```

Research-only historical fix coverage:

```text
F_research = 10 × D / |E|
```

Internal persistence pressure for ranking:

```text
P_internal = 10 × Σ(active FLC severity weights) / |E|
```

`F_research` may move down when new active findings appear. That is acceptable because it is historical category coverage, not the student-facing Trend.

User-facing pairwise Trend:

```text
C = FLC IDs known at the final checkpoint of the prior completed session

T = 10 × (
  resolvedNow(C) - resolvedAtPriorSessionEnd(C)
) / |C|
```

- Session 1: `T = N/A`.
- Later active sessions: show `T_live` from the latest valid-settled checkpoint.
- Completed sessions: store `T_final`.
- A newly found FLC is excluded from the current session’s `T`.
- It enters the next session’s comparison set if it remains known.
- A true recurrence can make `T` negative, which is meaningful.

## 7. Worked SQL sequence

Assume all SQL findings are High severity (`w = 0.8`) and every stated fix has reached durable resolution.

| Checkpoint | Current state | User `T` | Research `F` | Internal `P` |
|---|---|---:|---:|---:|
| Session 1 final | A–E active | N/A | 0.00 | 8.00 |
| Session 2 final | A–D resolved; E active | +8.00 | 8.00 | 1.60 |
| Session 3 final | E resolved; new FLC-F active | +2.00 | 8.33 | 1.33 |
| Session 4 final | FLC-F active; new FLC-G active | 0.00 | 7.14 | 2.29 |
| Scenario 6 recurrence | A returns; A, F, G active | -1.43 | 5.71 | 3.43 |

In Session 3, `T = +2.00` because it measures completion of the last old FLC, E. FLC-F is not ignored: it is active on the left panel and should receive an Attention notification if it is omitted from visible Trend rankings.

## 8. UI decisions

Keep the current right-side Trends area as a collapsible card. Do not add a separate “Needs Attention” UI group.

Collapsed rows remain limited to:

```text
Persisting Patterns
Improving Trends
Resolved This Session
Recurring
```

Expanded content:

- group by vulnerability type;
- show aggregate counts only;
- do not show A–E file/line lists inside Trends;
- link to Active Vulnerabilities when location-level detail is needed.

Example:

```text
Improving Trends
  SQL Injection
  Some progress (+2.00)
  1 prior unresolved instance fixed

Session Notification
  SQL Injection: 1 active instance still needs review.
  Open Active Vulnerabilities
```

A type can have positive historical progress and still have a newer active finding. That is not contradictory: the Trend describes prior-session work; the notification protects the newer active finding from being overlooked.

Attention belongs in the existing scrollable Session Notifications feed alongside recurrence and other cards. It is not a status. Its condition should be recalculated from valid-settled results, so dismissing a card must not permanently hide an unresolved eligible finding.

## 9. User-facing score language

Use a descriptive phrase plus the decimal:

```text
Some progress (+2.00)
```

These phrases are explanations, not new statuses.

Recommended implementation bands, accommodating decimals:

| Positive `T` | Description |
|---|---|
| `0 < T < 4` | Some progress |
| `4 ≤ T < 7` | Clear progress |
| `7 ≤ T ≤ 10` | Major progress |

`T = 0` does not appear as an Improving status. Negative `T` remains a signed detail within Persisting or Recurring; it must not create a fifth public status.

## 10. Ranking and limits

- Improving entries: sort by highest positive `T`; show the top five vulnerability types.
- Persisting entries: sort by highest `P_internal`.
- Resolved and Recurring: show type/count summaries under their permitted status.

Do not hard-code one raw rule such as `P >= 6` across every severity. Low and Medium findings may never reach that value. Use either severity-normalized thresholds or a visual cap with an overflow/Attention mechanism.

## 11. Extension overhaul

Replace the current adjacent-snapshot/type-count system in [snapshotAnalyzer.ts](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/analysis/snapshotAnalyzer.ts). It currently treats “persisting” as a simple scan-to-scan count comparison and labels it “Recurring,” which must be corrected.

The main work is:

1. Add correlated scan request/result envelopes.
2. Add saved-measurement and final-session triggers.
3. Add fingerprinting and FLC matching.
4. Add lifecycle/session manager and serialized persistence writes.
5. Replace raw `ScanSnapshot[]` storage in [sessionStore.ts](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/storage/sessionStore.ts).
6. Add SessionRecord/FLC types and migration handling.
7. Rebuild Session Metrics types and rendering in [panelTypes.ts](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/panelTypes.ts) and [sessionMetrics.ts](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/sessionMetrics.ts).
8. Add tests for settling, stale responses, durable resolution, recurrence, Scenario 2–6 math, shutdown fallback, and incomplete sessions.

## 12. Values still needing explicit lead sign-off

These were discussed but not numerically finalized:

- exact user-facing Trend bands and wording;
- whether the top-five Improving limit is fixed or configurable;
- Persisting threshold/cap behavior after severity normalization;
- whether public Recurring appears after one validated return or a higher recurrence count;
- whether collapsed rows show type count, instance count, or both clearly labeled;
- shutdown timeout and raw-data retention policy.

Everything else above is ready to become the implementation specification.