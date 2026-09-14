# Ariadne Trends Framework — Finalization and Review Handoff

**Status:** Proposed final framework for research-lead review  
**Prepared:** 2026-08-04  
**Scope:** Ariadne VS Code extension trend tracking; not the Rust SAST detection engine  
**Source material:** `ariadne_trends_framework_recap.docx` from the research meeting, reconciled with the current extension implementation.

---

## 1. Executive decision

This document finalizes the proposed trends framework while preserving the meeting recap's four public classifications:

1. **Persisting**
2. **Improving**
3. **Resolved**
4. **Recurring**

No public `regressing`, `mixed`, or `new` category is added.

The framework uses three separate kinds of evidence, which must not be conflated:

| Evidence | Question it answers | Final use |
|---|---|---|
| Observed duration and confirmations | Has a finding remained unresolved long enough to count as persisting? | Lifecycle classification |
| Matched baseline-instance counts | Has the finding's open scope reduced? | Improving and remediation scoring |
| Completed session history | Did the finding recur after a confirmed resolution? | Recurring and cross-session analysis |

The original recap's F, P, and T metrics remain part of the framework, with clarified definitions and constraints:

- **F** is a remediation score for a matched baseline cohort.
- **P** is a severity-weighted residual-risk score, not elapsed-time persistence.
- **T** is a difference between comparable completed-session F scores.

This framework deliberately does **not** adopt EWMA as an additional metric. It would add a separate scan-frequency-sensitive concept without improving the four intended classifications. The time-aware lifecycle below directly addresses the research need.

### 1.1 Safeguards and known loopholes at a glance

The framework already contains safeguards, but they are intentionally implemented at the point where each risk occurs. This map makes those protections visible for lead review. These safeguards limit what Ariadne may infer; they do not make unobserved code changes knowable.

| Loophole or risk | Required safeguard | Governing section |
|---|---|---|
| Fast typing produces many temporary scan states | Only valid, settled observations may confirm lifecycle or session results. | 5 |
| The scanner, parser, transport, or workspace initialization fails | A failed, incomplete, or invalid analysis must never create a resolution or remediation event. | 5.3 |
| A valid scan covers a different project, rule set, file set, engine, or parser capability | Compare only observations with the same analysis-context fingerprint; otherwise mark the result incomparable and require an explicit new baseline. | 5.4 |
| An old scan finishes after a newer document version or checkpoint | Carry document/version content identity and a monotonic sequence; discard stale results for lifecycle and session calculations. | 5.5 |
| Normal edits move a finding to another line | Match by logical/context-aware fingerprint; use line number only as a location hint. | 4 |
| Two findings share a CWE/type but are different code problems | Track finding instances first; use CWE/type only for UI aggregation. | 3 and 4 |
| Repeated identical expressions or a fingerprint collision make matching uncertain | Use versioned, one-to-one occurrence matching; do not claim continuity, resolution, recurrence, or partial remediation when the match is ambiguous. | 4.2 |
| A student temporarily deletes or comments out code | First absence is only provisional; require a grace period and later eligible checkpoint. | 8.2 |
| The exact same code is restored after an observed absence | Record identical restoration/toggle data; invalidate the provisional fix and do not award durable-fix credit. | 11 |
| Code remains commented out, suppressed, or otherwise undetected | Report only durable scanner absence in a comparable context; do not call it a semantic fix, proof of secure code, or proof of intent. | 2.3, 8, and 11 |
| A new finding appears after the initial baseline | Give it its own baseline and lifecycle; do not corrupt the original cohort's F/P ratio. | 9.3 |
| Sessions before the finding existed lower cross-session values | Exclude them from the eligible-session denominator. | 10 |
| VS Code stops before a valid final checkpoint is accepted | Mark the session incomplete/abandoned; exclude it from all cross-session numerators and denominators. | 6.1 |
| Extension inactivity, restart, or an incomparable gap inflates time persistence | Count only active, comparable observation time in the current persistence window; do not silently add unobserved wall-clock time. | 8.1 |
| A recurrence or resolution is used to infer student intent or learning | Limit claims to observed code behavior and seek qualitative evidence for causal claims. | 2.3 and 11.4 |
| A code change occurs entirely between scans | Do not invent an event Ariadne did not observe; report only observed persistence, absence, and restoration. | 8.1 and 11.3 |
| Unbounded scan-history storage creates retention or consistency problems | Store session/lifecycle summaries by default, retain raw scans only temporarily or under approved research policy, and serialize persistence writes. | 4.3, 6.2, and 13.1 |

The acceptance tests in Section 15 are the verification gate for these safeguards. The framework is not ready for research reporting until they pass.

---

## 2. Final research objective and claim boundaries

### 2.1 Objective

The Trends framework observes whether security findings detected by Ariadne:

- remain unresolved;
- decrease in scope;
- become confirmed absent; or
- return after a confirmed absence.

It is intended to provide a temporal view of remediation behavior that the current severity-only view does not provide.

### 2.2 What the framework may claim

The framework may report:

- observed finding lifetime;
- confirmed remediation events;
- residual finding burden;
- recurrence frequency; and
- trends across defined observation sessions.

### 2.3 What the framework must not claim on its own

The framework must **not** claim that a student:

- intended to hide code;
- permanently fixed a vulnerability merely because one scan did not find it;
- understood or failed to understand a security concept solely from recurrence;
- caused a finding to recur through independent rewriting rather than refactoring, copying, reverting, or tooling variation.

Recurring and identical-restoration events are research signals that can guide qualitative follow-up. They are not proof of comprehension, intent, or causality.

---

## 3. Terms and measurement units

The following terms are normative for implementation and reporting.

| Term | Definition |
|---|---|
| **Occurrence** | One reported source location for a finding, normally a file and source location. |
| **Finding instance** | A stable, fingerprinted security finding in a specific contextual scope. It may contain one or more occurrences. |
| **Vulnerability type** | The user-facing CWE/rule family, such as SQL Injection. It is an aggregation label, not a tracking identity. |
| **Baseline cohort** | The matched instances/occurrences present when an instance or pattern is first confirmed in an observation session. |
| **Valid observation** | A complete, successful Ariadne analysis result that is safe to use for lifecycle calculations. |
| **Settled observation** | A valid observation taken after an agreed stable point: idle, save, manual analysis, or final checkpoint. It becomes lifecycle-eligible only when it is also comparable and accepted. |
| **Comparable observation** | A valid, settled observation whose analysis context and accepted ordering make it safe to compare with the relevant baseline or lifecycle record. |
| **Analysis-context fingerprint** | A versioned record/hash of the project identity, scanned-file scope, enabled rule/configuration version, engine version, parser/language capability, and relevant ignore/exclusion settings. |
| **Provisional resolution** | An accepted, comparable valid observation has stopped detecting a finding, but absence has not yet been confirmed. |
| **Durable confirmed resolution** | A provisional resolution remains absent at a later accepted comparable eligible checkpoint. |
| **Observation session** | A defined period with a baseline and a final accepted comparable checkpoint; it is not an arbitrary live-edit scan. |
| **Eligible session** | A completed observation session from a finding's first confirmed appearance through its current state or durable resolution. |
| **Incomplete session** | A session without an accepted, valid, comparable final checkpoint. It is retained for audit but excluded from cross-session calculation. |

### 3.1 Unit rule

The framework tracks lifecycle at the **finding-instance level**, then aggregates by vulnerability type for presentation.

This is essential. All findings with the same CWE/type cannot be treated as one object. Two SQL-injection findings in different files or methods may have completely different lifecycles.

### 3.2 UI aggregation rule

The collapsed Trends card counts **fingerprinted finding instances**, not CWE/type groups and not raw occurrences. The expanded view groups those instances by CWE/type.

Consequently, a type may appear in multiple expanded sections when different instances have different histories. This is more accurate than forcing every finding of a type into one status.

---

## 4. Stable finding identity

Time-based or cross-session tracking is invalid without reliable identity matching across edits.

### 4.1 Required fingerprints

Each tracked finding must have stable identifiers that separate logical continuity, exact restoration, and repeated occurrences in the same scope.

| Identifier | Purpose |
|---|---|
| **Logical fingerprint** | Matches the same logical finding through line movement and minor non-security-relevant edits. |
| **Content fingerprint** | Detects materially identical vulnerable code/context when it disappears and later returns. |
| **Scope fingerprint** | Identifies the enclosing method/class/source-sink context in which the finding occurs. |
| **Occurrence discriminator** | Separates repeated, otherwise identical occurrences in the same scope when a one-to-one match would otherwise be ambiguous. |

The fingerprint should be built from available or newly emitted metadata:

```text
rule ID
+ CWE/type
+ instance kind/name
+ enclosing class/method or source/sink context
+ normalized relevant AST/source expression
+ file path as a secondary signal
```

The line number is only a fallback/location hint. It must not be the primary tracking key because line numbers move under normal editing.

Fingerprint construction and matching rules must be versioned. A change to the fingerprint scheme is a comparability boundary unless a validated migration proves that the old and new identifiers can be matched safely.

### 4.2 Matching policy

| Match result | Interpretation |
|---|---|
| Same logical fingerprint | Candidate continuation of the same finding lifecycle. |
| Same logical + same content + same scope | Identical restoration candidate after an absence. |
| Same logical, changed content, same scope | Reappearance/recurrence after modification. |
| Same CWE/rule but a different logical fingerprint | Separate/new finding instance. |
| More than one plausible prior/current occurrence match | Ambiguous match: do not claim continuity, resolution, recurrence, or partial remediation. |
| No one-to-one match | Preserve separate candidates or mark the comparison unavailable; do not collapse repeated occurrences into one finding. |

Matching must be one-to-one within a comparison: one prior occurrence can match at most one current occurrence, and vice versa. If duplicate expressions or a fingerprint collision make that impossible, the affected cohort is marked `ambiguous`. Its lifecycle state may remain visible as last known, but it receives no resolution, recurrence, F/P/T, or cross-session credit until a later unambiguous comparable observation exists.

### 4.3 Privacy and storage

Store hashes or normalized structural identifiers, not raw code merely for trend tracking. Raw source remains governed by the editor/workspace and normal Ariadne analysis flow.

---

## 5. Valid and settled observations

### 5.1 Why raw scan frequency is not a persistence measure

The extension's live-update path has a 300 ms trailing debounce **and** a max-wait timer that forces scans during continuous typing. It therefore does not guarantee that every live scan represents a finished code state.

See [`documentEvents.ts`](../src/modules/detection/bridge/documentEvents.ts).

For that reason:

- live scans may immediately update diagnostics and the Active Vulnerabilities panel;
- only accepted, comparable settled observations may confirm a lifecycle transition, F/P calculation, or session result.

### 5.2 Eligible settled observations

Use one or more of these, in priority order:

1. A user-triggered manual analysis.
2. A scan after an agreed editor-idle interval longer than the live debounce.
3. A save-triggered scan.
4. A final session checkpoint.

Initial implementation values, subject to pilot validation:

```text
minimum active comparable observed duration: 30 seconds
minimum settled confirmations: 2
absence grace period: 5 seconds
```

These are policy defaults, not universal statistical constants. The study should record enough sessions to evaluate whether they suppress transient edit-state transitions without hiding meaningful remediation.

### 5.3 Valid-analysis safeguard

An empty or missing result may count toward resolution only if analysis is known to be complete and successful. The following must never produce a resolution transition:

- Ariadne core process failure;
- invalid/non-JSON engine output;
- incomplete workspace initialization;
- explicitly failed analysis;
- a known parser/transport failure;
- an unavailable required source file or invalid snapshot.

This protects against false “fixes” caused by tool failure rather than code changes.

### 5.4 Analysis-context comparability safeguard

A result can be valid and successful while still being unsafe to compare with the baseline. For example, a finding can disappear because a rule was disabled, a file was excluded, the workspace/project changed, the engine version changed, or the relevant parser/language capability changed.

Every settled observation must therefore carry an `analysisContextFingerprint` containing, at minimum:

```text
workspace/project identity
+ scanned-file scope
+ enabled rules and ruleset/configuration version
+ engine version
+ language/parser capability version
+ relevant include, ignore, exclusion, and suppression configuration
```

When that fingerprint differs from the relevant baseline or active lifecycle context, mark the observation **incomparable**. An incomparable observation may still update live editor diagnostics, but it must not:

- create a resolution, recurrence, or identical-restoration transition;
- contribute a confirmation or persistence duration;
- calculate or change F, P, T, `F_cross`, or `P_cross`; or
- turn an absent finding into a claimed fix merely because it left the scan scope.

An explicit, recorded re-baseline may start a new lifecycle/cohort under the new context. It never awards remediation credit to the old cohort.

### 5.5 Stale-result and ordering safeguard

Live analysis is asynchronous. A scan of an older document can finish after a scan of newer code. Serializing storage writes alone does not make the older result safe for lifecycle logic.

Each observation must carry:

```text
sessionId
monotonic observation sequence number
document version or normalized content hash
analysis start and completion timestamps
analysisContextFingerprint
```

Apply an observation to lifecycle/session state only when it belongs to the active session, has the accepted analysis context, and is not stale for the document/checkpoint it represents. A result that finishes late for an earlier document version or lower sequence number is discarded for trend calculations; it must not set `missingSince`, restore a finding, or become the session-final checkpoint.

---

## 6. Session boundaries and storage

### 6.1 Final session definition

The recap's session-based formulas require an explicit operational session.

```text
Session start: first accepted valid settled observation after activation or an explicit Start Session action.
Session end: explicit End Session, controlled study checkpoint, or normal deactivation with a final accepted comparable settled scan.
```

Only a session with an accepted, valid, settled, **comparable** final checkpoint is completed. Only completed sessions count in cross-session formulas.

If deactivation, a crash, or a final-checkpoint failure prevents that checkpoint, record the session as `incomplete` or `abandoned`. Retain it for audit if policy permits, but exclude it from every cross-session numerator and denominator. Do not fabricate a final result from an earlier live scan.

If a study needs reproducible sessions, an explicit Start/End Session workflow is preferable to inferring sessions solely from VS Code process lifetime.

### 6.2 Store summaries, not unbounded raw history

The final design stores:

```text
SessionRecord
  sessionId
  startedAt
  endedAt
  completionStatus              // completed | incomplete | abandoned
  analysisContextFingerprint
  lastAcceptedObservationSequence
  baselineCheckpoint
  finalCheckpoint
  per-instance lifecycle summaries
  aggregate F, P, T inputs/results

FindingLifecycleRecord
  logicalFingerprint
  contentFingerprint
  scopeFingerprint
  occurrenceDiscriminator
  fingerprintSchemeVersion
  baselineAnalysisContextFingerprint
  firstConfirmedAt
  lastConfirmedAt
  persistenceWindowStartedAt
  observedActiveDurationMs
  missingSince
  provisionalResolutionAt
  durableResolutionAt
  baselineOccurrenceCount
  currentOccurrenceCount
  persistenceWindowConfirmationCount
  recurrenceCount
  inSessionToggleCount
  identicalRestorationCount
  ambiguousMatchCount
```

Each persisted checkpoint also retains its accepted sequence number, document version/content hash, and analysis-context fingerprint so later analysis can audit why it was eligible or excluded.

Raw scan snapshots may be retained temporarily for debugging or an approved research sample, but not indefinitely by default.

### 6.3 Current implementation discrepancy

The existing extension does **not** have true session boundaries. It appends a `ScanSnapshot` for each engine findings response and retains the full array in workspace state, including across VS Code restarts. See [`extension.ts`](../src/extension.ts), [`convert.ts`](../src/modules/detection/bridge/convert.ts), and [`sessionStore.ts`](../src/modules/tracker/storage/sessionStore.ts).

The finalized framework is therefore a proposal requiring tracker/storage changes, not a description of current behavior.

---

## 7. Lifecycle and public status rules

### 7.1 Internal lifecycle

```text
first accepted comparable observation
        │
        ▼
candidate / not yet eligible
        │  (minimum duration + confirmations)
        ▼
active tracked finding ── absent ──► provisional resolution
        │                                  │
        │                                  ├── remains absent at later eligible checkpoint
        │                                  │          ▼
        │                                  │     durable confirmed resolution
        │                                  │
        └── reappears ─────────────────────┘
                   │
                   ├── identical content/scope: identical restoration flag
                   └── changed content: recurrence candidate
```

`candidate / not yet eligible` is an internal state only. It is not a new public Trends-card category.

Every lifecycle transition below requires an accepted, valid, settled, comparable observation and an unambiguous one-to-one finding match.

### 7.2 Public classifications

| Status | Exact rule |
|---|---|
| **Persisting** | The finding is active, has met the active comparable observed-duration and settled-confirmation rule, and has not met the Improving rule. A count increase remains Persisting. |
| **Improving** | The finding remains active, but its matched open occurrence count is lower than its comparable baseline/current comparison cohort, confirmed by a settled observation. |
| **Resolved** | The finding's absence has reached durable confirmed resolution in a comparable context. This is scanner-confirmed absence, not proof of a permanent semantic fix. |
| **Recurring** | A previously durable-confirmed-resolved finding later reappears with the same logical fingerprint in a comparable context and is eligible under the recurrence threshold below. |

### 7.3 Classification priority

For reporting, apply the following priority:

```text
1. Recurring
2. Resolved
3. Improving
4. Persisting
5. Candidate/not yet eligible: omitted from Trends classification
```

This avoids a resolved finding simultaneously being shown as improving, and ensures recurring history is not hidden by a current count reduction.

### 7.4 No regression status

To preserve the recap's four-status model, an increase in occurrences does not create a fifth `regressing` category. It remains **Persisting**. The expanded UI may state:

```text
Open occurrences increased from 3 to 5 in this session.
```

This preserves information without expanding the status taxonomy.

---

## 8. Time-based persistence

For a currently active finding at an **accepted, comparable, settled** observation time `t`:

```text
observedAge = accumulated active, comparable observation time
              in the current persistence window
```

The persistence window begins at the first accepted confirmation for that finding in the active session/context. At each later accepted active confirmation, add only the interval since the preceding accepted active confirmation in that same window. Do not add an interval that crosses an accepted absence, a session boundary, an inactive/deactivated period, an incomplete session, or an analysis-context boundary. While a finding is provisionally absent, its persistence clock is frozen; if it reappears before durable resolution, a later accepted active interval may begin again.

This makes `observedAge` a sum of intervals bracketed by accepted comparable active observations. Time after the last accepted active checkpoint is never assumed. The measure therefore remains conservative even though Ariadne cannot see edits that occur and are undone between scans.

`persistenceWindowConfirmationCount` counts accepted comparable active confirmations in the same persistence window. It resets when a new session or analysis-context boundary starts a new window; a brief provisional absence that returns before durable resolution freezes time but does not create a false completed remediation event.

Historical `firstConfirmedAt` remains useful for research history, but it is not used to add unobserved wall-clock time to the Persisting threshold. A finding carried into a new session keeps its historical lifecycle record; its current session's persistence window begins with its first accepted confirmation in that session.

A finding becomes eligible for Persisting when:

```text
currently active
AND observedAge >= minimumDuration
AND persistenceWindowConfirmationCount >= minimumSettledConfirmations
```

### 8.1 Interpretation

This measures **observed persistence while Ariadne was able to observe a comparable session**, not proof that the finding existed continuously between scans. Ariadne cannot infer edits that occurred and were undone between scans, nor can it use a long period while the extension was inactive as evidence of monitored persistence.

If a future study needs calendar elapsed time since first detection, store it separately as `elapsedSinceFirstDetected` and label it clearly. It must not replace `observedAge` in the Persisting rule.

### 8.2 Absence grace period

When an accepted, comparable, valid settled observation no longer finds a previously active finding:

```text
missingSince = observation time
state = provisional resolution
```

If the finding returns before durable confirmation, the same lifecycle resumes. If it remains absent through the required grace period and a later accepted comparable checkpoint, it becomes Resolved.

This prevents a temporary deletion/comment-out during editing from becoming a claimed remediation event.

---

## 9. F, P, and T formulas

### 9.1 Within-session baseline cohort

For a matched finding instance or coherent matched pattern group:

```text
B = baseline occurrence count at first accepted comparable observation
O = current matched open occurrence count
R = B − O
W = severity weight
```

Use the meeting recap's severity weights:

```text
Critical = 1.0
High     = 0.8
Medium   = 0.6
Low      = 0.4
```

The finalized formulas are:

```text
F = (R / B) × 10
P = min(1, O / B) × W × 10
```

### 9.2 Meaning

| Metric | Meaning | Constraint |
|---|---|---|
| `F` | Proportion of the matched baseline no longer detected, on a 0–10 scale | Valid only when the numerator and denominator refer to the same unambiguous matched baseline cohort in a comparable analysis context. |
| `P` | Severity-weighted residual burden of the baseline, on a 0–10 scale | It is not elapsed-time persistence. Its score is capped to maintain the advertised scale and requires the same comparable baseline cohort. |
| `T` | Change in remediation score between comparable sessions | Valid only for the same matched cohort, analysis context, and session-end definition. |

### 9.3 New instances after baseline

Newly introduced findings must start their own baseline/lifecycle. They must not silently make `O > B`, which would otherwise invalidate the original ratio. A new instance can be surfaced in expanded detail, but it is not a new public Trends status.

### 9.4 Do not classify with one global P threshold

Because P includes severity weights, its maximum differs by severity:

```text
Critical: 10
High:      8
Medium:    6
Low:       4
```

Therefore a single global rule such as “P >= 7 is high persistence” is invalid. Use time/lifecycle and matched-count rules for classification; use P for priority/ranking and analytical reporting.

### 9.5 Trend score

For comparable completed sessions:

```text
T = F_current_session − F_previous_comparable_session
```

If either session lacks an accepted comparable matching baseline or final checkpoint, T is `N/A`, not zero.

---

## 10. Cross-session formulas

Sessions before a finding first existed must not dilute its score.

```text
eligible sessions = completed, comparable sessions from first confirmed appearance
                    through current state or durable resolution
```

Use:

```text
F_cross =
  (eligible sessions containing a durable confirmed absence/remediation event
   / eligible completed, comparable sessions) × 10

P_cross =
  (eligible sessions ending with the finding Persisting
   / eligible completed, comparable sessions) × W × 10
```

### 10.1 Interpretation

These quantify **session prevalence and observed absence/remediation events**, not wall-clock duration. Five short sessions and five long sessions receive the same cross-session weight; observed duration remains the separate time-based metric in Section 8. Incomplete, incomparable, or ambiguous-match sessions do not enter either formula.

### 10.2 Durable remediation rule

A one-session disappearance is a provisional resolution, not a durable confirmed absence/remediation event. It must not enter `F_cross` until an eligible later comparable checkpoint verifies absence.

This prevents temporary hiding, scanner failure, a scope/configuration change, or a short-lived edit from inflating the research result. Even durable absence is an operational scanner result, not proof that the code is semantically secure or that a student intentionally remediated it.

---

## 11. Recurrence and identical restoration

### 11.1 Recurrence count

Store:

```text
recurrenceCount = number of durable-confirmed-resolved → active
                  transitions in a comparable context
```

The first reappearance is recorded as a recurrence event. To preserve the recap's anti-noise intent, show **Recurring Pattern** in the public Trends card only when:

```text
recurrenceCount >= 2
```

This wording replaces the ambiguous phrase “alternates at least twice.” It means two confirmed reappearances after durable confirmed resolutions.

Before that threshold, retain the event in research data and classify the currently active finding by the ordinary Persisting/Improving rules.

### 11.2 Identical restoration / suspected toggle

An SAST scan cannot tell whether vulnerable code is genuinely remediated or temporarily hidden by a comment, deletion, or paste workflow. Add an internal measurement-integrity flag, not a fifth public status.

```text
IdenticalRestoration = true when:

1. A previously active finding becomes absent in an accepted comparable valid observation; and
2. The same logical finding becomes active again; and
3. Its content fingerprint and scope fingerprint match the prior active finding.
```

This means **identical restoration observed**, not proof of a student’s intent.

### 11.3 In-session toggle counter

At session end, persist:

```text
inSessionToggleCount
identicalRestorationCount
```

Increment the counter only for an observed accepted comparable valid sequence:

```text
active → absent → active
```

with the same logical, content, and scope fingerprints.

This closes the final-snapshot-only blind spot without retaining every raw scan indefinitely. It cannot detect a comment-out/paste-back sequence that happened entirely between scans; such an unobserved event also must not be invented after the fact.

### 11.4 Effect on scoring

For an identical restoration:

- invalidate a prior provisional resolution;
- do not count that disappearance as a durable remediation event;
- do not include it in `F_cross` as a fix;
- store it separately for research-quality review;
- do not treat it as evidence of understanding or lack of understanding.

For a changed-content reappearance with a matching logical fingerprint:

- increment recurrence data after the durable-resolution condition;
- do not claim that it was independently rewritten or intentional;
- use qualitative evidence before making a learning claim.

If code remains commented out, suppressed, or otherwise undetected and never returns, Ariadne cannot distinguish that condition from a genuine remediation solely from scanner output. In a stable comparable scope it may report durable scanner absence; it must not report proof of semantic correctness, secure behavior, intent, or learning. A changed rule, scope, ignore, or suppression configuration is handled as an incomparable observation under Section 5.4 rather than as resolution.

---

## 12. Examples

### 12.1 Stable unresolved finding

```text
10:00:00  settled scan: finding A active
10:00:30  settled scan: finding A active
10:00:35  settled scan: finding A active
```

At 10:00:30, finding A has two confirmations and 30 seconds observed age. It is eligible for **Persisting** unless its matched count has reduced enough to be Improving.

### 12.2 Partial remediation

```text
Baseline: B = 4 occurrences
Current:  O = 2 occurrences
Severity: High, W = 0.8
```

```text
F = ((4 − 2) / 4) × 10 = 5.0
P = min(1, 2 / 4) × 0.8 × 10 = 4.0
```

The active matched scope has declined, so it is **Improving**. It is not resolved because open occurrences remain.

### 12.3 Confirmed resolution

```text
10:00:00  finding A active
10:01:00  accepted comparable settled scan: A absent → provisional resolution
10:01:07  accepted comparable settled scan: A absent → durable confirmed resolution
```

With a five-second grace period and later confirmation, A becomes **Resolved**. The resolution is observationally confirmed; it is not described as a permanent or intentional fix.

### 12.4 Identical restoration in one session

```text
10:00:00  A active; logical L, content C, scope S
10:01:00  A absent
10:01:03  A active; logical L, content C, scope S
```

Record an `identicalRestoration` and increment the in-session toggle count. Do not count a durable fix.

### 12.5 Reappearance after durable resolution

```text
Session 1 end: A is durably resolved
Session 2 end: A returns with matching logical fingerprint but changed content
```

Record one recurrence transition. It remains subject to ordinary active classification until the configured public recurrence threshold is met.

### 12.6 Same CWE, different finding

```text
Existing: SQL Injection in OrderService.search
Later:    SQL Injection in AdminController.lookup
```

The same CWE/type alone is insufficient to mark recurrence or continuity. These are separate finding instances.

### 12.7 Scan-scope or engine-context change

```text
Session baseline: rule R is enabled and file A is in scope; finding A is active
Later:            rule R is disabled, or file A is excluded
Settled scan:     A is absent
```

The scan may be valid, but its `analysisContextFingerprint` differs. It is **incomparable**, so it cannot resolve A or give F/`F_cross` credit. An explicit re-baseline under the new context begins a new cohort rather than treating the old one as fixed.

### 12.8 Older scan result finishes last

```text
Sequence 42: document version V2 is analyzed and accepted
Sequence 41: an earlier analysis of document version V1 finishes afterward
```

Sequence 41 is stale. It is discarded for lifecycle calculations even if its engine result is valid. It cannot overwrite the accepted state from V2, set `missingSince`, or become the final session checkpoint.

### 12.9 Incomplete session

```text
Session end requested
Final scan fails or VS Code closes before an accepted final checkpoint
```

Record the session as incomplete or abandoned. It may remain available for audit, but it contributes nothing to `F_cross`, `P_cross`, or T.

### 12.10 Duplicate matching is ambiguous

```text
Baseline: two identical vulnerable expressions occur in the same method
Later:    one matching expression remains, but no stable occurrence discriminator exists
```

Do not guess which original occurrence was removed. Mark the comparison ambiguous and withhold partial-remediation, resolution, recurrence, and score credit until matching becomes unambiguous.

---

## 13. Current codebase versus final framework

| Area | Current implementation | Final framework |
|---|---|---|
| Tracking identity | `cwe_id::type` | Stable finding-instance fingerprint |
| Instance grouping | Usually `instance_name`; fallback file/line | Context-aware logical/content/scope fingerprints |
| Scan input | Every engine result | Accepted valid, settled, comparable observations for lifecycle confirmation |
| Analysis scope | No comparability guard for rule/configuration/file-scope/engine changes | Versioned analysis-context fingerprint; mismatch is incomparable, not a fix |
| Result ordering | No lifecycle guard against stale document results | Session sequence + document version/content hash; stale results are excluded |
| Time | Timestamp exists but is unused in classification | Active comparable observed duration, confirmation window, absence grace period |
| Persisting | Present in immediate prior scan and current instance count is equal/higher | Active long enough with settled confirmations and no improving condition |
| Improving | Immediate instance count reduction | Confirmed matched baseline/cohort reduction |
| Resolved | Seen anywhere in history but absent now | Durable confirmed absence transition |
| Recurring | Not implemented | Durable resolved → active transitions with explicit threshold |
| F/P/T | Not implemented | Defined supplementary metrics |
| Session | No real boundary; all snapshots persist across restarts | Explicit completed observation session |
| Trend count unit | CWE/type group count | Fingerprinted instance count, grouped by type in UI |
| Toggle handling | Not implemented | Identical-restoration integrity flag and lightweight counters |
| Incomplete session | No completed-session model | Explicit incomplete/abandoned status, excluded from cross-session metrics |

Relevant current source files:

- [`snapshotAnalyzer.ts`](../src/modules/tracker/analysis/snapshotAnalyzer.ts)
- [`analysisTypes.ts`](../src/modules/tracker/analysis/analysisTypes.ts)
- [`convert.ts`](../src/modules/detection/bridge/convert.ts)
- [`sessionStore.ts`](../src/modules/tracker/storage/sessionStore.ts)
- [`documentEvents.ts`](../src/modules/detection/bridge/documentEvents.ts)
- [`extension.ts`](../src/extension.ts)

### 13.1 Current implementation caveats to preserve in the handoff

1. Current `persistingPatterns` is an immediate latest-vs-previous scan count, not time-based persistence.
2. Current `resolvedThisSession` examines all persisted history and can repeat a resolution count on later scans; it is not a one-time session transition.
3. Current snapshot persistence is asynchronous read-modify-write. High-frequency results should be serialized before implementing final-session persistence.
4. The Rust payload currently lacks the contextual scope/structural identifiers needed for faithful scope-aware matching. The engine/API must be extended or the extension must derive a safe equivalent.
5. The current UI's severity cards count occurrences, while current trend counts are not consistently instance-based. The final unit rule in Section 3 resolves this.
6. Current scan results do not carry a persisted analysis-context fingerprint, document-version/content identity, or monotonic lifecycle sequence. Scope changes and late old results could otherwise produce false transitions.
7. Current grouping does not implement versioned one-to-one matching for repeated identical occurrences. It cannot safely award partial-fix credit where matching is ambiguous.
8. Current workspace-state history is not a completed-session model. It needs explicit recovery rules so a shutdown or failed final scan cannot silently become a completed session.

---

## 14. Required implementation order

Implement in this order to avoid calculating misleading metrics on weak identity data.

1. **Introduce stable, versioned identity data.**  
   Extend engine metadata or extension-side derivation with logical/content/scope fingerprints, an occurrence discriminator for duplicates, and conservative one-to-one matching.

2. **Add an accepted-observation envelope.**  
   Attach analysis-context fingerprint, session ID, monotonic sequence, document version/content hash, and timestamps. Reject stale or incomparable results for trend calculations.

3. **Define and persist real session boundaries.**  
   Add start/end/checkpoint behavior, incomplete-session recovery, active comparable persistence windows, and a serial persistence queue.

4. **Differentiate live scans from settled observations.**  
   Keep real-time diagnostics responsive, but only accepted settled observations drive lifecycle metrics.

5. **Implement finding lifecycle records.**  
   Include persistence-window confirmations, absence grace, provisional/durable resolution, recurrence, identical restoration, and ambiguity fields.

6. **Implement F, P, T and cross-session scores.**  
   Only after comparable, unambiguous matched baseline cohorts exist.

7. **Update the Trends UI and notifications.**  
   Count instances; group by type; use only the four public statuses.

8. **Validate on recorded histories before research use.**  
   Tune duration, confirmation, and grace-period policy values from observed data.

---

## 15. Required acceptance tests

The framework is not ready for research reporting until these tests pass.

| Scenario | Expected result |
|---|---|
| Same finding moves after lines are inserted | Same logical lifecycle; not resolved/new solely due to line movement |
| Same instance name in different files/methods | Separate tracking identities |
| Two identical vulnerable expressions occur in one scope | One-to-one occurrence matching keeps them separate; if it cannot, the cohort is ambiguous and receives no transition or score credit |
| Fingerprint scheme changes | No automatic old/new continuity unless a validated migration is available |
| Core process or parse/transport failure | No resolution or remediation event |
| Rule set, engine, parser capability, file scope, ignore, or exclusion configuration changes | Observation is incomparable; no resolution, recurrence, persistence confirmation, or F/P/T/cross-session credit; explicit re-baseline starts a new cohort |
| Continuous typing produces interim scans | Interim scans do not confirm lifecycle transitions |
| Slow analysis of an older document finishes after a newer result | Older result is discarded for lifecycle/session state and cannot overwrite the accepted checkpoint |
| Finding is absent briefly, then returns within grace | No Resolved status |
| Finding stays absent beyond grace and later checkpoint | One durable Resolved transition |
| Extension deactivates or restarts before final comparable checkpoint | Session is incomplete/abandoned and excluded from all cross-session denominators and numerators |
| A finding reappears in a new session after a long inactive gap | Historical record remains, but inactive wall-clock time does not satisfy the current persistence window |
| Baseline count decreases while findings remain | Improving classification and correct F/P |
| Count increases | Persisting classification; expanded detail reports increase; no fifth status |
| New finding after baseline | New separate lifecycle/baseline; no ratio corruption |
| Identical code is observed absent then restored in one session | Toggle/identical-restoration counter increments; no durable fix |
| Different-content finding reappears after durable resolution | Recurrence transition is recorded |
| Identical finding returns after provisional resolution | Provisional fix invalidated; no F_cross fix credit |
| Finding returns after one recurrence event | Recorded, but public Recurring Pattern appears only at configured threshold |
| Sessions before first detection | Excluded from cross-session denominator |
| Two same-type instances have different histories | Instance-level statuses remain distinct; UI groups correctly by type |
| Rapid result emissions | Persistence writes remain ordered and cannot overwrite snapshots/summary state |
| Code remains commented, suppressed, or otherwise absent without a scope/configuration change | Report only durable scanner absence; no claim of semantic correctness, intent, or learning is emitted |

---

## 16. Final statement for lead review

> Ariadne will track stable, context-aware finding instances across accepted, valid, settled, comparable observations and completed sessions. It will report Persisting, Improving, Resolved, and Recurring findings, aggregate those instances by vulnerability type for presentation, and use active comparable observed duration—not scan count or inactive wall-clock time—to determine persistence. F measures matched-baseline detector absence/remediation, P measures severity-weighted residual burden, and T compares comparable completed-session remediation scores. A resolution is provisional until later comparable absence confirms it. Scope changes, stale results, ambiguous matching, and incomplete sessions cannot create credit or transitions. Identical restoration is retained as a measurement-integrity flag rather than a student-behavior classification. All findings are observational signals and do not independently establish intent, permanent remediation, semantic security, or secure-coding understanding.

---

## 17. Lead review checklist

Before implementation begins, the research lead should explicitly approve or amend:

- [ ] The four public statuses and the exclusion of `new`, `mixed`, and `regressing` from the Trends card.
- [ ] The instance-level tracking unit and required fingerprint fields.
- [ ] The versioned fingerprint scheme, one-to-one duplicate matching rule, and ambiguous-match handling.
- [ ] The definition of valid and settled observations.
- [ ] The analysis-context fingerprint and the rule that an incomparable result cannot create a transition or score credit.
- [ ] The stale-result rule: session sequence plus document version/content identity before applying a result.
- [ ] The 30-second duration, two-confirmation, and five-second grace starting values.
- [ ] The active comparable persistence-window rule and the separate treatment of inactive wall-clock time.
- [ ] The operational definition of a session and its final checkpoint.
- [ ] The incomplete/abandoned-session recovery rule and its exclusion from cross-session formulas.
- [ ] The F/P/T semantics and severity weights.
- [ ] The eligible-session denominator for cross-session scores.
- [ ] The durable-confirmed-resolution requirement for `F_cross`.
- [ ] The recurrence threshold of two confirmed reappearances for public display.
- [ ] The identical-restoration/toggle integrity flag and its exclusion from durable-fix credit.
- [ ] The restriction of research claims to observed scanner behavior, including the limitation that durable absence is not proof of semantic security, intent, or learning.
- [ ] The acceptance-test gate, including scope-change, stale-result, duplicate-match, and incomplete-session cases.

Once these decisions are approved, implementation can proceed without changing the framework's conceptual scope.
