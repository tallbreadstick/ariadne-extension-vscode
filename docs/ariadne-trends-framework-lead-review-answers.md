# Ariadne Trends Framework — Lead Review Answers

**Purpose:** This answers every question from the lead-review notes in plain language. It follows the final implementation walkthrough exactly. It describes the proposed implementation, not the current extension behaviour.

> **Required clarification (25 August 2026):** The lead confirmed that Trends measurements are **save-triggered**, followed by a two-second unchanged-workspace settlement check. The current authoritative document is [Save-Triggered Settlement and Baseline-Group Clarification](ariadne-trends-framework-realtime-stability-and-cohort-clarification.md). It also replaces the redundant `accepted` label and corrects F/P/T to fixed baseline-group calculations built from per-instance FLCs. Where this older answer sheet conflicts, follow the clarification document.

**Important scope decision:** Ariadne does **not** calculate aggregate cross-session `F_cross` or `P_cross`. It keeps completed SessionRecords and FindingLifecycleRecords (FLCs) only to recognise lifecycle history, recurrence, durable resolution, and the per-cohort pairwise `T` comparison.

---

## Shared rules used in the answers

| Rule | Final decision |
|---|---|
| Valid result | The requested analysis succeeded and completed. No known parser, engine, protocol, or workspace failure occurred. |
| Settled result | A valid real-time result whose scanned workspace revision stayed unchanged for the two-second settlement idle window. Only valid settled results change stored Trends data. |
| Persisting eligibility | The finding is still open, has been observed for at least 30 seconds since first confirmation, and has at least two settled confirmations. |
| Durable resolution | The finding is missing in one valid settled observation, then still missing in another valid settled observation at least five seconds later. |
| Session start | First valid settled initial/live result after post-activation document synchronisation. |
| Session end | A valid settled final-session scan during deactivation, or a safe fallback to the latest valid settled result. Otherwise the session is incomplete. |

---

## 1. If deactivation analysis is invalid, is the last valid scan recorded as the final session record?

**Yes, but only under a strict condition.** Ariadne may promote `latestSettledObservation` to the final checkpoint only when both statements are true:

1. It was a valid settled real-time observation.
2. Its scanned workspace revision is still current; no tracked file changed after it.

This is safe because the last valid settled result still describes the last known editor state. Ariadne does not re-run formulas during fallback. It reuses the per-cohort F/P values already stored for that settled result, stores that compact summary as the final checkpoint, calculates an eligible cohort T, and completes the same SessionRecord.

If even one tracked file changed after that settled result, Ariadne cannot claim that the old result describes the final code. It marks the SessionRecord as `incomplete` instead. It must not silently call the last result the final state.

The fallback does not create a second SessionRecord or retain a full raw scan array. It only reuses the compact settled-observation summary already held by the active SessionRecord.

---

## 2. How do logical, content, and scope fingerprints decide whether a finding is recurring?

Fingerprint matching answers two different questions:

1. **Is this the same finding lifecycle?**
2. **If it returned, is it a true recurrence or the exact old code being restored?**

The decision is made only after an old FLC has reached **durably resolved** and later appears again.

When the FLC became durably resolved, Ariadne retained the last active logical/content/scope hashes. It compares the returning finding with those retained hashes before updating the FLC’s current hashes. This is what makes the toggle-versus-recurrence comparison possible.

| Fingerprint relationship on return | Meaning | Action |
|---|---|---|
| Same logical + same scope + changed content | The same kind of problem returned in the same code context, but not as the exact old code. | Reuse the old FLC, increment `recurrenceCount`, record a recurrence event. The public status becomes **Recurring** only when `recurrenceCount >= 2`; before that it remains Persisting or Improving as appropriate. |
| Same logical + same content + same scope | The exact same vulnerable code/context disappeared and came back. | Record an identical-restoration/toggle flag. Do **not** call it an ordinary recurrence. |
| Same CWE/rule but different logical fingerprint | A different problem of the same type. | Create a new FLC. |
| Same logical/content but different scope | Possibly copied or moved code in a different method/file. | Create a new FLC by default. Do not claim recurrence. |
| Ambiguous match | Ariadne cannot safely prove continuity. | Prefer a separate FLC rather than an unsupported history claim. |

The only exception to the different-scope rule is a verified rename/move mapping. For example, if VS Code reports a file rename and Ariadne can map old scope to new scope, it may deliberately preserve continuity. A guessed scope change is not enough.

---

## 3. How long does it take for a scan to be settled? How does observed duration work?

These are separate ideas. Ariadne is real time: it scans after normal edits and updates the UI as soon as a valid result arrives. It does not require a save.

A valid result becomes **settled** only after the exact workspace revision that produced it remains unchanged for the two-second settlement idle window. If any tracked file changes during those two seconds, Ariadne discards that result for Trends purposes and waits for the later revision's result instead.

The 30-second value belongs to the **Persisting** rule, not the settled rule. A finding is only eligible for the public Persisting status when all three conditions are true:

```text
finding is still active
AND current valid-settled-observation time - firstConfirmedAt >= 30 seconds
AND confirmationCount >= 2 settled confirmations
```

Example:

```text
10:00  A live scan finds Finding A. It is valid.
10:02  No tracked file changed for two seconds.
       The result is now valid settled.
       Finding A is still an internal candidate.

10:05  Another live scan remains unchanged for two seconds.
       It is the second settled confirmation, but only seven seconds have passed.
       It remains a candidate.

10:35  Another live scan becomes settled.
       It has at least two confirmations and more than 30 seconds of observed age.
       It can be shown as Persisting, unless the Improving rule applies.
```

The timing defaults are initial study parameters: two-second settlement idle window, 30 seconds minimum observed duration, two settled confirmations, and a five-second absence grace. They should be fixed before evaluating study data, then reviewed after a pilot if needed.

---

## 4. Are F, P, and T computed per vulnerability?

**Yes. The lead’s interpretation is the correct one: FLCs are per instance, while F, P, and T are computed for a fixed vulnerability cohort made from those FLCs.**

Example: if the first settled scan finds three High SQL Injection instances in different files, Ariadne creates three FLCs—A, B, and C—but they share one SQL-Injection cohort. That cohort receives one F, one P, one T, and one public status.

```text
SQL-Injection cohort C1
  members: FLC-A, FLC-B, FLC-C
  B = 3 fixed baseline members

O = number of members not yet durably resolved
R = B - O = number durably resolved
W = the cohort's common severity weight

F = (R / B) x 10
P = min(1, O / B) x W x 10
T = finalF(current completed session, same cohort)
    - finalF(previous comparable completed session, same cohort)
```

If A is durably resolved while B and C remain open:

```text
B = 3; O = 2; R = 1; W = 0.8
F = 1 / 3 x 10 = 3.33
P = 2 / 3 x 0.8 x 10 = 5.33
```

The individual FLC owns the evidence: fingerprints, detected/missing state, durable resolution, and recurrence. The SessionRecord stores a compact summary for the cohort:

```text
perVulnerabilityCohortSummary[]
  cohortId
  memberFLCIds
  B, O, R
  finalF
  finalP
  finalT
  finalPublicStatus
```

Do not combine every FLC that ever has the same CWE/type into one changing baseline. A new SQL Injection instance that first appears later creates a new cohort. This keeps B fixed, so T compares the same group of instances across completed sessions.

If a cohort is new, has no matching summary in the prior comparable completed session, or either session is incomplete, its T is `N/A`, not zero.

---

## 5. What is the difference between valid and settled observations?

There are only two tracker gates. The previous term `accepted` is removed because it was only another name for “valid and settled” and made the flow look like it had three result states.

```text
Raw result
  -> valid?
  -> settled?
  -> update Trends records
```

| Term | Meaning | Example |
|---|---|---|
| Valid | The scan completed successfully and completely. | Rust responds to the correct request with a complete findings result. |
| Settled | The valid result’s scanned workspace revision remained unchanged for two seconds. | A live result for revision 42 remains current while its settlement timer expires. |

A successful live-edit scan can be valid immediately but is not settled yet. It updates warnings and the Active Vulnerabilities UI immediately. If the workspace stays unchanged for two seconds, that same result becomes valid settled and then may update FLCs, the active SessionRecord, status, and current F/P. If the user edits again first, it remains UI-only.

---

## 6. Is a checkpoint the scan at the start and end of a session?

**Yes.** A checkpoint is a special valid settled observation retained as a boundary state in a SessionRecord.

| Checkpoint | What creates it | What it does |
|---|---|---|
| Baseline checkpoint | First valid settled initial/live result after post-activation synchronisation | Creates the one active SessionRecord and records the session start state. |
| Final checkpoint | Valid settled final-session scan, or safe fallback to the latest valid settled result | Records the final state and lets Ariadne complete the session. |

Other valid settled real-time scans are not separate checkpoints. They update FLCs and the existing active SessionRecord's `latestSettledObservation`. This keeps the record compact while still preserving the latest trusted state for safe fallback.

If the student activates Ariadne but never reaches a first valid settled result, Ariadne has no active session. It does not create an empty session or a final checkpoint during deactivation.

---

## 7. What hash are we using for fingerprints?

The final proposal uses **SHA-256**, through Node's built-in `crypto` module. It is used to create stable identifiers; it is not a security score and does not make a detector result more trustworthy. Rust does not need to emit a prebuilt canonical fingerprint object.

Before hashing, Ariadne uses a fixed, versioned field order so the same logical input always produces the same hash. Rust does not need to emit a separate canonical-fingerprint object.

```text
logical fingerprint input (v1)
  rule ID + CWE/type + instance kind/name + enclosing symbol path

content fingerprint input (v1)
  normalized vulnerable expression from finding range
  OR normalised source + sink expressions for taint findings

scope fingerprint input (v1)
  workspace-relative file identity + enclosing class/method path
```

Whitespace, comments, and line numbers do not belong in the logical/content input because normal editing moves lines and changes formatting. Line number stays only as a UI location hint.

The current Rust metadata does not yet provide every needed field. It must add `enclosing_symbol_path`, a complete `finding_range` (start and end), `source_range`/`sink_range` for data-flow findings, and a stable non-empty rule/detector ID. The extension uses the exact in-memory document buffer from the scanned revision to extract and normalise the expression before hashing. Ariadne stores hashes and a `fingerprintVersion`, not raw source code solely for Trends tracking.

---

## 8. Are provisional/durable resolution the same concept as observed duration?

**No. They use time for different reasons and in opposite states.**

| Concept | Finding state | What the time checks mean |
|---|---|---|
| Observed duration for Persisting | The finding is still detected. | It prevents a short-lived issue from being called Persisting. Ariadne requires 30 seconds of observed age and two settled confirmations. |
| Provisional resolution | The finding is missing once. | Ariadne records the first valid settled absence but does not call it Resolved or reduce F/P yet. |
| Durable resolution | The finding is still missing later. | Ariadne schedules/uses another valid settled absence after at least the five-second grace period. Only then does it show Resolved or reduce cohort O. |

No timer changes a status by itself. Ariadne needs an actual later valid settled observation. After the first provisional absence, it schedules a resolution-confirmation scan after the five-second grace if no later edit supersedes it. This prevents Ariadne from claiming knowledge it did not observe.

---

## 9. What does an incomplete session mean for the next session?

An incomplete session means Ariadne could not establish a trustworthy final state. Typical reasons are a failed final scan after edits, a timeout, or an extension-host interruption.

For the next session:

1. Keep the incomplete SessionRecord for audit history.
2. Do not add a final checkpoint, final cohort F/P, or official cohort T to it.
3. Do not alter FLC state based on unobserved shutdown code.
4. Restore each FLC at its last **valid settled** state.
5. Wait for the next session's first valid settled result, then create one new SessionRecord.
6. Skip the incomplete session when looking for a prior comparable completed record for T.

This does not reset lifecycle history. An FLC that was previously durably resolved remains durably resolved unless a later valid settled observation proves it returned. An FLC that was active remains at its last trusted state; Ariadne does not guess what happened after the last settled observation.

If VS Code or the extension host disappeared while a record was `active` or `ending`, the next activation recovers it as `incomplete` unless a completed write is already present.

---

## 10. Is there one SessionRecord per session or two?

There is **one SessionRecord per automatic session**.

```text
SessionRecord S
  status: active -> ending -> completed | incomplete
  baselineCheckpoint
  latestSettledObservation
  finalCheckpoint
  perVulnerabilityCohortSummary[]
```

At the first valid settled result, Ariadne creates `S` and fills `baselineCheckpoint`. Later valid settled results update the same active `S`. At deactivation, the valid settled final scan or safe fallback fills `finalCheckpoint` in the same record. Ariadne then freezes it as `completed` or `incomplete`.

There is not one start record and one end record. FLCs are separate long-lived records and are not SessionRecords.

---

## 11. Are we using a Promise/async implementation for deactivation?

**Yes.** The final design uses a bounded asynchronous operation:

```text
deactivate(): Promise<void>
  -> finalizeActiveSession()
  -> then stop the Rust engine
```

`finalizeActiveSession()` does this in order:

1. Mark the active session as `ending` so ordinary live results cannot update it.
2. Flush pending document-buffer updates to Rust.
3. Send one labelled `final_session` full-workspace request with a request ID and revision marker.
4. Wait for only the agreed timeout.
5. Accept only the matching, valid, complete result after it survives the two-second settlement check.
6. Write the final checkpoint and records in order, or use safe fallback/incomplete rules.
7. Stop Rust only after finalisation has finished.

The current extension does not do this: `deactivate()` returns immediately and a context-disposable kills the Rust session. The implementation must move engine shutdown behind `finalizeActiveSession()` and keep the lifecycle manager reachable from `deactivate()`. The timeout is essential: a shutdown must not wait forever, and a timeout is never treated as a successful scan.

---

## 12. What does “non-archived FLC” mean in Step 0?

During the study, it means **every FLC that Ariadne still retains**, including:

- active FLCs;
- provisionally resolved FLCs; and
- durably resolved FLCs.

It does not mean only open findings. Ariadne must retain durably resolved FLCs because a return in a later session may be a recurrence of that old finding.

If a retention policy archives an FLC, Ariadne no longer has enough stored history to safely say that a future match is a recurrence of it. It must treat that future finding as new. For the study, the correct policy is to keep all FLCs for the full observation period and archive them only afterward.

---

## 13. What do real-time live scans update, and when do they update FLCs/SessionRecords?

Live scans update the UI immediately. They are not permanently UI-only: a valid live result becomes usable for FLCs, SessionRecords, statuses, and F/P when its exact workspace revision stays unchanged for two seconds.

A student may temporarily comment out a vulnerable line, delete it before pasting it back, or be halfway through a code change. The scanner can still report the temporary state, and Ariadne can update diagnostics or the Active Vulnerabilities panel immediately.

But Ariadne must not write it into lifecycle history during the two-second settlement window. If another tracked-file edit happens first, that result stays UI-only. Otherwise Ariadne could falsely record:

- a temporary deletion as a fix;
- a half-written line as a new vulnerability;
- a short edit state as improvement; or
- a live scan as a session baseline.

Once the two seconds pass without a tracked-file change, the same valid result becomes settled and updates the FLCs and active SessionRecord. This is the real-time compromise: immediate feedback, but only stable editor states become research evidence.

---

## 14. In Step 5, what happens if the finding is not in the same scope?

By default, it is **not the same FLC** and is **not a recurrence**.

Scope identifies where the logical finding lives: the workspace-relative file identity plus its enclosing class/method path. The same vulnerable expression copied into another method or another file may have the same CWE, rule, content, and variable name, but it is still a different code context. Ariadne creates a separate FLC for it.

This conservative choice avoids wrongly claiming that one old problem returned when the student simply wrote similar vulnerable code somewhere else. A verified file rename/move mapping is the only exception; then Ariadne has direct evidence that the scope change preserved the same code context.

---

## 15. In Step 6, what does each finalisation action do and why is it needed?

| Action | What Ariadne does | Why it is needed |
|---|---|---|
| 1. Stop ordinary updates | Change the active session from `active` to `ending`. | A delayed live-edit response must not change the session while it is being closed. |
| 2. Flush pending buffers | Send edits still waiting in the debounce queue to Rust. | The final scan must see the latest editor text, not an older engine copy. |
| 3. Send final request | Request one full-workspace `final_session` analysis with ID/revision. | It creates a deliberate final state rather than using an arbitrary live result. |
| 4. Wait with timeout | Await the matching result only until the configured limit. | It allows finalisation without letting VS Code shutdown hang indefinitely. |
| 5. Correlate the response | Check request ID, reason, revision, success, and completion. | An older live scan may arrive after the final request. It must never be used as the final state. |

After these actions, Ariadne either processes the valid final result after the same two-second settlement check, safely falls back to the unchanged last valid settled result, or marks the session incomplete. Then—and only then—it stops the Rust engine.

---

## 16. In the two-session example, where do B, O, F, P, and T belong?

The **FLC owns individual-instance evidence**. The **fixed vulnerability cohort** uses those FLC states to calculate B, O, F, P, and T. The SessionRecord stores the dated cohort summary for that session.

Example: Session 1 begins with three High SQL Injection FLCs: A, B, C.

```text
FLC-A, FLC-B, FLC-C
  each stores fingerprints and lifecycle state
  all share cohortId = SQLI-C1

SQLI-C1 baseline:
  B = 3
  O = 3
  F = 0
  P = 8
```

When A becomes durably resolved:

```text
FLC-A = durably_resolved
FLC-B/C = active

SQLI-C1:
  B = 3
  O = 2
  R = 1
  F = 3.33
  P = 5.33

Session 1 stores this as its latest/final SQLI-C1 cohort summary.
```

In Session 2, B remains three because SQLI-C1 still has the same fixed three members. If B is also durably resolved, Session 2 ends with F = 6.67; its T is `6.67 - 3.33 = +3.34`. The SessionRecord never changes the cohort’s B; it only stores what that cohort’s values were at the session boundary.

---

## 17. In Section 9, how do initial, live, confirmation, and final requests differ in sending and processing results?

The Rust engine performs security analysis for all of them. The difference is the request's purpose and what the extension is allowed to do with the response.

| Reason | Request handling | Response handling |
|---|---|---|
| `initial_sync` | After Ariadne sends all currently open tracked buffers to Rust, it requests analysis with ID/revision. | UI updates immediately. If valid and still current after two seconds, it starts/updates the session baseline. |
| `live_edit` | Debounced `UpdateFile` includes request ID, reason, and workspace revision. | UI/diagnostics update immediately. If valid and unchanged for two seconds, update FLCs and current per-cohort F/P. |
| `resolution_confirmation` | Five seconds after a provisional absence, Ariadne requests a check only if no later revision superseded it. | If valid settled and still absent, make that FLC durably resolved and update cohort F/P/status. |
| `final_session` | Deactivation stops normal updates, flushes buffers, then requests labelled full-workspace analysis. | If matching result is valid and settles after two seconds, update FLCs/final checkpoint, store final per-cohort F/P/T, and complete session. Otherwise use fallback/incomplete rules. |

Every response uses the same `AnalysisResult` envelope:

```text
requestId
reason
workspace/document revision marker
success
complete
findings
completedAt
failure reason, if any
```

The current protocol emits a bare `VulnerabilityMetadata[]`. It must be changed so Rust echoes the request information and reports success/completion. Without this, a late live result could be mistaken for a later revision, confirmation, or final checkpoint.

---

## 18. How does the current-code-change table connect to the revised process?

The final walkthrough's Section 10 now contains a “Walkthrough step(s) enabled” column. The direct connection is:

| Code area | Revised process it enables |
|---|---|
| `documentEvents.ts` | Initial synchronisation, live UI scans, workspace-revision increments, and two-second settlement cancellation/restart. |
| `messages.ts` and `iostream.ts` | Request/result correlation and revision-aware handling for live, confirmation, and final scans. |
| Rust session protocol | Stable fingerprint metadata and a trustworthy analysis envelope for all processing steps. |
| `extension.ts` | Routes immediate UI results separately from later valid-settled lifecycle updates and owns asynchronous deactivation. |
| `snapshotAnalyzer.ts` | Becomes the FLC lifecycle and fixed vulnerability-cohort calculation manager. |
| `analysisTypes.ts` | Defines the types used by every revised step: requests, results, FLCs, sessions, checkpoints, and statuses. |
| `sessionStore.ts` | Restores records in Step 0 and persists compact FLC/session history through Steps 3–8. |

This is not a cosmetic refactor. The current code saves every live raw scan and derives status from the immediately previous type-level snapshot. The revised process only writes valid-settled evidence and tracks fingerprinted FLCs through fixed vulnerability cohorts.

---

## 19. What is the impact of each required code change?

| Change | Impact if implemented | Risk avoided |
|---|---|---|
| Workspace revision and settlement timer | Gives Ariadne real-time stable states and a safe fallback condition without requiring a save. | Treating a short typing state or stale result as Trends evidence. |
| Request IDs, reasons, revisions | Lets the extension identify what each result belongs to. | Late/out-of-order live result becoming a later revision, confirmation, or final checkpoint. |
| Result envelope with success/complete | Makes an empty result meaningful only after successful analysis. | Engine failure being read as “all findings fixed.” |
| Stable fingerprint metadata | Lets Ariadne follow one finding through line movement and distinguish recurrence/toggle/new. | Comparing only CWE/type or unstable line numbers. |
| FLC and cohort manager | Stores per-instance lifecycle evidence and computes metrics/status from fixed cohorts. | Losing history, resetting a finding, or changing a metric denominator when a new instance appears. |
| One active SessionRecord | Records a single automatic work period with start, updates, and end. | Duplicate start/end records or arbitrary session boundaries. |
| Async finalisation | Gives Ariadne one controlled attempt to establish the last trusted state. | Killing Rust before it can return the final analysis. |
| Compact store and serial write queue | Stores only durable lifecycle/session evidence in deterministic order. | Unbounded raw history and write races. |
| Replacing current snapshot diff | Uses a stability window, time, confirmations, durable resolution, and stable identity instead of two adjacent raw scans. | Calling a brief edit state Persisting, Improving, or Resolved. |

---

## Final summary

The final design uses raw scans for fast UI feedback and only valid settled scans for durable tracking. An FLC is the long-lived owner of one matched finding instance's identity and lifecycle evidence. Fixed cohorts of related FLCs own the vulnerability-level baseline, status, and F/P/T calculation. A SessionRecord is one historical container for one automatic session. It records checkpoints and per-cohort summaries but never changes a cohort baseline.

The design remains low-friction for students: no required Start/End Session button. It is still conservative: it does not make learning or remediation claims from temporary edits, failed scans, ambiguous fingerprint matches, or an untrustworthy final state.
