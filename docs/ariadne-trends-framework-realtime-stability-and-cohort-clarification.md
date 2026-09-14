# Ariadne Trends Framework — Save-Triggered Settlement and Baseline-Group Clarification

**Status:** Lead-feedback clarification before implementation. This document follows the lead's save-triggered measurement walkthrough.

This document resolves four issues raised in the lead review:

1. Live scans may update the UI in real time, while **save-triggered** scans supply Trends measurements.
2. A valid save-triggered result becomes usable only after the editor has stayed unchanged for two seconds.
3. `F`, `P`, and `T` are reported for one fixed **vulnerability baseline group**, built from its per-instance FLCs—not separately for every FLC and not by loosely mixing every historical finding of a CWE.
4. `accepted observation` is removed. There are only two tracker gates: **valid** and **settled**.

This clarification replaces the earlier no-save measurement proposal, removes the redundant `accepted observation` label, and explains how the fixed baseline-group calculation integrates into the existing FLC/SessionRecord walkthrough. It does **not** reintroduce aggregate cross-session `F_cross` or `P_cross`.

---

## 1. Save-triggered measurement with real-time UI feedback

The lead's intended flow is:

```text
Code changes
  -> Ariadne may perform normal live scans for diagnostics and UI
  -> those live results do not update Trends history

User saves a tracked file
  -> Ariadne requests a measurement scan for workspace revision V
  -> Rust returns a successful complete result for V: valid
  -> Ariadne waits two seconds after the result
  -> if revision V is still current: valid settled
  -> update FLCs, SessionRecord, F/P, and status
```

The initial implementation value for this wait is:

```text
settlement idle window = 2 seconds
```

Two seconds is deliberately longer than the current 300 ms live debounce. The 300 ms debounce controls how soon Ariadne scans while the user types. The 2-second settlement window controls whether the resulting state is quiet enough to become Trends evidence. They solve different problems.

This preserves real-time feedback: findings and diagnostics may update when a live result arrives. The deliberate Trends data waits for a save and then the two-second settlement check.

### 1.1 Why use both a save trigger and a two-second settlement delay?

The two checks answer different questions:

| Check | Question it answers | What it does not prove |
|---|---|---|
| Save trigger | “Did the user create a deliberate persisted code state?” | It does not prove the user did not immediately continue editing after save. |
| Two-second unchanged window | “Did that scanned state remain unchanged long enough to be treated as a checkpoint?” | It does not prove that the code is correct; Rust analysis still supplies that evidence. |

The delay begins **after the matching scan result arrives**, not before Ariadne scans. This keeps the UI responsive and ensures the timer is attached to an actual analysed workspace revision.

Why keep the delay:

- A student can save and immediately continue changing code. Without the delay, a short intermediate saved state could be recorded as a fix or improvement.
- The extension must distinguish the save scan's result from delayed live results or from an engine state that has already been superseded by a later edit.
- Using the same gate for session start, normal metric updates, and session end avoids a weaker special case at the boundaries.

Costs of keeping the delay:

- Trends values appear about two seconds later.
- If the student edits again within two seconds, that save does not become a measurement checkpoint; a later save is needed.
- Finalisation needs a shutdown timeout long enough for the final scan **plus** two seconds.

The alternative is “save alone means settled.” It is simpler and faster, but it records more short-lived save-and-continue states. Since the lead chose to keep the two-second delay, this document uses save plus delay consistently.

### 1.2 What cancels settlement

Any edit, create, delete, or rename of a tracked file during the two-second window cancels settlement for that full-workspace scan. The result may remain useful for UI feedback, but it cannot update Trends history. The next **save** produces the next measurement-scan candidate.

---

## 2. The only two result gates: valid and settled

The earlier word **accepted** was redundant and is removed. It sounded like a third result state even though it merely meant “valid and settled.”

```text
Raw scan result
  -> valid?
  -> settled?
  -> use it for lifecycle, session, status, and metrics
```

| State | Exact meaning | Can update UI? | Can update FLC/SessionRecord/F/P/T? |
|---|---|---:|---:|
| Raw result | A response arrived from Rust. It may be stale, failed, incomplete, or from the wrong request. | Only if safe/useful | No |
| Valid result | Its request ID, reason, and workspace revision match; Rust reports success and complete analysis. | Yes | Not yet |
| Valid settled result | It is a valid **measurement** result and its scanned workspace revision stayed current for the 2-second settlement window. | Yes | Yes |

There is no “accepted” status after settled. In code, a Boolean such as `isSettled` is enough once `isValid` is true.

### 2.1 How Ariadne proves a result is settled

The extension keeps one increasing `workspaceRevision` number. It increments the number whenever a tracked Java/config file changes, is created, deleted, or renamed. A scan request carries the revision it is meant to analyse.

For each valid save-triggered measurement result:

```text
1. Rust returns result R for workspaceRevision 41.
2. Extension immediately updates UI from R.
3. Extension starts a 2-second settlement timer for R.
4. If any tracked file changes before the timer ends:
     workspaceRevision becomes 42;
     R is discarded for Trends purposes;
     the later result for revision 42 may begin its own timer.
5. If the timer ends and workspaceRevision is still 41:
     R is valid settled;
     update lifecycle/session/metrics from R exactly once.
```

This is why a result becomes “stable” after a few seconds: Ariadne is not guessing that the code is stable; it has observed that no tracked file changed during the settlement window.

For a full-workspace scan, **any** tracked-file change cancels settlement. A result describes the entire workspace, so it cannot be a reliable checkpoint if even one tracked file changed afterward.

### 2.2 Session-start and final scans

Initial activation/live scans may populate the UI, but they do not start a session. The **first valid settled save-triggered measurement scan after activation** creates the SessionRecord and its baseline checkpoint. This means the session start follows the same rule as every other Trends update.

At deactivation, Ariadne flushes any pending document update, requests one labelled `final_session` analysis, and applies the same valid-and-two-second-settlement test. The bounded shutdown timeout includes the scan and this wait. If that cannot finish safely, Ariadne uses the agreed fallback rule or marks the session incomplete; it does not weaken the settlement rule only for shutdown.

---

## 3. What one FLC is, and what one vulnerability baseline group is

The lead is right that an FLC is **per instance**. The earlier wording that F/P/T were “per FLC” did not match the intended vulnerability-level metrics.

### 3.1 FLC: one scanner-reported instance

For the current Rust output, each `VulnerabilityMetadata` item is one scanner-reported source finding. Ariadne treats it as one FLC unit.

```text
SQL Injection in UserRepository.java, method findUser()  -> FLC-A
SQL Injection in AdminRepository.java, method listUsers() -> FLC-B
SQL Injection in SearchRepository.java, method search()   -> FLC-C
```

Each FLC follows its own lifecycle:

```text
candidate -> active -> provisional resolution -> durably resolved
```

It also holds its fingerprints, timestamps, current detection state, resolution state, and recurrence/toggle history.

When an FLC reaches durable resolution, Ariadne keeps the last active logical/content/scope hashes as `resolvedFromLogicalHash`, `resolvedFromContentHash`, and `resolvedFromScopeHash`. On a later return, it compares the new hashes with those retained values **before** updating the current FLC hashes. Without this small retained set, Ariadne could not distinguish exact restoration from changed-content recurrence reliably.

For the initial implementation, each FLC contributes **one baseline unit**. If a future detector reports one logical instance with several independently tracked source occurrences, Ariadne must split them into one FLC per occurrence before metric calculation. This prevents partial disappearance of a broad instance from becoming ambiguous.

### 3.2 Vulnerability baseline group: the metric/reporting unit

F/P/T are calculated for a **vulnerability baseline group**: a fixed group of FLCs that have the same vulnerability key and first appeared together in one settled baseline observation. This is the same idea previously called a “cohort”; `baseline group` is the clearer implementation term.

```text
vulnerabilityKey = rule ID + CWE + type + severity
baselineGroupId   = vulnerabilityKey + first settled baseline ID
```

Severity is included so one baseline group has exactly one severity weight `W`.

The three SQL Injection FLCs above are in the same baseline group if they are found in the same first settled baseline scan:

```text
SQL-Injection baseline group C1
  members: FLC-A, FLC-B, FLC-C
  B = 3 baseline FLCs
```

This is the answer to “do we aggregate the three SQL Injection FLCs?”: **yes, for that baseline group.** FLCs are the detailed evidence; the baseline group is the unit that receives one F, one P, one T, and one public vulnerability status.

### 3.3 Why not aggregate every FLC ever having the same CWE/type?

Because the baseline would keep changing.

If the original baseline group had three SQL Injection instances and a fourth unrelated SQL Injection instance appears later, adding the new FLC to the old baseline changes `B` from 3 to 4. Then an F score from before the new instance and an F score afterward do not describe the same denominator, so T becomes misleading.

Therefore:

```text
FLCs first seen together in the baseline-group baseline
  -> fixed members of that baseline group

New FLC of the same vulnerability key later
  -> a new baseline group with its own B and metrics
  -> never silently added to the old baseline group
```

The UI may group baseline group C1 and C2 under the heading “SQL Injection,” but it must keep their F/P/T values separate. It may display a count across groups, but it must not call that display count one combined F/P/T score.

### 3.4 This is not an extra raw-history layer

A baseline group does not require storing a third large scan-history table. It is a fixed membership label shared by FLCs:

```text
FLC-A.baselineGroupId = SQLI-C1
FLC-B.baselineGroupId = SQLI-C1
FLC-C.baselineGroupId = SQLI-C1
```

The SessionRecord stores compact summaries by `baselineGroupId`. The group values can be reconstructed from retained FLCs and their fixed membership.

### 3.5 Where the baseline group fits into the existing walkthrough

The baseline group is not another scan stage. It is created inside the existing “match/create FLCs after a valid settled scan” stage.

```text
First valid settled save scan of Session 1
  -> normalise each Rust finding
  -> create/match one FLC per finding instance
  -> group newly created FLCs by vulnerabilityKey
  -> give FLCs in each group one baselineGroupId
  -> write Session 1 baseline checkpoint and group summaries

Later valid settled save scan
  -> match each finding to its FLC and update lifecycle state
  -> identify FLCs now missing from the scan
  -> group retained FLCs by baselineGroupId
  -> count B, R, and O for each group
  -> calculate F/P and derive the public status
  -> update the same active SessionRecord's latest group summaries

Final valid settled scan
  -> repeat the same FLC matching and group calculation
  -> write final group F/P/status summaries
  -> calculate group T from this final F and the prior comparable completed session
```

A later new SQL Injection instance has the same `vulnerabilityKey` but no matching old FLC. It receives a new `baselineGroupId`; it is not added to the Session 1 SQL baseline group. No separate long-lived baseline-group record is required: filtering retained FLCs by `baselineGroupId` produces the group whenever the calculator runs.

---

## 4. F, P, and T: the correct calculation unit

For one fixed vulnerability baseline group `V`, with baseline FLC members `i = 1 ... B`:

```text
B_V = number of fixed baseline FLC members in V

R_V = direct count of baseline FLC members whose lifecycleState is durably_resolved

O_V = direct count of baseline FLC members not durably_resolved
    = B_V - R_V

W_V = common severity weight of V
      Critical 1.0, High 0.8, Medium 0.6, Low 0.4

F_V = (R_V / B_V) x 10

P_V = min(1, O_V / B_V) x W_V x 10

T_V = finalF_V(current completed session)
      - finalF_V(previous comparable completed session)
```

`B_V` never changes. It is the number of FLCs that defined the baseline group at its first settled baseline.

### 4.1 Exactly which FLCs count as `O` and `R`

`O` does **not** mean “only FLCs in provisional resolution.” It means every original baseline FLC that Ariadne has not yet confirmed as durably resolved.

For a five-instance SQL baseline group:

```text
FLC-A = durably resolved
FLC-B = durably resolved
FLC-C = active
FLC-D = active; never touched since Session 1
FLC-E = provisional resolution; missing once only

B = 5
R = 2  // A and B
O = 3  // C, D, and E
```

The classification table is:

| FLC lifecycle state | Counts in `R`? | Counts in `O`? | Why |
|---|---:|---:|---|
| `candidate` | No | Yes | It is an original baseline instance not yet resolved. |
| `active` | No | Yes | It is still detected and unresolved. |
| `provisional_resolution` | No | Yes | It disappeared once, but may be comment-out/delete-and-repaste. |
| `durably_resolved` | Yes | No | Its absence was confirmed by a later valid settled measurement scan. |
| Returned/recurrent/toggle instance | No | Yes | It is active again, so it is no longer resolved. |

This is why a provisional FLC stays in `O`: a single disappearance must not improve F or reduce P. Active FLCs that the student has never touched also stay in `O`, because they remain unresolved risk.

In implementation, direct counting is clearest:

```text
R = count(members where lifecycleState == durably_resolved)
O = count(members where lifecycleState != durably_resolved)
assert B == R + O
```

The older equation `R = B - O` is still correct; it is an algebraic identity and a useful consistency check, not a separate data source. The code may calculate `R` directly from FLC states and derive `O`, or count both and assert they add up to B.

This is a deliberate metric policy: F becomes a **confirmed remediation score** and P becomes a **conservative residual-risk score**. If the team instead wants F/P to change after a first absence, that is possible, but the values must then be labelled provisional and must not be interpreted as confirmed remediation. This document recommends the durable-resolution policy because it protects F/P/T from temporary hiding.

The tracker may still record `currentlyDetected = false` during provisional resolution for diagnostics and lifecycle evidence. That field is separate from `O_V`.

### 4.2 Where these values live

| Data | Owner | Reason |
|---|---|---|
| Fingerprints, lifecycle, current detection, durable resolution, recurrence/toggle history | Individual FLC | They describe one concrete finding instance. |
| Baseline-group membership and fixed baseline | Shared `baselineGroupId` on member FLCs | It defines exactly which FLCs may be aggregated. |
| Current F/P after every valid settled observation | Active SessionRecord’s `latestSettledBaselineGroupSummary` and recomputable from FLCs | It describes the latest trusted state during this session. |
| Final F/P/T | Completed SessionRecord’s `finalBaselineGroupSummary` | It describes the trustworthy end of that session. |

`T` is only calculated at session completion because it compares final baseline-group F values. It is not a live metric.

### 4.3 Incomplete sessions and F/P/T

An active SessionRecord may already contain **latest** F/P values from prior valid settled observations. If finalisation fails and no safe fallback is possible:

```text
SessionRecord.status = incomplete
no finalCheckpoint
no final F/P
no T
```

The latest values remain audit information only; they are not presented as the session’s final outcome. FLCs retain their last valid settled lifecycle state because that state was genuinely observed. The next session creates a new SessionRecord and, for T, skips incomplete sessions until it finds the previous comparable **completed** session.

If safe fallback is possible, the session is completed instead: the latest valid settled baseline-group summary becomes the final summary, and T may be calculated.

---

## 5. How every public status is determined

The framework still has exactly four public statuses:

```text
Persisting | Improving | Resolved | Recurring
```

`candidate` and `provisional resolution` are internal lifecycle states, not new public categories. The UI may say “confirming” in supporting text, but it must not count that as a fifth Trends status.

All status decisions happen only after a **valid settled** observation.

### 5.1 Internal FLC lifecycle rules

| FLC event | Internal result |
|---|---|
| First valid settled detection | Create FLC; `candidate`; set `firstConfirmedAt`; add it to the current/new baseline group. |
| Later valid settled detection | Increment its settled confirmation count; move/keep it `active`. |
| First valid settled absence | `provisional_resolution`; record `missingSince`; do not change F/P yet. |
| Later valid settled save/final result still absent at least 5 seconds later | `durably_resolved`; record `durableResolutionAt`; only now remove its unit from O and add it to R. |
| Exact same code returns after durable resolution | Return to active; increment toggle/identical-restoration history; do not increment ordinary recurrence count. |
| Changed vulnerable code returns in same logical/scope after durable resolution | Return to active; increment `recurrenceCount`. |

After a first valid settled absence, Ariadne waits for a **later valid settled save measurement scan** or the valid settled final-session scan at least five seconds later. If it still shows the FLC absent, the resolution becomes durable. A timer alone does not change the state, and this version does not add a separate automatic confirmation scan.

### 5.2 Public baseline-group status rules and priority

For a baseline group V, after all matching FLCs were updated from the valid settled result:

| Priority | Public status | Exact condition |
|---:|---|---|
| 1 | **Resolved** | Every baseline FLC in V is durably resolved. `O_V = 0`. |
| 2 | **Recurring** | At least one currently active member FLC has `recurrenceCount >= 2`. Exact restoration/toggle events do not count. |
| 3 | **Improving** | At least one, but not all, baseline FLCs are durably resolved. `0 < R_V < B_V`. |
| 4 | **Persisting** | No member is durably resolved yet (`R_V = 0`), at least one member remains detected, baseline-group observed age is at least 30 seconds, and the still-active member(s) have at least two settled confirmations. |
| — | No public status yet | The baseline group is still candidate, is awaiting absence confirmation, or does not meet a public-rule condition above. |

The order matters. A fully solved baseline group is **Resolved**, even if one of its members had recurred earlier. A partly solved baseline group is **Improving**. A recurring active member only becomes **Recurring** after the agreed two recurrence events. A count increase does not create a `Regressing` status; it remains Persisting once persistence eligibility is met. A new later FLC is a separate baseline group, so it does not inflate an old group’s count or denominator.

### 5.3 Status timing in plain language

| Status | Does it need the 30-second rule? | Does it need another observation? | Why |
|---|---:|---:|---|
| Persisting | Yes: 30 seconds + 2 settled confirmations. | At least two settled detections are already required. | “Persisting” claims the problem lasted, so it needs time evidence. |
| Improving | No. | Yes: each removed FLC must reach durable resolution, which requires its later confirmation scan. | A reduction is only called improvement when it is confirmed, not merely hidden once. |
| Resolved | No. | Yes: every baseline-group member must reach durable resolution. | One absence is not enough evidence of a fix. |
| Recurring | No separate 30-second rule. | Yes: it requires prior durable resolution and then a later matching return; public Recurring needs two recurrence events. | It is a history claim, not just a current count claim. |

---

## 6. Exact metadata needed for the three fingerprints

The plan does **not** require Rust to emit a ready-made canonical fingerprint or a special “canonical component” object. The extension constructs SHA-256 hashes from ordinary scan metadata and the exact in-memory source buffer that was scanned.

### 6.1 Current fields that Ariadne can already use

| Existing metadata field | Use |
|---|---|
| `rule_id` | Primary vulnerability-rule identity. It should become mandatory/stable for Trends. |
| `cwe_id`, `type` | Vulnerability family identity and safety fallback. |
| `severity` | Baseline-group severity weight `W`; part of the vulnerability key. |
| `instance_name`, `instance_kind` | Helps identify the affected code role. |
| `file_path` | Converted to workspace-relative path for scope. |
| `line_number`, `column_number` | UI location only; not a stable fingerprint key. |
| `taint_trace` | Useful supporting evidence, but current line/path summary alone is not stable enough for exact content identity. |

### 6.2 Metadata that must be added

| Required field | Why it is needed |
|---|---|
| `enclosing_symbol_path` | Stable path such as package/class/method signature. It separates the same variable/rule used in different methods and supports logical/scope identity. |
| `finding_range` with start and end line/column | Lets the extension extract the exact relevant source expression from the **same document revision** that Rust analysed. Current start line/column alone cannot reliably do this. |
| `source_range` and `sink_range` for taint/data-flow findings | A data-flow vulnerability’s content is defined by source and sink, not just one sink line. Ariadne needs both expressions. |
| Stable non-empty `rule_id`/detector ID | Prevents two different detector rules sharing one lifecycle merely because they use the same CWE/title. |

These are normal scan metadata fields, not precomputed fingerprint components. The extension holds the exact buffer it sent at that workspace revision. It extracts the relevant range, removes insignificant whitespace/comments, hashes it, and stores only the hash—not the raw code—in the FLC.

### 6.3 Hash inputs in the extension

```text
logicalFingerprint = SHA-256(
  rule_id + cwe_id + type + instance_kind + instance_name + enclosing_symbol_path
)

contentFingerprint = SHA-256(
  normalized text in finding_range
  OR normalized source_range + normalized sink_range for taint findings
)

scopeFingerprint = SHA-256(
  workspace-relative file_path + enclosing_symbol_path
)
```

Line/column positions are not included in a fingerprint because normal edits move lines. They locate the issue in the UI and let the extension extract the correct source text for the content hash.

---

## 7. Full walkthrough: save scan, later scans, FLCs, SessionRecord, and F/P/T

This example shows one High-severity SQL Injection baseline group. `W = 0.8`.

### Starting situation

The workspace has three SQL Injection instances found by the same rule:

```text
FLC-A: UserRepository.findUser()
FLC-B: AdminRepository.listUsers()
FLC-C: SearchRepository.search()
```

They all share this vulnerability key:

```text
rule ID + CWE-89 + "SQL Injection" + high
```

### Step 0 — Activation, then first saved measurement scan

```text
1. Extension starts Rust.
2. Extension sends all open tracked document buffers to Rust.
3. Any initial/live result may update the UI only.
4. Student saves a tracked file at workspaceRevision 41.
5. Extension requests a save measurement scan for revision 41.
6. Rust returns the three findings for revision 41.
7. Result is valid, so the UI immediately shows all three.
8. No tracked file changes for two seconds.
9. Result becomes valid settled.
```

At step 9 Ariadne writes the transformed records:

```text
Create FLC-A, FLC-B, FLC-C.
Each has:
  baselineGroupId = SQLI-C1
  lifecycleState = candidate
  firstConfirmedAt = now
  currentDetected = true
  durablyResolved = false
  confirmationCount = 1

Create SessionRecord S1:
  status = active
  baselineCheckpoint = revision 41 summary
  latestSettledObservation = revision 41 summary

SQLI-C1 metrics:
  B = 3              // three fixed member FLCs
  O = 3              // none durably resolved
  R = 0
  F = 0 / 3 x 10 = 0
  P = 3 / 3 x 0.8 x 10 = 8
  T = N/A            // session is not complete
  public status = none yet (candidate)
```

The first settled result starts the session and creates the baseline, but it does not yet call the baseline group Persisting. That claim needs time and another settled confirmation.

### Step 1 — Second saved measurement scan: still open

```text
1. Student edits code; live scans may update the UI.
2. Student saves; workspaceRevision is 42.
3. Extension sends a save measurement request for revision 42.
4. Rust returns the same three findings for revision 42.
5. UI updates immediately.
6. Workspace stays at revision 42 for two seconds.
7. The result becomes valid settled.
```

Updates:

```text
FLC-A/B/C:
  lifecycleState = active
  confirmationCount = 2
  lastConfirmedAt = now

S1:
  latestSettledObservation = revision 42 summary
  latest SQLI-C1 F = 0; P = 8
```

If this happened only 10 seconds after the baseline, the baseline group is still not public Persisting because observed age is less than 30 seconds. If the same settled result arrives at least 30 seconds after the first confirmation, SQLI-C1 becomes **Persisting**: it has open findings, two confirmations, and enough observed time.

### Step 2 — Student removes FLC-A and saves

```text
1. Student edits UserRepository, removing FLC-A; live UI updates may reflect it.
2. Student saves at workspaceRevision 43.
3. Rust returns only FLC-B and FLC-C for revision 43.
4. UI immediately stops showing FLC-A.
5. Revision 43 remains unchanged for two seconds.
6. Result becomes valid settled.
```

Updates after that settled result:

```text
FLC-A:
  currentDetected = false
  lifecycleState = provisional_resolution
  missingSince = now
  still counts in O because the absence is not confirmed yet

FLC-B/C:
  remain active

SQLI-C1:
  B = 3; O = 3; R = 0
  F = 0; P = 8
  not Improving yet

S1:
  latestSettledObservation updated with provisional state
```

This is intentional. A comment-out or temporary deletion can create this exact scan result. Ariadne has evidence that A is currently not detected, but it does not yet have evidence that A was durably fixed.

### Step 3 — Later saved confirmation of the removal

```text
1. At least five seconds later, student makes another edit and saves,
   or the final-session scan occurs.
2. Rust still returns only FLC-B and FLC-C.
3. Result is valid and survives the two-second settlement window.
```

Now the removal is durable:

```text
FLC-A:
  lifecycleState = durably_resolved
  durableResolutionAt = now

SQLI-C1:
  B = 3
  O = 2              // B and C remain unresolved
  R = 1              // A is durably resolved
  F = 1 / 3 x 10 = 3.33
  P = 2 / 3 x 0.8 x 10 = 5.33
  public status = Improving

S1:
  latestSettledBaselineGroupSummary(SQLI-C1) = F 3.33, P 5.33, Improving
```

This is the point at which the F/P numbers and Improving status change. One disappearance did not falsely give credit; confirmed absence did.

### Step 4 — Finalising Session 1

At deactivation:

```text
1. S1 changes active -> ending.
2. Extension flushes any pending document updates.
3. It sends final_session for the current workspaceRevision.
4. The matching result is valid and the revision stays unchanged for two seconds.
5. Result becomes valid settled and is written as S1.finalCheckpoint.
6. S1.finalBaselineGroupSummary(SQLI-C1): F 3.33, P 5.33.
7. T = N/A because there is no prior completed comparable session.
8. S1 changes ending -> completed and writes are flushed.
9. Rust stops.
```

If the final result fails, Ariadne can only reuse the latest **valid settled save measurement result** when the workspace revision is unchanged since that result. If that is not true, S1 is `incomplete`: its latest summaries remain audit data only and there is no final F/P/T.

### Step 5 — Session 2 and T

At a later activation, FLC-A remains stored as durably resolved and FLC-B/C as active. The first valid settled scan starts SessionRecord S2. It does not replace SQLI-C1’s `B = 3`.

Suppose FLC-B is then fixed and reaches durable resolution before Session 2 ends:

```text
SQLI-C1 at S2 final checkpoint:
  B = 3
  O = 1
  R = 2
  F = 2 / 3 x 10 = 6.67
  P = 1 / 3 x 0.8 x 10 = 2.67
  T = 6.67 - 3.33 = +3.34
```

The positive T says the same fixed SQL Injection baseline group improved between the final state of two comparable completed sessions. It is not an aggregate cross-session F/P score.

### Step 6 — Return after resolution

If FLC-A returns later:

| Returned fingerprint relationship | FLC-A update | Baseline-group effect |
|---|---|---|
| Same logical + same content + same scope | Set active; increment identical-restoration/toggle count. | A becomes unresolved again, so O rises. Do not count ordinary recurrence. |
| Same logical + changed content + same scope | Set active; increment `recurrenceCount`. | A becomes unresolved again. When its count reaches 2, the active baseline group may show Recurring. |
| Different scope or logical fingerprint | Create a new FLC and a new baseline group. | SQLI-C1’s B/O/F/P/T do not change. |

---

## 8. What the implementation must now do

This clarification changes the earlier implementation plan in these concrete ways:

1. Keep the current 300 ms live scan debounce for UI responsiveness only.
2. Add a save listener that requests a labelled full-workspace measurement scan.
3. Add a global `workspaceRevision` and include it, request ID, and request reason in the Rust protocol/result envelope.
4. Add a 2-second settlement timer after each valid correlated **save/final measurement** result; cancel it on any tracked-file revision change.
5. Remove the redundant `accepted` state/name; use only valid and settled.
6. Start a session at the first valid settled save measurement result after activation.
7. Confirm a provisional absence only with a later valid settled save measurement result or final-session scan at least five seconds later.
8. Make FLCs per scanner-reported instance and assign fixed `baselineGroupId` membership at first settled baseline.
9. Store/update F/P/T in compact **per-baseline-group** session summaries; derive them from member FLC lifecycle states.
10. Use durable resolution—not a single absence—to reduce group O and improve F/P/status.
11. Use the latest valid settled save measurement result as fallback at shutdown when its workspace revision is still current; otherwise mark incomplete.

---

## 9. Final answer in one paragraph

Ariadne may scan in real time for UI feedback, but it uses a result for Trends only when it came from a save-triggered measurement scan (or final-session scan), is valid, and its exact workspace revision has remained unchanged for two seconds. There are only two gates: valid and settled. Each scanner-reported instance has its own FLC for lifecycle evidence. FLCs of the same rule/CWE/type/severity that first appear together form a fixed vulnerability baseline group. The baseline group—not an individual FLC—receives F, P, T, and the four public statuses. A first disappearance is provisional and changes neither F/P nor Improving/Resolved status; only a later valid settled save/final scan after the five-second grace makes it durable. Therefore the framework provides responsive UI feedback while avoiding false fixes, false improvements, and unstable formulas.
