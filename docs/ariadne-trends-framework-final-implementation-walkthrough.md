# Ariadne Trends Framework — Final Implementation Walkthrough

**Status:** Lead-directed implementation walkthrough.

**Scope:** This is the agreed low-friction, automatic-session version of the Trends framework. It is an amendment to the earlier finalization and rationale documents, not a description of what the current code already does.

> **Required clarification (22 August 2026):** The lead review replaced this document's save-triggered/`accepted observation` policy and its per-FLC F/P/T wording. The controlling clarification is [Realtime Stability and Cohort Clarification](ariadne-trends-framework-realtime-stability-and-cohort-clarification.md). In short: a valid real-time result becomes usable after a two-second unchanged-workspace settlement window; there are only valid and settled gates; FLCs are per instance; and F/P/T/status are calculated for a fixed vulnerability cohort made from those FLCs. The new clarification should be implemented together with this walkthrough's retained material on sessions, request correlation, fingerprints, storage, and shutdown safety.

**Main decision:** Ariadne does not calculate aggregate cross-session F-cross or P-cross scores. It still keeps compact completed session history and long-lived finding lifecycle history because these are needed for recurrence, durable resolution, per-cohort previous-session T, and audit history.

---

## 1. The design in one minute

~~~text
Live edit scan
  -> update warnings and Active Vulnerabilities UI
  -> do not store a full scan snapshot as long-term Trends history

Valid settled save scan
  -> create or update the active automatic session
  -> create or update FindingLifecycleRecords
  -> calculate current F and P for each matched finding

Extension deactivation
  -> request one final scan
  -> if valid, finish the active session
  -> store final F and P for each matched finding
  -> calculate pairwise T for each comparable matched finding
~~~

There are three layers of data:

| Layer | Question it answers | Normal lifetime |
|---|---|---|
| Raw scan result | What did the Rust scanner find right now? | In memory only, unless debugging/research policy says otherwise. |
| FindingLifecycleRecord, or FLC | What has happened to this same matched finding over time? | Across many sessions. |
| SessionRecord | What happened in this one work session? | Kept after the session completes. |

The system never overwrites a completed SessionRecord. It also never changes an FLC's original baseline to the previous session's count.

---

## 2. Exact decisions in this version

### 2.1 Kept

- Four public statuses: **Persisting**, **Improving**, **Resolved**, and **Recurring**.
- Stable instance identity using logical, content, and scope fingerprints.
- Valid and settled observation gate.
- Time-based Persisting rule: observed duration plus settled confirmations.
- Provisional then durable resolution.
- Recurrence and identical-restoration/toggle tracking.
- Within-session F and P.
- Pairwise T: current completed session final F minus previous comparable completed session final F.
- Automatic session start and automatic session end.
- Compact lifecycle/session storage instead of unbounded full scan history.

### 2.2 Removed

The following are intentionally not part of this version:

~~~text
F-cross
P-cross
N: type-level cross-session baseline instance count
Eligible-session denominator
Proportional cross-session remediation and residual credits
~~~

### 2.3 Important clarification about T

T still uses the previous completed session:

~~~text
T = F of current completed session - F of previous comparable completed session
~~~

This is not an aggregate score across all sessions. It is only a direct before/after comparison with the immediately previous completed session.

If the team later decides that no prior session may be used for any calculation, remove T too. This walkthrough assumes the lead's decision is:

~~~text
Keep previous-session T.
Remove aggregate F-cross and P-cross.
~~~

---

## 3. Terms used by the implementation

| Term | Simple meaning | Used for |
|---|---|---|
| Raw scan result | Finding metadata returned by Rust after one analysis. | UI feedback and input to the tracker. |
| Valid observation | Ariadne completed the requested analysis successfully and completely; there is no known engine, parser, transport, or workspace failure. | Prevents a tool failure or partial result from looking like a fix. |
| Settled observation | A valid scan taken at a permitted stable event. In version 1, a successful save scan or successful final-session scan is settled immediately. | Separates deliberate saved/final states from temporary typing states. |
| Accepted observation | A scan that is both valid and settled. | The only kind of observation that may change long-term Trends data. |
| Checkpoint | A special accepted observation retained as the start or final state of a SessionRecord. Not every accepted save is a checkpoint. | Defines session boundaries and makes its final state auditable. |
| Finding instance | One specific security finding in one code context. | Main FLC tracking unit. |
| Occurrence | One reported source location belonging to a finding instance. | Used for B, O, R, F, and P. |
| FLC | Long-lived record for one matched finding instance. | Lifecycle across sessions. |
| SessionRecord | Record for one automatic work period. | Session start, end, metrics, and history. |
| Baseline | Fixed original starting count for one matched finding instance/cohort. | Denominator for F and P. |
| Previous-session reference | Final count/score from the immediately prior completed session. | Explains session-to-session change and calculates T. It is not a new baseline. |
| Comparable finding/session | The same FLC has a trustworthy final F in both completed sessions. | Required before a per-finding T can be calculated. |

### 3.1 Timing defaults and the distinction people commonly miss

The framework has two different ideas that must not be merged:

| Item | What it means | Version 1 default |
|---|---|---:|
| A **settled** scan | A scan is allowed to update records because it happened at save or finalisation. It does **not** wait 30 seconds. | Immediately after that scan successfully completes. |
| A **Persisting** classification | A still-open finding has been observed for long enough, across enough accepted observations, to be reported as persisting. | At least 30 seconds since first confirmation and at least 2 accepted confirmations. |
| Durable resolution | A missing finding has stayed absent long enough and is checked again by a later accepted observation. | At least 5 seconds after the first accepted absence, plus a later accepted observation that still shows it absent. |

Example: a finding first appears in a valid saved scan at 10:00. That scan is settled and accepted immediately, but the finding is only a `candidate` internally. If another valid saved scan still finds it at 10:35, it has two accepted confirmations and 35 seconds of observed age, so it may be shown as **Persisting**. If the second save happened at 10:05 instead, it would still be a candidate until a later accepted observation reaches 30 seconds.

These are initial study parameters, not claims that 30 seconds or 5 seconds are universal truths. Pilot results may change them, but the values must be fixed before the study data is evaluated.

---

## 4. What is temporary and what is stored

### 4.1 Raw scan metadata is temporary input by default

The Rust engine returns metadata such as rule ID, CWE/type, severity, file path, line, description, trace, and instance metadata.

~~~text
Rust findings arrive
  -> update panel and diagnostics
  -> normalise and fingerprint each finding
  -> use them to update compact records only when accepted
  -> discard the full raw finding array after processing
~~~

Full raw scans may be retained temporarily for debugging or an approved research sample. They are not the default long-term Trends record.

### 4.2 FindingLifecycleRecord

One FLC exists for one matched finding instance. It is not one record for a whole CWE/type group.

The FLC owns the finding's identity, original baseline, current lifecycle state, and the inputs to its F/P/T values. A SessionRecord only stores a dated summary of those FLC values for that one session; it does not own or replace the baseline.

~~~text
FindingLifecycleRecord
  id
  logicalFingerprint
  contentFingerprint
  scopeFingerprint
  fingerprintVersion

  lifecycleState
    candidate | active | provisional_resolution | durably_resolved

  publicStatus
    Persisting | Improving | Resolved | Recurring | null

  firstConfirmedAt
  lastConfirmedAt
  missingSince
  provisionalResolutionAt
  durableResolutionAt

  baselineOccurrenceCount       // B: fixed original count
  baselineOccurrenceIds[]       // hashes only; membership of B
  currentOccurrenceCount        // O: current matched open count
  confirmationCount

  recurrenceCount
  inSessionToggleCount
  identicalRestorationCount

  lastObservedSessionId
  lastCompletedSessionId
~~~

The FLC is mutable. It is updated every time Ariadne accepts a later observation of the same matched finding.

#### Fingerprint construction and hash choice

The implementation will use **SHA-256** through Node's built-in `crypto` module. SHA-256 is a stable, widely available content hash; Ariadne uses it as an identifier, not as a security judgement or a replacement for the detector.

Before hashing, Ariadne builds a versioned canonical text value. The exact field order is fixed and documented so identical inputs always produce the same fingerprint:

~~~text
logical fingerprint input (v1)
  rule ID + CWE/type + instance kind/name + enclosing symbol path
  + normalized relevant AST/source expression

content fingerprint input (v1)
  logical input + normalized vulnerable expression/context

scope fingerprint input (v1)
  workspace-relative file identity + enclosing class/method path
~~~

Whitespace, comments, and line numbers are excluded from the logical/content inputs. Line numbers remain a UI location hint only. The core's current flat metadata does not yet contain every required stable field, especially an enclosing symbol path and normalized relevant expression. The protocol work therefore must add those fields, or have Rust emit the canonical fingerprint components itself. Ariadne stores the hashes and fingerprint version, not raw source text for Trends tracking.

`scopeFingerprint` is a safety boundary. The same rule and code copied into another method or file is a different finding instance, not a recurrence. A verified file-rename mapping may preserve scope deliberately; an unverified scope change is ambiguous and creates a separate FLC rather than a false continuity claim.

#### How one FLC gets B and O

The Rust engine currently emits a flat list—one `VulnerabilityMetadata` item per raw finding. Ariadne must first group those raw findings into a matched logical instance using the logical and scope fingerprint. The grouped raw findings are that FLC's occurrences.

~~~text
first accepted observation of one FLC
  -> create a hash ID for each grouped occurrence
  -> baselineOccurrenceIds = those IDs
  -> B = number of unique baselineOccurrenceIds

later accepted observation of that same FLC
  -> identify which baseline occurrence IDs are still reported
  -> O = count of those IDs
  -> R = B - O
~~~

Storing only the hashed baseline occurrence IDs is compact and makes the words “same baseline occurrences” testable. It also avoids a hidden assumption that all items with the same CWE/type are the same problem.

The current conversion groups by `cwe/type` and then mostly by `instance_name`; that is not sufficient for this framework because the same name can appear in different methods. The revised grouping must use the fingerprinted logical scope. If a detector cannot provide enough context to do that safely, Ariadne must keep the raw item as a one-occurrence FLC (`B = 1`) rather than invent a larger cohort.

### 4.3 SessionRecord

One SessionRecord exists for one automatic work period.

~~~text
SessionRecord
  sessionId
  status
    active | ending | completed | incomplete

  startedAt
  endedAt
  previousCompletedSessionId

  baselineCheckpoint
  latestAcceptedObservation      // compact fallback/reference summary
  finalCheckpoint

  perInstanceSessionSummary[]
    flcId
    sessionStartOpenCount
    latestOpenCount
    finalOpenCount
    finalPublicStatus
    finalF
    finalP
    finalT
    recurrenceEventsInSession
    identicalRestorationsInSession
~~~

There is **exactly one SessionRecord per automatic session**, not one start record and one end record. `baselineCheckpoint` and `finalCheckpoint` are summaries inside that one record. An active SessionRecord updates during its own session. A completed or incomplete SessionRecord must not be changed later.

`finalF`, `finalP`, and `finalT` are per-FLC values inside `perInstanceSessionSummary[]`. There is deliberately no single session-wide F, P, or T number, because adding or averaging unrelated vulnerabilities would change their meaning. The UI may show counts or a list of per-finding scores, but must label any aggregate as a display summary rather than F, P, or T.

### 4.4 Ownership rule

~~~text
Raw scan result
  -> temporary scanner input

FLC
  -> one continuing record across sessions

Active SessionRecord
  -> updates during that session

Completed SessionRecord
  -> permanent historical record until retention/archive policy removes it
~~~

During the study, **non-archived FLCs means every retained FLC**, whether it is active, provisionally resolved, or durably resolved. Durably resolved FLCs must remain available so Ariadne can recognise a later recurrence. If a retention policy later archives an FLC, a later appearance cannot safely be called a recurrence of that archived record; it becomes a new FLC. The study should therefore keep FLCs for the full defined observation period and archive only afterward.

---

## 5. Metrics in this version

### 5.1 Variables

F, P, and T are calculated **separately for each FLC**. In other words, one finding instance (or its explicitly matched occurrence cohort) gets its own B, O, R, F, P, and—when comparable—T. Ariadne does not calculate these formulas per CWE/type group or as one score for the entire SessionRecord.

For one FLC:

~~~text
B = baselineOccurrenceCount
  Number of matched occurrences when Ariadne first confirmed the finding.
  B stays fixed.

O = currentOccurrenceCount
  Number of that FLC's matched baseline occurrences still open now.

R = B - O
  Number of baseline occurrences currently no longer detected.

W = severity weight
  Critical = 1.0, High = 0.8, Medium = 0.6, Low = 0.4.
~~~

Matching must preserve the bound `0 <= O <= B`. If new vulnerable code is added later, it starts a new FLC and its own B rather than silently increasing O for an older FLC. The UI may still report that new code appeared, but it does not corrupt the older FLC's formula.

### 5.2 F and P

~~~text
F = (R / B) x 10
  = ((B - O) / B) x 10

P = min(1, O / B) x W x 10
~~~

F means: “What part of the original matched baseline is currently no longer detected?”

P means: “How much of the original matched baseline remains open, adjusted by severity?”

P is not elapsed-time persistence. Persisting status uses observed duration and settled confirmations.

When an accepted observation no longer detects an FLC, set `O = 0` for the formula. That produces `F = 10` and `P = 0`, meaning the baseline is currently not detected. It does **not** by itself mean the public status is **Resolved**: resolution still needs the provisional/durable absence rule. This prevents a metric value from being misread as proof of a durable fix.

For an FLC that has a final score in the current completed session and in the immediately preceding comparable completed session:

~~~text
T = finalF(current session, same FLC)
  - finalF(previous comparable session, same FLC)
~~~

If the FLC is new in the current session, absent from the prior comparable session, or either session is incomplete, that FLC's T is `N/A`, not zero.

### 5.3 When each metric is calculated

| Event | Lifecycle update | F/P | T |
|---|---:|---:|---:|
| Live edit scan | No | No | No |
| Valid settled save scan | Yes | Update current F/P for each matched FLC | No official T yet |
| Valid final scan at session end | Yes | Store final F/P for each matched FLC | Calculate that FLC's T against its prior comparable completed-session value |

### 5.4 Why B never changes

~~~text
Original baseline: B = 4

Session 1 final: O = 2
F = (4 - 2) / 4 x 10 = 5

Session 2 final: O = 1
F = (4 - 1) / 4 x 10 = 7.5
T = 7.5 - 5 = +2.5
~~~

If Session 2 changed B to 2:

~~~text
F = (2 - 1) / 2 x 10 = 5
T = 5 - 5 = 0
~~~

That hides genuine progress. The Session 2 rolling calculation answers “what part of the two remaining items changed this session,” while the Session 1 calculation answers “what part of the original four items changed.” These cannot be compared as one T series.

Keep this separately:

~~~text
previousSessionFinalOpenCount = 2
~~~

This supports a clear statement:

~~~text
This session started with 2 open occurrences and ended with 1.
~~~

It must not replace B = 4.

---

## 6. Automatic session-boundary policy

This version has no required Start Session or End Session action for students.

### 6.1 Automatic session start

~~~text
First valid settled save scan after extension activation
  -> create new SessionRecord
  -> status = active
  -> save baseline checkpoint
~~~

The initial activation scan is live UI feedback only. It can run before open unsaved editor buffers are fully synchronised, so it is not automatically a session baseline.

### 6.2 During the session

~~~text
Live edit scan
  -> UI only

Valid settled save scan
  -> update FLCs
  -> update compact active SessionRecord
  -> update current F/P
~~~

Version 1 does not split or close sessions because a user stopped typing. An idle gap does not prove that a student finished working.

### 6.3 Automatic session end

If no active SessionRecord exists—for example, the student opened the workspace but never produced a first accepted save—Ariadne has no session to complete. It shuts down the engine normally and does not create an empty session record.

If an active SessionRecord exists:

~~~text
VS Code begins extension deactivation
  -> active session becomes ending
  -> Ariadne requests final full-workspace analysis
  -> waits for correlated result
~~~

If final analysis is valid:

~~~text
Update FLCs one final time.
Save final checkpoint.
Store final F/P.
Calculate T against previous comparable completed session.
Set SessionRecord.status = completed.
Flush writes.
Stop Rust engine.
~~~

If final analysis fails, is invalid, or times out:

~~~text
Use latestAcceptedObservation as final checkpoint only if:
  1. it was a valid settled save observation; and
  2. no tracked file changed after it.

Otherwise:
  SessionRecord.status = incomplete.
~~~

When the fallback conditions are met, the latest accepted save summary is reused as the final checkpoint; Ariadne does **not** scan or calculate again. Its already-stored per-FLC final F/P values become the session's final F/P values, and per-FLC T may be calculated normally against a prior comparable completed session. This is safe only because no tracked file changed after that accepted save.

An incomplete session is kept as history but does not produce official final F/P/T values. It never changes an FLC based on unobserved shutdown state, and it is not a comparison point for a later T. The next session starts normally at its first accepted save, using the FLC's last trusted state and skipping this incomplete SessionRecord when looking for a prior comparable completed record.

### 6.4 Why shutdown is asynchronous

~~~text
Send final Analyze request
  -> wait for Rust result
  -> validate/process it
  -> persist final records
  -> finish shutdown
~~~

This is a Promise/`async` implementation: `deactivate()` returns a `Promise<void>` and waits for a bounded `finalizeActiveSession()` operation. The current extension returns immediately from `deactivate()` and its disposable kills the Rust session. The final design must move the engine-kill disposable behind finalisation so it cannot kill Rust before the correlated final response is processed.

The wait must be bounded. If the final request has not completed by the agreed timeout, Ariadne uses the safe fallback rule above or marks the session incomplete; it never means “assume the last state was fine.” VS Code shutdown is not a durable transaction service, so every state transition and write must also be recoverable on the next activation.

---

## 7. Full operational walkthrough

### Step 0 — Restore compact history

~~~text
Load non-archived FLCs, including retained durably resolved FLCs.
Load latest SessionRecord.

If an old SessionRecord was active or ending when the extension
host disappeared:
  -> recover it as incomplete.
~~~

Do not create a new session merely because the extension activates.

### Step 1 — Start the scanner

~~~text
Start ariadne session Rust process.
Send Init with workspace root.
Receive initial raw findings.
~~~

Use the initial findings for panel and diagnostics. Do not use them as the automatic baseline checkpoint.

### Step 2 — Process normal live edit scans

~~~text
User edits tracked code.
Extension sends full-buffer UpdateFile after live debounce.
Rust analyses and emits raw findings.
~~~

For each ordinary live result:

~~~text
1. Update Active Vulnerabilities UI.
2. Update diagnostics and decorations.
3. Do not update FLCs.
4. Do not create/update SessionRecord.
5. Discard full raw result after normal UI processing.
~~~

Steps 3 and 4 mean that a result produced while the user is still typing must not change lifecycle history or session data. A student may temporarily delete, comment out, or half-write code before saving. Recording that as a resolution, improvement, or new baseline would make Trends describe an edit in progress rather than a deliberate code state.

### Step 3 — Process first save of a new session

~~~text
User saves a tracked file.
Extension requests or marks a save-triggered full-workspace analysis.
Rust returns findings.
~~~

Check:

~~~text
Did analysis succeed and complete?
Does this response belong to the save-triggered request?
~~~

If no:

~~~text
Use data only for UI if usable.
Do not start session.
Do not change lifecycle data.
~~~

If yes:

~~~text
This is a valid settled observation.
No active session exists.
Create SessionRecord S.
S.status = active.
S.baselineCheckpoint = compact summary of this observation.
S.startedAt = accepted observation time.
~~~

Then handle every found instance:

~~~text
Build fingerprints.
Find matching FLC.

FLC exists
  -> update it.

No FLC exists
  -> create it.
  -> set B to first confirmed matched occurrence count.
~~~

### Step 4 — Process later save scans in the same session

~~~text
User saves.
Save-triggered scan is valid and settled.
Session S already exists and is active.
~~~

For every detected instance:

~~~text
1. Match it to FLC.
2. Update O, lastConfirmedAt, and confirmationCount.
3. Update internal lifecycle state.
4. Derive public status when eligible.
5. Recalculate current F and P from fixed B and current O.
6. Update S.latestAcceptedObservation and compact per-instance summary.
~~~

For active FLCs missing from this accepted full-workspace result:

~~~text
First accepted absence
  -> set O = 0 and update F/P as current detector state
  -> set missingSince
  -> lifecycleState = provisional_resolution
  -> do not call it Resolved yet

Still absent after grace and a later accepted observation
  -> lifecycleState = durably_resolved
  -> publicStatus = Resolved
~~~

### Step 5 — Handle an old resolved finding returning

Example:

~~~text
Finding A was durably resolved in Session 3.
It returns in Session 10.
~~~

If it has the same logical fingerprint but changed content in the same scope:

~~~text
Update old FLC-A; do not create a new FLC.
recurrenceCount += 1.
lifecycleState = active.
Session 10 summary records recurrence event.
~~~

The old Session 3 record is never modified. It proves that A had a durable resolution before it returned.

If logical, content, and scope fingerprints all match:

~~~text
active -> absent -> active with exact same finding
  -> identical-restoration/toggle flag
  -> not ordinary recurrence
~~~

Public status remains threshold-gated:

~~~text
recurrenceCount = 1
  -> record recurrence event
  -> public status normally Persisting or Improving

recurrenceCount >= 2
  -> public status = Recurring
~~~

If the logical and content fingerprints match but the scope does not, Ariadne treats it as a separate FLC by default. It might be copied code in another method or file, and calling it the same lifecycle would be an unsupported claim. The only exception is a verified rename/move mapping that explicitly proves the scope change is the same code context.

### Step 6 — Begin finalisation at deactivation

When VS Code unloads Ariadne, the session becomes:

~~~text
active -> ending
~~~

The extension must:

~~~text
1. Stop accepting ordinary live Trend updates.
2. Flush pending document buffer updates to Rust.
3. Send final full-workspace analysis request.
4. Wait only up to agreed shutdown timeout.
5. Accept only response correlated to final request.
~~~

In plain terms, those five actions mean:

1. **Stop normal tracker updates.** Ariadne prevents an ordinary delayed live result from changing the session while it is closing.
2. **Flush document buffers.** It sends any edits that were already in the extension's debounce queue, so Rust analyses the latest editor text rather than an older copy.
3. **Request one final full analysis.** This is a deliberately labelled `final_session` request, not another ordinary typing scan.
4. **Wait only for the configured timeout.** This gives the engine time to answer without making shutdown hang forever.
5. **Check the response ID and revision.** Ariadne accepts only the answer to that final request and only if it represents the flushed document state. An earlier scan arriving late is ignored for finalisation.

### Step 7 — Complete or mark incomplete

If final analysis succeeds:

~~~text
1. Confirm result is valid.
2. Treat it as settled because it is final-session scan.
3. Update FLCs.
4. Save S.finalCheckpoint.
5. Save final F/P for every FLC tracked in S, including FLCs absent from the final scan (`O = 0`).
6. Calculate T for each FLC that has a prior comparable completed-session value.
7. Set S.status = completed.
8. Persist writes in order.
9. Stop Rust process.
~~~

If final analysis fails:

~~~text
No tracked edits after latestAcceptedObservation?
  -> yes: promote its already-stored summary to finalCheckpoint;
          keep its already-calculated per-FLC F/P; calculate eligible per-FLC T;
          complete session.
  -> no: set S.status = incomplete.
~~~

Never use an old save as the final state when tracked documents changed after it.

### Step 8 — Start the next automatic session

At later activation:

~~~text
Load old FLCs and completed SessionRecords.
Do not overwrite them.
Wait for first valid settled save scan.
Create SessionRecord S2.
~~~

For every finding in S2's first accepted scan:

~~~text
Matches existing FLC
  -> update same FLC.

No match
  -> create new FLC.
~~~

Previous SessionRecord use:

~~~text
Previous final F
  -> used for T comparison with current final F.

Previous final open count
  -> may explain where current session began.
~~~

Neither one overwrites the FLC's B.

---

## 8. Concrete two-session example

This example follows **one FLC, Finding A**. The FLC owns `B = 4`, its changing `O`, and the F/P calculation. Session 1 and Session 2 each store a compact, dated copy of Finding A's values in their `perInstanceSessionSummary`; they do not own or overwrite `B`.

~~~text
Finding A
Original B = 4 occurrences
High severity, W = 0.8
~~~

### Session 1

~~~text
09:05 first valid saved scan
  -> create Session 1
  -> baseline checkpoint
  -> create FLC-A with B = 4 and O = 4

09:20 later valid saved scan
  -> O = 2
  -> R = 4 - 2 = 2
  -> F = 2/4 x 10 = 5
  -> P = 2/4 x 0.8 x 10 = 4

09:40 valid final scan at deactivation
  -> Session 1 completed
  -> Finding A final F = 5, stored in Session 1's summary
  -> Finding A final P = 4, stored in Session 1's summary
  -> Finding A T = N/A: no previous completed comparable session
~~~

### Session 2

~~~text
10:00 first valid saved scan
  -> create Session 2
  -> session-start count = 2
  -> FLC-A still has B = 4

10:25 valid final scan
  -> O = 1
  -> R = 4 - 1 = 3
  -> F = 3/4 x 10 = 7.5
  -> P = 1/4 x 0.8 x 10 = 2
  -> Finding A T = 7.5 - 5 = +2.5
  -> Session 2 stores the final values for Finding A; it does not set B = 2
~~~

The UI may say both:

~~~text
Long-term: 3 of original 4 occurrences are no longer detected.
This session: open occurrences reduced from 2 to 1.
~~~

These are different comparisons and must not be mixed.

---

## 9. Required scan-result routing

The current Rust protocol emits only a raw findings array. The final implementation needs to know why a scan was requested and whether a response belongs to it. The scan engine still performs the same security analysis; the reason changes how the **extension** is allowed to use the result.

Use a result envelope or equally safe ordered request tracking:

~~~text
ScanRequest
  requestId
  reason: initial | live_edit | save | final_session
  workspace/document revision marker
  requestedAt

AnalysisResult
  requestId
  success
  complete
  findings
  completedAt
  failure reason, if any
~~~

This stops an earlier live-edit result from being accepted by mistake as a save checkpoint or final session result.

| Scan reason | What the extension sends/does | UI update | FLC/session update |
|---|---|---:|---:|
| `initial` | `Init` receives an ID/reason or produces an explicitly labelled initial result. | Yes | No. It is never a session baseline. |
| `live_edit` | A debounced `UpdateFile` with request ID, reason, and document revision. Rust analyses the current in-memory workspace and echoes them. | Yes | No. The result is temporary feedback only. |
| `save` | On `onDidSaveTextDocument`, flush pending tracked buffers, then request labelled full-workspace analysis with request ID/revision. | Yes | Yes, only when the matching response says `success=true` and `complete=true`. It starts or updates the one active session. |
| `final_session` | During deactivation, stop normal updates, flush buffers, then request labelled full-workspace analysis with request ID/revision. | Yes if the host is still available | Yes when valid; it writes the final checkpoint and completes the session. A failure uses fallback or incomplete rules. |

The result envelope is the same shape for all three requests. It must include `requestId`, `reason`, a revision marker, `success`, `complete`, and `findings`. Rust must echo request details exactly rather than the extension guessing which request produced a bare array.

---

## 10. Current-code changes required

| Current source area | Current behavior | Required change | Walkthrough step(s) enabled | Practical impact |
|---|---|---|---|---|
| [documentEvents.ts](../src/modules/detection/bridge/documentEvents.ts) | Sends `UpdateFile` after a 300 ms live debounce; has no save listener. | Keep live updates; add `onDidSaveTextDocument`, request reason/revision tracking, dirty-after-checkpoint tracking, and pending-buffer flush before final scan. | Steps 2, 3, 4, and 6. | Separates temporary typing feedback from saved evidence. The 300 ms debounce remains UI responsiveness, not a persistence timer. |
| [messages.ts](../src/modules/detection/bridge/messages.ts) | Supports `Analyze` but no request ID, reason, or revision in message/result. | Add IDs, reasons, and revision markers to `UpdateFile`/`Analyze`, or an equally safe ordered protocol. | Steps 3, 6, 7; Section 9. | Prevents a late live result being mistaken for the save or final result. |
| [iostream.ts](../src/modules/detection/bridge/iostream.ts) | Delivers bare finding arrays. | Deliver `AnalysisResult` envelopes with `success`, `complete`, request correlation, reason/revision, and findings. | Steps 2 through 7. | Makes an empty array meaningful only when analysis actually succeeded and completed. |
| Rust session protocol | Emits a findings array after analysis. | Echo correlation information, report trustworthy success/failure, and supply the stable context fields required for fingerprints (or canonical fingerprint components). | Steps 1 through 7; Section 4.2. | Rust remains the detector, but supplies enough evidence for TypeScript to track the same finding safely across edits. |
| [extension.ts](../src/extension.ts) | Appends every raw snapshot and then runs an immediate snapshot diff. `deactivate()` returns immediately and a disposable kills the Rust process. | Route live results to UI; route only accepted results to a lifecycle/session manager; replace immediate teardown with bounded asynchronous finalisation before killing Rust. | Whole flow, especially Steps 2, 6, and 7. | Stops edit flicker from becoming history and gives the last session state a safe completion path. |
| [snapshotAnalyzer.ts](../src/modules/tracker/analysis/snapshotAnalyzer.ts) | Compares latest CWE/type group with previous raw snapshot. | Replace with fingerprint matching, FLC state transitions, and per-FLC F/P/T calculation. | Steps 3, 4, 5, 7, and 8. | Removes the current two-scan/count-only classification and supports duration, durable resolution, and recurrence. |
| [analysisTypes.ts](../src/modules/tracker/analysis/analysisTypes.ts) | Defines `new` plus immediate statuses from a scan-to-scan diff. | Define request/result, fingerprint, FLC, SessionRecord, checkpoint, and four public-status types. Keep `candidate` internal. Put F/P/T in each FLC session summary, not as one session score. | Whole flow. | Aligns TypeScript types with the agreed research terms and prevents accidental use of the old `new` status. |
| [sessionStore.ts](../src/modules/tracker/storage/sessionStore.ts) | Stores an unbounded `ScanSnapshot` array. | Store compact FLCs, one SessionRecord per session, and a serial write queue. Raw snapshots become optional temporary/debug data. | Steps 0, 3, 4, 7, and 8. | Retains the evidence needed for recurrence and audit without retaining every live scan forever. It also makes interrupted writes recoverable. |

The Rust engine keeps its job of detecting vulnerabilities. The main Trends decisions belong in the TypeScript extension host. Rust needs only the metadata and result-contract changes needed for safe matching and request correlation.

---

## 11. Implementation order

1. **Approve the scope.** Confirm that T remains pairwise while aggregate F-cross/P-cross are removed.

2. **Create storage types.** Add FLC, one SessionRecord per session, compact checkpoints, per-FLC session summaries, and active/ending/completed/incomplete session state.

3. **Add request/result correlation.** Save and final scans cannot be safely accepted without it.

4. **Add valid-analysis outcome.** An empty result means absence only after Rust confirms successful complete analysis.

5. **Add save-triggered settled observations.** Keep live scans for UI, but make save results accepted-observation candidates.

6. **Implement fingerprints and matching.** Define the versioned canonical SHA-256 inputs, request the missing stable metadata from Rust, and test rename/scope handling before formulas.

7. **Implement FLC transitions.** Candidate, active, provisional/durable resolution, recurrence, and identical restoration.

8. **Implement automatic session creation/update.** First accepted save creates session; later accepted saves update it.

9. **Implement finalisation at deactivation.** Final scan, timeout, fallback, incomplete state, and serialized writes.

10. **Implement per-FLC F/P/T.** F/P updates after accepted observations. Final F/P and comparable T are stored inside each FLC's completed-session summary; they are not one session-wide score.

11. **Update UI.** Four public statuses and clear supporting details only.

12. **Migrate or clear old raw snapshot history deliberately.** Do not mix old broad CWE/type snapshots with new FLC history.

---

## 12. Required acceptance tests

| Scenario | Expected result |
|---|---|
| Live scan during continuous typing | UI updates only; no FLC/session update. |
| First saved finding at 10:00 | Scan is settled and accepted immediately, but finding remains internal candidate until 30 seconds and a second accepted confirmation. |
| First successful save after activation | Creates one active SessionRecord and baseline checkpoint. |
| Later accepted save in same session | Updates same SessionRecord and matching FLCs; creates no new session. |
| New logical finding at accepted save | Creates new FLC with its own fixed B. |
| Same finding moves lines | Matches same FLC; no false new/resolved pair. |
| Same CWE in a different method | Separate FLC. |
| Same logical/content finding in different unverified scope | Separate FLC; not a recurrence. |
| Failed save analysis | No session start, lifecycle transition, F/P update, or resolution. |
| One accepted absence | Provisional resolution only. |
| Absence through grace and later accepted observation | One durable Resolved transition. |
| Exact code disappears then returns | Identical-restoration flag; not ordinary recurrence. |
| Changed code returns after durable resolution | Same FLC resumes; recurrence count increases. |
| Final scan succeeds | Session completed; final F/P and T stored. |
| Final scan fails but no later tracked edit exists | Latest accepted save may become final checkpoint. |
| Safe final fallback | Reuses already-stored per-FLC F/P; calculates eligible per-FLC T; creates no duplicate SessionRecord. |
| Final scan fails after unsaved tracked edits | Session marked incomplete. |
| Incomplete SessionRecord at next activation | Kept for audit, skipped as T reference, and does not change FLC state. |
| Session 1 F = 5, Session 2 F = 7.5 | Session 2 T = +2.5. |
| Previous final count is 2, current is 1 | FLC B remains original; previous count is not B. |
| Extension restarts with session in ending state | Recover old session as incomplete unless completed write exists. |
| Rapid scan results/writes | Serial write queue preserves record order. |

---

## 13. Review clarifications in one place

| Lead question | Final answer |
|---|---|
| Does a safe fallback become the final record? | Yes. A valid settled save becomes the final checkpoint only when no tracked file changed afterward. It reuses the F/P already saved for each FLC and may calculate eligible per-FLC T. |
| How long before a scan is settled? | No waiting period. A successful save/final scan is settled immediately. The separate Persisting rule needs 30 seconds of observed age and two accepted confirmations. |
| Are provisional/durable resolution and observed duration the same? | No. Observed duration proves a currently open finding has lasted long enough to be Persisting. Provisional/durable resolution handles a missing finding: first accepted absence is provisional; a later accepted absence after the 5-second grace is durable Resolved. |
| Are F, P, and T session-wide? | No. They belong to one FLC at a time. A SessionRecord stores a per-FLC summary for that session. |
| What is an accepted observation? | A result that is both technically valid and settled at an approved event. Only accepted observations update long-term records. |
| Are all saves checkpoints? | No. The first accepted save is the baseline checkpoint; the final accepted final scan or safe fallback is the final checkpoint. Other accepted saves update the active record only. |
| Is there one SessionRecord or two? | One. It contains both checkpoint summaries and updates while `active`; it freezes at `completed` or `incomplete`. |
| Is deactivation Promise-based? | Yes. `deactivate()` returns a bounded `Promise<void>` for finalisation, then Rust is stopped. A timeout follows fallback/incomplete rules. |
| What does non-archived FLC mean? | Every FLC retained during the study, including durably resolved ones. Keeping resolved FLCs is what makes later recurrence detection possible. |
| What if a finding returns in another scope? | It is a new FLC unless Ariadne has verified evidence of a file rename/move mapping. It is not automatically recurrence. |
| What happens after an incomplete session? | The next session starts normally at its first accepted save. The incomplete record is kept for audit but cannot be a final F/P/T comparison point. |

---

## 14. Final implementation rule

> Ariadne uses every raw scan for immediate scanner feedback, but uses only valid settled scans to update compact finding lifecycle and session records. An FLC persists across the observed life of one matched finding and keeps its original baseline. A SessionRecord is created automatically on the first valid settled save after activation, updates only during that active session, and is never overwritten after completion. Ariadne attempts a final valid scan during deactivation and completes the session only when it has a trustworthy final state or a safe saved-state fallback. F and P describe the latest matched baseline state **for one FLC**. T compares the final F for that same FLC with its final F in the prior comparable completed session. Aggregate cross-session F/P scores are intentionally not part of this version.
