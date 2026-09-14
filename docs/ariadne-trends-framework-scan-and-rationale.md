# Ariadne Trends Framework — Scan Process, Rationale, and Recap-to-Finalized Comparison

**Purpose:** A lead-review and implementation reference for the Ariadne Trends framework. It follows the requested scan-flow questions in order, while making the comparison between the original recap and the finalized proposal easy to find.

**Governing proposal:** the team-supplied revised handoff, `ariadne-trends-framework-finalization (1).md` in `/home/zdrco/Downloads`. This document deliberately uses that revised file rather than the older local `docs/ariadne-trends-framework-finalization.md`.

**Status vocabulary in this document:**

| Label | Meaning |
|---|---|
| **Current code** | What the checked Ariadne VS Code extension and Rust engine do today. |
| **Original recap** | The initial conceptual framework in `ariadne_trends_framework_recap.docx`. It is not a description of the shipped code. |
| **Finalization** | The revised proposed framework that should govern a future implementation after lead approval. It is not implemented yet. |

---

## Executive decision — read this first

The finalization keeps exactly four public Trends statuses:

1. **Persisting**
2. **Improving**
3. **Resolved**
4. **Recurring**

It does not add public `New`, `Mixed`, or `Regressing` labels. A newly observed finding may be tracked internally as a candidate, and a growing count may be explained in expanded detail, but neither creates a fifth public category.

The central change is not a new UI label. It is a stronger evidence model:

```text
raw scan result
    → valid + settled observation
    → stable finding-instance match
    → lifecycle transition
    → within-session / cross-session measurement
```

Each part answers a different question. They must not be substituted for one another.

| Evidence | Question | Final use |
|---|---|---|
| Observed duration plus settled confirmations | Has an active finding remained observed long enough to call it Persisting? | Lifecycle status |
| Matched baseline occurrence counts | Has the same finding's open scope reduced? | Improving and within-session F/P |
| Completed eligible-session history | Has a durably resolved finding reappeared, and how often do remediation/residual states occur across sessions? | Recurring and cross-session F/P |

### The primary comparison at a glance

This is the short version of **recap implementation versus finalized framework**, with the actual code shown separately so the three are never confused.

| Area | Original recap's direction | Revised finalization | Current code today |
|---|---|---|---|
| Tracking unit | Vulnerability types with instances beneath them. | Track stable **finding instances** first; group by type only for UI. | Primarily groups by `cwe_id::type`; an instance key is usually a name or `file:line`. |
| Scan stability | Treats a 300–500 ms debounce as a stable-state filter. | Live scans remain useful for feedback, but only valid **settled** observations can change lifecycle or metrics. | A 300 ms trailing timer and a 300 ms max-wait timer can emit scans during continuous typing. |
| Persisting | Initially tied to scan/session patterns and a P “persistence” score. | Time-aware: active long enough plus confirmations; P is renamed conceptually as residual burden. | Two latest snapshots are compared immediately. |
| Improving | Intended reduction in instances. | Lower matched open count in the same baseline cohort, confirmed at a settled observation. | Lower count in the immediately previous broad type group. |
| Resolved | Absence at a session end could look like a fix. | Provisional absence, grace period, then a later eligible confirmation. | Present in any earlier snapshot but absent now. |
| Recurrence and toggles | Recognized an alternating pattern, but not an exact operational event. | Count durable-resolution-to-active transitions; detect identical restoration as an integrity flag. | No recurrence lifecycle or toggle tracking. |
| F/P/T | Retains scores, severity weights, and session trends. | Gives each score a matched-cohort definition and comparability constraint. | F/P/T do not exist. |
| Cross-session F/P | Initial session-level concept. | Uses only eligible completed sessions and **proportional**, not binary, per-session credit. | No defined completed-session denominator or cross-session metrics. |
| Research claim | Trends were connected to learning-oriented interpretation. | Observational only; do not infer intent, permanent remediation, independent rewriting, or understanding from scanner data alone. | Current UI shows immediate scanner/tracker results, not a validated research measure. |

The rest of this document explains that table sequentially.

---

## Before the scan flow: shared terms and boundaries

The words below are used consistently in every later section. They prevent a type label, a source location, and a long-lived tracked object from being accidentally treated as the same thing.

| Term | Final meaning |
|---|---|
| **Occurrence** | One reported source location for a finding, normally a file and source location. |
| **Finding instance** | A stable, fingerprinted security finding in one contextual scope. It can have one or more occurrences. |
| **Vulnerability type** | The user-facing CWE/rule family, such as SQL Injection. It is an aggregation label, not the tracking identity. |
| **Baseline cohort** | The matched instances or occurrences present when the finding/pattern is first confirmed in an observation session. |
| **Valid observation** | A complete, successful Ariadne analysis result that is safe to use for lifecycle calculations. |
| **Settled observation** | A valid result collected at an agreed stable point: idle, save, manual analysis, or a final checkpoint. |
| **Provisional resolution** | A valid settled observation no longer detects an active finding, but absence is not yet confirmed. |
| **Durable confirmed resolution** | A provisional absence remains absent through the grace requirement and a later eligible checkpoint. |
| **Observation session** | A defined period with a baseline and final valid checkpoint; not an arbitrary live-edit scan. |
| **Eligible session** | A completed session from a finding's first confirmed appearance through its current state or durable resolution. |

The framework measures **what Ariadne observed**. It may report observed lifetime, confirmed absence, residual burden, and recorded recurrence. It must not claim, from scan data alone, that a student intended to hide code, permanently repaired software, independently rewrote a vulnerability, or did/did not understand a security concept.

---

## 1. Whole scanning process

### 1.1 The whole process, step by step

**This is deliberately a two-part process, not one existing implementation.**

- **Steps A–F are the current scanner/extension process verified in the codebase.** They describe what Ariadne does today.
- **Steps G–K are the proposed Finalization Trends layer.** They describe what must be added after lead approval; they are not implemented today.
- **The original recap owns neither runtime process.** It is the initial conceptual proposal that motivated the finalization, not a technical description of the Rust/VS Code event flow.

The distinction matters because the current code already provides fast SAST feedback, while the finalization adds a second, more conservative path for research-quality temporal claims.

#### A. Current code: raw scan and live-feedback path

```text
A. Activation or a tracked workspace/edit event requests analysis.
        ↓
B. The VS Code extension sends an IPC message to the long-running Rust session.
        ↓
C. The Rust engine updates its in-memory workspace and runs its analysis pipeline.
        ↓
D. The engine emits one JSON finding array for that analysis response.
        ↓
E. The extension immediately updates the Active Vulnerabilities panel,
   diagnostics/decorations, and its current tracker views.
        ↓
F. It appends a raw ScanSnapshot and immediately compares the latest
   broad CWE/type group with the previous scan.
```

This is **not** yet the finalized lifecycle. It does not have settled-observation gating, stable finding fingerprints, durable resolution, recurrence state, or F/P/T calculations.

#### B. Finalization: proposed measurement path added after raw findings

```text
G. A raw finding array may update live feedback immediately.
        ↓
H. The Trends layer decides whether the observation is valid and settled.
        ↓
I. It matches eligible findings to stable finding instances.
        ↓
J. It updates lifecycle state: candidate, active, provisional absence,
   or durable resolution, then derives a public status when justified.
        ↓
K. At a completed session checkpoint, it calculates F, P, T and
   cross-session inputs, then persists bounded summaries and raw recurrence data.
```

The finalized layer does not replace rapid diagnostics. It decides only whether a raw result is strong enough to change research-facing history. That is why it comes **after** the raw scan rather than slowing down the scanner itself.

### 1.2 Why there are two paths

| Need | Correct behavior | Why |
|---|---|---|
| Real-time SAST feedback | Use raw engine results immediately for diagnostics and the Active Vulnerabilities panel. | Developers should see current scanner feedback while editing. |
| Research-grade trend data | Use only valid, settled observations after identity matching. | A transient edit state, failed analysis, or moving line must not become a claimed remediation or persistence event. |

Therefore:

```text
Fast diagnostic update ≠ confirmed lifecycle transition
Debounced scan          ≠ automatically settled research observation
```

### 1.3 Current code path in concrete terms

The existing extension starts a long-running `ariadne session` process. It sends JSON messages over standard input and receives one line-delimited JSON finding array per engine analysis response. The Rust session maintains an in-memory workspace snapshot, updates it for relevant events, runs the full detection pipeline, and emits the result.

At a high level, the engine path is:

```text
workspace snapshot
  → Java AST forest and auxiliary configuration data
  → symbol/semantic information
  → call graph and data-flow analysis
  → taint-flow, pattern, and configuration detection
  → filtering, deduplication, and stable ordering
  → flat VulnerabilityMetadata JSON array
```

This is the detection engine's job. The Trends framework does not decide whether SQL Injection, a configuration issue, or another security problem exists. It consumes the engine's findings and assigns cautious temporal meaning to them.

Relevant source anchors are [`documentEvents.ts`](../src/modules/detection/bridge/documentEvents.ts), [`iostream.ts`](../src/modules/detection/bridge/iostream.ts), [`session.rs`](../../ariadne-core/src/cli/session.rs), and [`pipeline.rs`](../../ariadne-core/src/engine/pipeline.rs).

---

## 2. How is a scan triggered?

### 2.1 Current code: events that cause or prepare analysis

The following table is a factual description of the current extension/engine path, not the final framework.

| Event | Current message/action | Does Rust reanalyse? | Important qualification |
|---|---|---:|---|
| Extension activation | The extension starts `ariadne session`; `documentEvents.ts` sends `Init` with the workspace root. | Yes. | The engine builds its initial workspace state and immediately analyses it. |
| Already-open tracked document at activation | `OpenFile` with the editor buffer. | No. | It synchronizes content after the initial `Init` result; it does not force a second scan. |
| Opening a tracked file later | `OpenFile` with current text. | No. | Opening alone does not make a new result. |
| Editing a tracked Java/config file | A debounced `UpdateFile` containing the full current buffer. | Yes. | The scanner automatically analyses after `UpdateFile`. |
| Creating a tracked file | `CreateFile` with empty initial content. | Yes. | The eventual editor content may arrive later, so this must not automatically become a Trends baseline. |
| Deleting a tracked file | `DeleteFile`. | Yes. | Scanner absence after deletion is not automatically remediation. |
| Renaming a tracked file | `RenameFile`. | Yes. | Identity matching must decide whether the finding continued through the move. |
| Closing a tracked document | Any pending update is flushed, then `CloseFile` is sent. | The flush can; close itself does not. | Closing a document is not a completed observation session. |
| Engine `Analyze` IPC message | The Rust session supports this message. | Yes. | The finalization treats a user-triggered manual analysis as a preferred settled checkpoint; the current VS Code event path does not send this message as its ordinary edit flow. |

Tracked documents include Java and selected configuration-related files. The initial engine workspace walk also handles the project snapshot according to its own inclusion/exclusion rules.

### 2.2 The current live-edit debounce

For document edits, the extension uses two 300 ms timers:

```text
Trailing debounce:
  after the last edit, send the newest full buffer after 300 ms.

Max-wait timer:
  while edits keep arriving, force a scan at least every 300 ms.
```

The max-wait behavior matters. Continuous typing can therefore produce scans of temporary code states. The original recap's general intuition—that a debounce reduces noise—is reasonable, but the finalization correctly does not treat the debounce as proof that every result is a stable finished state.

### 2.3 Finalization: when a scan result may affect Trends

The finalization separates a trigger from an **eligible settled observation**. A result can be used for live feedback immediately, but it may change lifecycle, F/P, or a session result only after it is valid and settled.

Preferred settled checkpoints are:

1. A user-triggered manual analysis.
2. A scan after an agreed editor-idle interval longer than the live debounce.
3. A save-triggered scan.
4. A final session checkpoint.

Initial policy values proposed for pilot validation are:

```text
minimum observed duration:          30 seconds
minimum settled confirmations:      2
absence grace period:                5 seconds
```

They are policy defaults, not universal constants. The study should evaluate whether they suppress transient edit behavior without hiding meaningful remediation. The finalization does not permit raw scan frequency to stand in for time persistence.

### 2.4 Why this trigger rule is justified

The trigger tells Ariadne *when to ask the engine to look*. It does not tell Ariadne whether the code state is sufficiently trustworthy to support a research claim. The validity/settled gate prevents the following invalid inference:

```text
one brief absence in a live scan
    → "the student fixed it"
```

Instead, a live result may update diagnostics, while only a later accepted observation may create a provisional or durable lifecycle transition.

---

## 3. What is collected during the scan?

### 3.1 Current code: input sent to the Rust engine

For a live update, the extension sends the entire current in-memory document buffer, not only the individual text change:

```text
path
+ full current document text
```

The Rust session updates the corresponding tracked file in its in-memory workspace and then runs a full analysis. This makes the scan responsive to unsaved editor text once an `UpdateFile` has been sent, but it also explains why intermediate typing states are possible.

### 3.2 Current code: finding data received from the engine

Each flat engine finding carries information used by the UI and current tracker, including:

| Returned information | Current use | Why it is not enough for long-term identity by itself |
|---|---|---|
| Rule ID, CWE/type, severity, OWASP category | Labels, grouping, severity cards. | A type is not one unique code problem. |
| File path, line, optional column | Diagnostics and navigation. | A harmless edit can move lines. |
| Description and optional taint trace | Explanation, hover, panel detail. | It does not prove that two later reports are the same logical finding. |
| Instance name and instance kind when available | Current grouping hint. | It may not identify enclosing code scope or distinguish duplicates reliably. |

Before output, the Rust engine deduplicates findings for a single analysis. That helps keep one result clean. It does not, on its own, solve identity across edits, sessions, refactors, or duplicate expressions.

### 3.3 Finalization: data required for a trustworthy Trends observation

The finalization requires an identity and lifecycle layer in addition to normal finding metadata.

#### A. Stable identity data

Each tracked finding should have two related identifiers:

| Identifier | Role |
|---|---|
| **Logical fingerprint** | Matches the same logical finding through line movement and minor non-security-relevant edits. |
| **Content fingerprint** | Determines whether vulnerable code/context returned materially unchanged after an absence. |

The fingerprint should be derived from available or newly emitted structural information:

```text
rule ID
+ CWE/type
+ instance kind/name
+ enclosing class, method, or source/sink context
+ normalized relevant AST or source expression
+ file path as a secondary signal
```

Line number remains a display/location hint or fallback only. It must not be the primary key because it changes during ordinary editing.

Matching rules are deliberately conservative:

| Match | Final interpretation |
|---|---|
| Same logical fingerprint | Candidate continuation of the same lifecycle. |
| Same logical + same content + same scope | Candidate identical restoration after an absence. |
| Same logical, changed content, same scope | Reappearance/recurrence candidate after modification. |
| Same CWE/rule but different logical fingerprint | Separate/new finding instance. |
| Ambiguous match | Do not claim continuity or resolution; prefer a separate instance decision. |

#### B. Observation quality data

Before a raw result affects Trends, the implementation must know at least:

```text
analysis succeeded and is complete
observation time
whether it is a settled checkpoint
current session identity and checkpoint role
whether the result can be matched to an existing instance
```

The finalization explicitly says that a process failure, invalid/non-JSON output, incomplete workspace initialization, failed analysis, parser/transport failure, unavailable required file, or invalid snapshot must never create a resolution transition.

#### C. Lifecycle data

For every tracked finding instance, the final storage model needs enough data to show why a status was assigned:

```text
logicalFingerprint
contentFingerprint
scopeFingerprint
firstConfirmedAt
lastConfirmedAt
missingSince
provisionalResolutionAt
durableResolutionAt
baselineOccurrenceCount
currentOccurrenceCount
confirmationCount
recurrenceCount
inSessionToggleCount
identicalRestorationCount
```

For privacy, Trends storage should retain hashes or normalized structural identifiers rather than raw code solely for trend tracking. Raw source stays governed by normal workspace/editor analysis rules.

### 3.4 Why the collection requirement is justified

Without stable identity, Ariadne cannot distinguish these cases reliably:

```text
same CWE in a different method      → a separate finding
same finding after line movement    → continuation
same code restored verbatim         → identical restoration flag
same logical issue, changed code    → recurrence candidate after durable resolution
```

Counting a broad CWE/type group cannot make those distinctions. That would turn routine edits into false fixes, false new findings, or false recurrence evidence.

---

## 4. What is stored after the scan?

### 4.1 Current code: every raw result becomes a stored snapshot

Today, each engine finding array is converted into a `ScanSnapshot` and appended to VS Code `workspaceState`. The current snapshot contains roughly:

```text
scan ID
timestamp
vulnerabilities grouped by CWE/type
  severity, rule ID, OWASP category
  instances grouped by instance name or file:line
  occurrences with file, line, column, and optional taint trace
```

The entire `ScanSnapshot[]` history is retained across restarts. `appendSnapshot` reloads the existing array, appends one item, and writes the full array again. This is an actual-code storage history, not a valid final-session history.

### 4.2 Finalization: store session and lifecycle summaries by default

The finalization replaces unbounded raw history with bounded evidence records.

```text
SessionRecord
  sessionId
  startedAt
  endedAt
  baselineCheckpoint
  finalCheckpoint
  per-instance lifecycle summaries
  aggregate F, P, T inputs and results

FindingLifecycleRecord
  logicalFingerprint
  contentFingerprint
  scopeFingerprint
  firstConfirmedAt
  lastConfirmedAt
  missingSince
  provisionalResolutionAt
  durableResolutionAt
  baselineOccurrenceCount
  currentOccurrenceCount
  confirmationCount
  recurrenceCount
  inSessionToggleCount
  identicalRestorationCount
```

Raw snapshots may be kept temporarily for debugging or an approved research sample, but not indefinitely by default.

### 4.3 Session boundaries: what makes a stored session usable

The recap's cross-session formulas only make sense if a session has an operational definition. The finalized proposal is:

```text
Session start:
  first valid settled observation after activation,
  or an explicit Start Session action.

Session end:
  explicit End Session, controlled study checkpoint,
  or normal deactivation with a final valid settled scan.
```

Only completed sessions count in cross-session formulas. If VS Code closes and a final valid settled scan is not available, the session has no valid final checkpoint for cross-session calculation and must not be treated as a completed evidence record.

For reproducible research sessions, an explicit Start/End workflow is preferable to silently equating a VS Code process lifetime with a study session.

### 4.4 Current storage versus finalized storage

| Question | Current code | Finalization | Reason for the change |
|---|---|---|---|
| What is saved after a result? | A raw `ScanSnapshot`, every time the engine emits findings. | A valid settled checkpoint may update bounded session/lifecycle summaries. | Raw results are useful feedback but not automatically evidence. |
| Is there a real session? | No; the history persists across restarts. | Yes; start, final checkpoint, completion state, and eligible-session rule. | Cross-session denominators require known boundaries. |
| Can the history grow forever? | Yes, by default. | No, raw history is temporary/approved; summaries are the primary record. | Preserve relevant evidence without unbounded collection. |
| Is persistence write order a concern? | Yes; high-frequency read-modify-write appends can race. | A serial persistence queue is required in the implementation order and acceptance tests. | The stored lifecycle must not be overwritten or reordered by rapid result handling. |

### 4.5 Why storage changes are necessary

The finalization does **not** propose storing less evidence. It proposes storing the evidence that supports a result: identity, first/last confirmation, absence state, baseline size, session checkpoints, and recurrence/toggle counters. A large array of raw scans alone cannot prove that a particular absent finding was the same one, that the absence was durable, or that a session was complete.

---

## 5. How is a vulnerability classified as Improving, Persisting, Recurring, or Resolved?

### 5.1 Internal lifecycle before public labels

The public card uses only four labels, but the tracker needs internal states to avoid jumping from one scan result directly to a research claim.

```text
first valid settled observation
        ↓
candidate / not yet eligible
        ↓  (minimum duration + confirmations)
active tracked finding
        ↓ absent in a valid settled observation
provisional resolution
        ↓ remains absent through grace + later eligible checkpoint
durable confirmed resolution
        ↓ later reappears with matching logical identity
recurrence event or identical-restoration integrity flag
```

`Candidate / not yet eligible` is internal only. It is omitted from the public Trends classification; it is not a new public status.

### 5.2 Exact public status rules

| Public status | Rule | What it does not mean |
|---|---|---|
| **Persisting** | The finding is active, has met the minimum observed duration and settled-confirmation rule, and is not Improving. A count increase stays Persisting. | It does not mean the student ignored it intentionally or that it existed during unobserved periods. |
| **Improving** | The finding remains active, but its matched open occurrence count is lower than its baseline/comparison cohort at a settled observation. | It does not mean fully resolved; open matched occurrences remain. |
| **Resolved** | The finding has reached durable confirmed resolution after provisional absence, grace, and a later eligible confirmation. | It does not mean permanently fixed or semantically secure in every possible context. |
| **Recurring** | A previously durably resolved finding reappears with the same logical fingerprint, with changed content in the same scope, and reaches the public recurrence threshold. An identical content/scope return is handled as an integrity flag instead. | It does not prove independent rewriting, intent, or lack of understanding. |

### 5.3 Status priority

When more than one fact is true, the UI applies one ordered status:

```text
1. Recurring
2. Resolved
3. Improving
4. Persisting
5. Candidate / not yet eligible: omit from Trends classification
```

This prevents a resolved item from also being displayed as improving, and prevents a mature recurrence history from being hidden by a current count reduction.

### 5.4 Time-based Persisting rule

For an active finding at a settled observation time `t`:

```text
observedAge = t − firstConfirmedAt
```

It is eligible for **Persisting** when:

```text
currently active
AND observedAge >= minimumDuration
AND confirmationCount >= minimumSettledConfirmations
```

With the proposed starting values, that means at least 30 seconds of observed age and at least two settled confirmations. This is stronger than “present in two scans” because scan frequency changes with typing behavior.

`observedAge` is intentionally modest in its claim: it measures the duration from Ariadne's first confirmed observation until the current settled observation. It does not invent knowledge of edits that occurred and were undone between scans.

### 5.5 Improving rule and count increases

Improving is an instance-level matched-count fact. If the baseline has four matched occurrences and two remain in the same coherent cohort, the finding is Improving. If four become five, it remains Persisting rather than gaining a `Regressing` label.

The expanded UI may say:

```text
Open occurrences increased from 3 to 5 in this session.
```

That preserves useful information without changing the approved four-status taxonomy.

### 5.6 Resolution rule: absence is not automatically a fix

When an active finding is absent from a valid settled observation:

```text
missingSince = observation time
state = provisional resolution
```

It becomes **Resolved** only when it remains absent through the grace period and a later eligible checkpoint confirms that absence. If it reappears first, the provisional resolution is invalidated and the active lifecycle resumes.

This is why an individual comment-out, deletion, transient parse state, or one incomplete scan cannot inflate the result as a fix.

### 5.7 Recurrence rule

The tracker stores:

```text
recurrenceCount = number of durable-confirmed-resolved → active transitions
```

The first confirmed reappearance is recorded in research data. To retain the recap's anti-noise intent, the public **Recurring Pattern** status appears only when:

```text
recurrenceCount >= 2
```

In plain terms, the finding must complete two full durable-resolution-then-reappearance cycles. Before that threshold, an active item follows the ordinary Persisting or Improving rule, while the raw recurrence count remains available for research.

### 5.8 How current code classifies today, and why it is replaced

The existing `snapshotAnalyzer.ts` compares only the latest stored snapshot with the immediately previous one, using a broad `cwe_id::type` key:

```text
not in previous snapshot                 → new
current instance count < previous count  → improving
current instance count >= previous count → persisting
seen in any prior snapshot, absent now   → resolved
```

This is useful as a basic UI delta, but it is not the final research framework. It has no duration, settled confirmation, durable-absence state, stable instance identity, recurrence count, or matched baseline. An already absent type can also be counted as resolved again on later scans because the current implementation searches all prior snapshots rather than recording one lifecycle transition.

---

## 6. How are edge cases handled?

This section distinguishes framework rules from claims Ariadne must deliberately avoid. A conservative “do not claim a transition yet” decision is a valid outcome when evidence is incomplete.

| Edge case | Final handling | Why this is justified |
|---|---|---|
| Continuous typing produces interim scans | Update diagnostics/live panel if desired, but do not confirm lifecycle or metrics until a valid settled observation. | The 300 ms max-wait timer can see temporary code states. |
| Engine/process/parser/transport failure or invalid result | No resolution, remediation, or scoring transition. | Absence caused by tool failure is not code remediation. |
| Incomplete initial workspace state or unavailable required file | Do not treat missing result as a resolution. | Ariadne may not have analysed the relevant code. |
| Finding is absent briefly, then returns before durable confirmation | Invalidate provisional resolution and resume its active lifecycle. | A temporary edit or comment-out must not become a fixed finding. |
| Finding stays absent through grace and a later eligible checkpoint | Create one durable confirmed resolution. | The second observation makes the claim materially stronger than a one-scan absence. |
| VS Code closes without a valid final settled scan | Do not use it as a completed cross-session record. | A previous live scan cannot be invented as the session's final state. |
| Same CWE appears in a different method/file | Treat it as a separate instance if logical fingerprints differ. | A type label alone does not establish continuity. |
| Line numbers move after harmless edits | Follow logical/context-aware identity; line number is only a location hint. | Routine editing must not manufacture a fix and a new finding. |
| Identity match is ambiguous | Prefer a separate instance; do not claim continuity or resolution. | Guessing creates fabricated remediation evidence. |
| New finding appears after a baseline | Give it a new baseline/lifecycle; do not let it make the old cohort's `O > B`. | F and P must compare the same matched population. |
| Matched count increases | Keep public status Persisting; show the increase in expanded detail. | The approved taxonomy has no public Regressing status. |
| An active finding is identical after it returns | Record an identical-restoration/toggle integrity flag, not an ordinary learning conclusion. | Exact restoration is a measurement-integrity concern, not proof of intent. |
| A toggle occurs entirely between scans | Do not infer it afterward. | Ariadne can only report observed sequences. |
| A student has only a few sessions | Keep raw recurrence data, but do not interpret lack of a Recurring badge as negative evidence. | The `>= 2` public threshold is mathematically hard to reach with short histories. |
| Rapid engine responses/persistence writes | Use the finalization's required serial persistence queue and test rapid emissions. | High-frequency read-modify-write storage must not overwrite lifecycle evidence. |

### 6.1 Intermittent recurrence and the cold-start limitation

There are two separate ideas here:

```text
Recorded recurrence event:
  one durable-resolution → active transition.

Public Recurring Pattern:
  recurrenceCount >= 2.
```

The public threshold filters a one-off reappearance from becoming a pattern label. It also creates a cold-start limitation: a student with only two or three sessions may be unable to reach two full durable resolution/reappearance cycles, even if reintroduction behavior is genuinely present.

The revised finalization requires both mitigations:

1. **Never threshold-gate research exports.** Store and export raw `recurrenceCount` values (`0`, `1`, `2`, and so on) regardless of the UI badge.
2. **Report opportunity to observe.** A study using Recurring Pattern frequency must report the distribution of eligible sessions per student. For students with fewer than roughly 5–6 eligible sessions, “no Recurring Pattern observed” should be treated as inconclusive, not negative. This is a pilot heuristic to revisit with real session data.

### 6.2 Toggled fix / comment-out / delete-and-repaste

The scanner cannot know why code disappeared. Commenting it out, deleting it to paste it later, and genuinely refactoring it all initially look like scanner absence. The finalized solution is to track an **identical restoration** as an internal measurement-integrity flag, not a fifth public status.

Record the flag when Ariadne observes:

```text
active → absent → active
same logical fingerprint
same content fingerprint
same scope fingerprint
```

This means “identical restoration observed.” It does **not** mean Ariadne knows the student intended to hide code.

At session end, persist:

```text
inSessionToggleCount
identicalRestorationCount
```

Increment only for an observed valid sequence. This closes the blind spot created by storing summaries rather than every raw snapshot, while correctly admitting that an entirely unobserved delete-and-paste sequence cannot be detected after the fact.

For an identical restoration:

- invalidate the earlier provisional resolution;
- do not count the disappearance as a durable remediation event;
- do not give `F_cross` remediation credit;
- keep it as a separate research-quality flag; and
- do not use it as evidence of understanding or lack of understanding.

For a changed-content reappearance with the same logical fingerprint after durable resolution:

- record the recurrence transition;
- apply the normal public threshold for Recurring; and
- still avoid claiming that it was independently written or intentional.

### 6.3 Accidental close, initial scan, and incomplete evidence

The current extension's initial `Init` analysis can happen before already-open unsaved buffers are synchronized. Opening a document sends `OpenFile` but does not itself trigger a new analysis; newly created tracked files are initially sent as empty content. These are current-code realities, not failures of the detector.

The finalization's answer is not to assume that the first result is a valid research baseline. It must pass the valid/settled rule and stable matching. Likewise, closing a file or deactivating VS Code is not proof of a final code state. Only a valid final settled checkpoint makes a session eligible for cross-session calculations.

### 6.4 A note on claims and loopholes

The framework is deliberately unable to answer questions it did not observe. It cannot prove semantic security after a detector no longer reports a finding, detect an edit that happened entirely between scans, or establish the student's reasoning from a recurrence. This is not a missing status; it is a claim boundary that keeps research reporting credible.

---

## 7. How are Fix, Persistence, and Trend calculated?

The original recap calls the metrics **F**, **P**, and **T**. The finalization retains them but makes their meanings precise.

> Important correction: **P is not elapsed-time persistence.** It is a severity-weighted residual burden. Time-based persistence for the public Persisting status comes from `observedAge` plus confirmations in Section 5.

### 7.1 Formula changes from recap — why each one exists

The finalization does not change the formulas merely to make them look more technical. It makes the **population, observation quality, and interpretation** behind each calculation explicit. In several places, the arithmetic is the same only under assumptions that the recap left implicit.

#### A. The central semantic correction: duration persistence cannot be a count ratio

The recap treated P as a persistence-oriented score. The finalization separates two different questions:

```text
How long has the finding stayed observed and unresolved?
  → observedAge = t − firstConfirmedAt
  → plus settled confirmations

How much of the baseline finding remains open, weighted by severity?
  → P = min(1, O / B) × W × 10
```

The reason is mathematical, not cosmetic: P contains no time variable. A ratio of open occurrences cannot measure duration.

```text
Case A: a finding appears in two scans 600 ms apart.
Case B: a finding appears in 400 scans across six hours.

An occurrence ratio can be identical in both cases.
Their observed duration is not identical.
```

The finalized `observedAge` rule makes the public word **Persisting** mean what it says in ordinary language: Ariadne has observed the same active finding for a minimum amount of time, not merely in a particular number of scans. The confirmation condition prevents one long gap plus one fragile observation from being treated as strong evidence.

#### B. F changes from an informal total to a controlled baseline cohort

| Recap form | Final form |
|---|---|
| `F = Fixed / (Fixed + Open) × 10` | `F = (B − O) / B × 10` |

The formulas are algebraically equivalent **only if**:

```text
Fixed + Open = the same matched original baseline B
```

That condition is the important change. The recap's wording could be implemented with a broad “all findings seen” group, while the finalization requires the exact finding instance/cohort used in both the numerator and denominator.

Illustrative failure without the final rule:

```text
Original matched baseline: B = 4
Two of those four are remediated; two original occurrences remain.
Two unrelated new occurrences appear after the baseline.

If an implementation puts all four current open occurrences into the old ratio:
  F = 2 / (2 + 4) × 10 = 3.33

Finalized matched-cohort calculation:
  F = (4 − 2) / 4 × 10 = 5.0
```

The `5.0` says exactly what happened to the original cohort: half was remediated. The two new occurrences must have their own lifecycle and baseline; they must not make the old work look worse or better. This is why stable identity and new-instance separation have to exist before F is calculated.

#### C. P is renamed, bounded, and tied to the same cohort

| Recap form/meaning | Final form/meaning |
|---|---|
| Remaining/first-detected amount, severity weighted; described as persistence. | `P = min(1, O / B) × W × 10`; severity-weighted **residual burden**. |

There are three reasons for the final form:

1. **Correct meaning.** As shown above, P has no time input, so it cannot be the time-persistence measure.
2. **Same population as F.** `O` and `B` must refer to the matched baseline cohort. This lets F and P describe complementary parts of the same object rather than unrelated type-level totals.
3. **A guaranteed scale.** The `min(1, O/B)` cap keeps P within its stated maximum even if faulty grouping temporarily produces `O > B`.

For example, an uncapped Critical calculation with `B = 2` and an incorrectly merged `O = 3` would produce:

```text
(3 / 2) × 1.0 × 10 = 15
```

That violates a 0–10 score. The cap prevents an invalid value, but it is not permission to merge new instances into an old cohort. Correct identity handling still creates a new baseline for genuinely new findings.

The severity weight also explains why P cannot decide a status using one global threshold. A Low finding has a maximum P of `4`, while a Critical finding can reach `10`; a rule such as “P ≥ 7 means persistent” would make persistence impossible for every Low finding regardless of time.

#### D. T keeps its subtraction, but gains a validity condition

| Recap form | Final form |
|---|---|
| `T = F_current − F_previous` | `T = F_current_comparable − F_previous_comparable`; otherwise `N/A`. |

The subtraction itself is not the main change. The finalization adds the word **comparable** because a number is misleading when the two F scores used different baselines, different final checkpoints, or one invalid analysis.

Illustrative failure without the final rule:

```text
Session 1: valid F = 5
Session 2: final analysis fails or has no valid final checkpoint

Treating missing evidence as F = 0 would report T = −5.
```

That would look like deterioration even though Ariadne did not obtain a valid comparison. The final answer must be `N/A`, not `0` and not a fabricated negative trend. Zero is reserved for a valid comparison with no F change.

#### E. Cross-session F/P change from binary session flags to proportional credit

The revised finalization changes more than notation here. A binary “this session had at least one fix” rule loses the amount of incremental remediation.

```text
N = 5 matched baseline instances

One session resolves 1 of 5.
Another session resolves 5 of 5.

Binary credit: both sessions = 1.0
Proportional credit: 1/5 = 0.2 versus 5/5 = 1.0
```

The final formulas are:

```text
RemediationCredit(session) = durable resolutions in the session / N
ResidualCredit(session)    = instances ending Persisting / N

F_cross = average RemediationCredit × 10
P_cross = average ResidualCredit × W × 10
```

This avoids overstating a partial fix as a full-cohort result. It also preserves the separate meaning of duration: cross-session scores measure session prevalence and remediation events, while `observedAge` measures time.

Finally, F-cross accepts only **durable confirmed** resolutions. Otherwise a comment-out, temporary deletion, or failed scan could earn a full remediation credit merely because one session ended with the finding absent.

#### F. There is intentionally no single global cross-session T formula

The finalization retains a sequence of comparable pairwise T values rather than averaging them into one global score. For example:

```text
T_session_2 = +5
T_session_3 = −5
```

An average of zero would conceal both the improvement and later decline. Keeping the sequence preserves the direction of change and avoids inventing a new research question that the recap did not validate.

### 7.2 Within-session baseline and variables

For one unambiguous matched finding instance or coherent matched pattern cohort:

```text
B = baseline occurrence count at first confirmed observation
O = current matched open occurrence count
R = B − O
W = severity weight
```

The severity weights retained from the recap are:

```text
Critical = 1.0
High     = 0.8
Medium   = 0.6
Low      = 0.4
```

The baseline is not “all vulnerabilities Ariadne has ever seen.” It is the same matched cohort that existed when this instance/pattern was first confirmed. A new finding receives its own lifecycle and baseline rather than being added into the old denominator.

### 7.3 F — Fix/remediation score

```text
F = (R / B) × 10
  = ((B − O) / B) × 10
```

| F value | Meaning |
|---:|---|
| `0` | No matched baseline occurrence is absent. |
| `5` | Half of the matched baseline occurrences are absent. |
| `10` | All matched baseline occurrences are absent in the comparable observation. |

F is a matched-baseline detector-absence/remediation measure. It supports partial remediation: reducing four occurrences to two is different from reducing none. It is not proof of permanent security, intention, or learning.

### 7.4 P — severity-weighted residual burden

```text
P = min(1, O / B) × W × 10
```

P answers:

```text
How much of the matched baseline is still open,
after weighting its severity?
```

The `min(1, O / B)` cap preserves the advertised 0–10 scale if a data-quality problem would otherwise make remaining occurrences exceed the baseline. Correct identity handling should still keep genuinely new instances out of the old cohort instead of relying on the cap to hide them.

P's upper bound varies by severity:

| Severity | `W` | Maximum P |
|---|---:|---:|
| Critical | 1.0 | 10 |
| High | 0.8 | 8 |
| Medium | 0.6 | 6 |
| Low | 0.4 | 4 |

Therefore, a single global threshold such as “P ≥ 7 means highly persistent” is invalid. A Low finding can never reach 7. Use the time/lifecycle rule for status; use P for priority, reporting, and comparison.

### 7.5 T — Trend between comparable sessions

```text
T = F_current_session − F_previous_comparable_session
```

| T result | Meaning |
|---|---|
| Positive | The matched-cohort remediation score improved from the previous comparable session. |
| Zero | The measured F did not change. |
| Negative | The measured F declined relative to the previous comparable session. |
| `N/A` | There is no valid comparable baseline/final checkpoint pair. |

`N/A` is not zero. Zero means a valid comparison found no F change; `N/A` means Ariadne does not have enough compatible evidence to compare.

### 7.6 Worked within-session example

```text
Baseline B = 4 occurrences
Current O  = 2 occurrences
R          = 4 − 2 = 2
Severity   = High, so W = 0.8

F = (2 / 4) × 10 = 5.0
P = min(1, 2 / 4) × 0.8 × 10 = 4.0
```

The finding is **Improving** after a settled confirmed count reduction, because matched open occurrences remain but have reduced. It is not Resolved. Its `P = 4.0` reports residual weighted burden; it does not say it has been present for four units of time.

### 7.7 Why these formulas are justified

The recap's original `Fixed / (Fixed + Open)` form is algebraically compatible with the finalized F formula only if fixed and open refer to the exact same matched baseline population. The finalization makes that missing condition explicit:

```text
same identity + same matched cohort + comparable checkpoint
```

Without that condition, unrelated new findings or a moved line can corrupt the numerator or denominator and make a score look mathematically precise while measuring different code problems.

---

## 8. How are cross-session Fix, Persistence, and Trend calculated?

### 8.1 First define the eligible-session denominator

Sessions before a finding existed must not make it look less persistent. The final denominator is:

```text
eligible sessions = completed sessions from first confirmed appearance
                    through current state or durable resolution
```

Only eligible completed sessions enter the formula. In particular, do not use arbitrary stored scans, sessions before the finding was first detected, or a session without a final valid settled checkpoint.

### 8.2 Cross-session F: proportional durable-remediation credit

For a vulnerability type with `N` matched baseline instances:

```text
RemediationCredit(session) =
  instances of this type reaching durable confirmed resolution
  in this session / N

F_cross =
  (Σ RemediationCredit(session) / eligible completed sessions) × 10
```

Only an instance that reaches **durable confirmed resolution** in that session contributes. A one-scan disappearance, a provisional absence, or an identical restoration does not receive remediation credit.

### 8.3 Cross-session P: proportional Persisting residual credit

```text
ResidualCredit(session) =
  instances of this type ending the session in a Persisting state
  / N

P_cross =
  (Σ ResidualCredit(session) / eligible completed sessions) × W × 10
```

`P_cross` is a session-prevalence measure: it says how much of the matched type-level cohort ends eligible sessions in the Persisting state, adjusted for severity. It is not a wall-clock duration measure. A five-minute and a five-hour session each contribute one session; observed duration remains a separate lifecycle fact.

### 8.4 Why proportional credit is required

The revised finalization explicitly replaces an earlier binary question—“did this session contain any fix?”—with proportional credit. Binary scoring would treat these materially different sessions as identical:

```text
1 of 5 matched instances durably resolved
5 of 5 matched instances durably resolved
```

Proportional credit preserves the purpose of the metric while respecting incremental remediation.

```text
Example: N = 5 baseline instances across 4 eligible sessions

Session 1: 0 of 5 durably resolved → 0.0
Session 2: 1 of 5 durably resolved → 0.2
Session 3: 3 of 5 durably resolved → 0.6
Session 4: 5 of 5 durably resolved → 1.0

F_cross = ((0.0 + 0.2 + 0.6 + 1.0) / 4) × 10 = 4.5
```

Under the old binary form, Sessions 2–4 would each count as `1.0`, producing `7.5`. That would overstate the amount of the cohort remediated during partial-fix sessions.

### 8.5 What happens to cross-session T?

The finalization intentionally does **not** define a single global `T_cross` score.

```text
T already compares two comparable completed sessions:
T = F_current_session − F_previous_comparable_session
```

For a longer study, retain the sequence:

```text
T_session_2, T_session_3, T_session_4, ...
```

Do not invent one global cross-session T without a separately approved research question and denominator. A single aggregate could hide alternating improvement and decline.

### 8.6 Interpretation limits

| Metric | What it can say | What it cannot say alone |
|---|---|---|
| `F_cross` | The average proportion of matched instances achieving durable resolution per eligible session. | How long a finding remained present, or whether a student learned. |
| `P_cross` | The average proportion of matched instances ending eligible sessions Persisting, severity weighted. | Wall-clock persistence or intent. |
| T sequence | How F changed from one comparable completed session to the next. | One final overall learning score. |

---

## 9. Difference from the initial implementation in the original recap

This is the detailed comparison that should guide lead review. “Original recap” means the meeting framework, not the current source code. “Finalization” means the revised supplied handoff that supersedes earlier drafts for this document.

| Topic | Original recap | Finalization | Why the finalization is more defensible |
|---|---|---|---|
| Research aim | Add a temporal view of persistence and improvement beyond severity cards. | Retains that aim and restricts claims to observed remediation behavior. | It connects every reported claim to a concrete scanner-observable event. |
| Primary unit | Often discusses type-level patterns with instances underneath. | Finding instance first; type grouping only for presentation. | Two findings of the same CWE can have different histories. |
| Identity | Recognizes Scope+Offset-style matching and line movement as a concern. | Logical/content/scope fingerprints and a conservative matching policy. | The implementation needs a testable identity rule, not just a design idea. |
| Role of line number | A source location is part of the report. | Location hint/fallback only; never primary identity. | Lines move under ordinary edits. |
| Debounce | Assumes 300–500 ms debounce filters to stable code. | Treats live scan timing as insufficient; requires valid settled observations. | Actual current code also has a max-wait timer during continuous typing. |
| Valid scan | Focuses on scan/session outputs. | Defines valid analysis and excludes process, parser, transport, initialization, and missing-file failures from transitions. | Tool failure must never look like a fix. |
| Persisting | P was described as persistence-oriented and pattern logic was scan/session based. | Persisting is observed age + confirmations while active. | Duration must contain a time dimension, not only a count ratio. |
| Improving | A reduction in open instances indicates improvement. | Requires a lower matched open count in a stable baseline cohort at a settled observation. | It prevents unrelated findings from changing the metric. |
| Public statuses | Earlier concepts included broad score combinations and extra labels such as Mixed/New/Regressing. | Exactly Persisting, Improving, Resolved, Recurring. | It preserves the agreed status set and removes undefined threshold classifications. |
| Count increase | Could imply worsening/mixed interpretation. | Still Persisting; expanded text may report the increase. | Keeps information without adding a new public label. |
| Resolution | Session-end absence could appear fixed. | Provisional absence + grace + later eligible confirmation. | One absence can be transient or a scan-coverage problem. |
| Recurrence | “Alternates at least twice” was conceptually useful but ambiguous. | Counts durable-resolved-to-active transitions; public Recurring at `recurrenceCount >= 2`. | The event can be implemented and tested unambiguously. |
| Cold start | Not operationalized. | Export raw count even below UI threshold; report eligible-session distribution and treat short histories as inconclusive. | Public anti-noise filtering must not silently erase research signal. |
| Toggled fix | Recurrence did not cleanly separate restored identical code. | Identical restoration flag + in-session counters; no durable-fix credit. | It protects measurement integrity without asserting intent. |
| F | `Fixed / (Fixed + Open) × 10`. | `(B − O) / B × 10` for the same matched baseline. | The cohort condition that makes the ratio meaningful becomes explicit. |
| P | Remaining/initial amount, severity weighted, described as persistence. | `min(1, O/B) × W × 10`, defined as residual burden. | Adds a cap, clarifies meaning, and separates it from time persistence. |
| T | Current F minus previous F. | Current F minus previous **comparable** session F; otherwise `N/A`. | A changed or invalid context is not evidence of zero change. |
| Cross-session F/P | Session-level concepts, initially vulnerable to binary “any fix” counting. | Eligible completed-session denominator plus proportional remediation/residual credits. | Partial remediation receives proportionate evidence. |
| Cross-session T | Could be treated as a future aggregate. | No global T-cross formula; retain the sequence of pairwise T values. | A global aggregate can conceal alternating behavior. |
| Storage | Emphasizes final session state rather than every raw scan. | Stores session/lifecycle summaries with the fields needed to justify the result; raw scans are temporary/approved. | Bounded data still needs identity, baseline, confirmation, and final-checkpoint evidence. |
| Learning/intent claim | Trends could be read as evidence of awareness or understanding. | Recurrence and fixes are observational signals; qualitative evidence is needed for learning or causality claims. | Scanner output cannot establish motives or comprehension. |
| EWMA | Considered as an alternative persistence idea. | Deliberately excluded. | It adds a scan-frequency-sensitive score without improving the four intended statuses. |

### 9.1 What the finalization intentionally retains from the recap

- The four intended public statuses: Persisting, Improving, Resolved, and Recurring.
- Severity weights: Critical `1.0`, High `0.8`, Medium `0.6`, Low `0.4`.
- F, P, and T as distinct analytical values.
- Cross-session F and P concepts.
- A Trends view separate from current severity cards.
- Instance details grouped under vulnerability types for readability.
- Context-aware matching as a foundation.
- Session-level analysis and qualitative follow-up for stronger research claims.

### 9.2 What the finalization deliberately does not carry forward

- Public `Mixed`, `New`, and `Regressing` statuses.
- Classification through undefined “high” or “low” F/P thresholds.
- Raw scan count as evidence of persistence.
- The assumption that debounce alone makes every scan stable.
- One absence as a confirmed fix.
- A composite health score such as `H = (F + T) − P`.
- An optional recurrence penalty that changes F-cross without a separately justified question.
- Direct Deep Fix/Surface Fix-style claims as proof of learning.
- EWMA as an additional metric.

### 9.3 One wording clarification for the team

The recap sometimes uses “current implementation” to describe its proposed formulas. That phrase should not be used for the actual extension source. The correct hierarchy for planning is:

```text
Current extension/core source
  → what Ariadne does today

Original recap
  → initial research direction

Revised finalization
  → proposed implementation and research rules

This document
  → organized explanation and code-aware handoff
```

### 9.4 Why the other recap-to-finalization changes are necessary

The same principle behind the formula changes applies everywhere: a trend claim is only defensible if Ariadne has the specific evidence needed for that claim. The finalization turns the recap's right ideas into operational rules.

| Change from recap to finalization | Concrete problem left open by the recap | Final safeguard | Why the safeguard is necessary |
|---|---|---|---|
| Type-level discussion becomes instance-level tracking | Two SQL Injection findings can share a CWE but live in different methods and have different outcomes. | Fingerprint each finding instance, then group instances by type only in the UI. | A type-level count cannot say which exact code problem improved or returned. |
| Scope+Offset idea becomes explicit logical/content/scope matching | “Use a fingerprint” does not tell implementation when a moved line is the same finding, when restored code is identical, or when to stop matching. | Defined match outcomes and conservative separate-instance handling for ambiguity. | The tracker must not guess continuity, because a guessed match fabricates a fix or recurrence. |
| Debounce assumption becomes valid-settled observation rule | A debounce reduces calls but does not prove a finished code state; the actual max-wait timer can scan while typing continues. | Live results remain UI feedback; only valid settled observations can change lifecycle/metrics. | Research history must not be driven by mid-edit code, incomplete initialization, or tool failure. |
| One absence becomes provisional then durable resolution | Commented-out/deleted code, a brief edit, a scanner failure, and a real fix all initially look like absence. | Absence grace plus a later eligible checkpoint; invalid analyses cannot resolve findings. | It prevents a temporary or failed observation from receiving remediation credit. |
| “Alternates at least twice” becomes an event counter | The recap phrase does not state exactly what counts as an alternation or whether a first reappearance is retained. | Count durable-resolved-to-active transitions; show public Recurring only at `recurrenceCount >= 2`. | A state transition is reproducible in code and tests, while the threshold still avoids a one-off pattern badge. |
| Recurrence badge becomes separate from research export | A strict UI threshold can erase early recurrence evidence from a short student history. | Export raw counts and report eligible-session distribution. | No badge is not proof of no recurrence opportunity, especially with two to three sessions. |
| Toggled return becomes an integrity flag | Restored identical code can look like an ordinary recurrence or a genuine fix/re-fix cycle. | Logical + content + scope match; toggle counters; no F-cross credit. | It protects the measurement without asserting a student's motive. |
| Arbitrary stored scans become completed sessions | A history array does not establish when a study period began, ended, or had a valid final state. | Explicit session/checkpoint rules; completed eligible-session denominator only. | Cross-session metrics otherwise divide by incomparable or nonexistent observation periods. |
| Scores become observational claims, not learning claims | A disappearance or recurrence does not reveal why it happened. | Explicit claim boundary and qualitative follow-up for interpretation. | This keeps research conclusions proportional to the evidence actually collected. |
| EWMA/composite-score ideas are excluded | Extra scores can appear rigorous while reintroducing scan-frequency sensitivity or hiding components. | Use time + confirmation for Persisting and retain F, P, T as separate values. | Each retained value has a clear question and interpretation; a composite would need a new, separately justified research question. |

In short: the recap establishes *what the team wants to observe*. The finalization establishes *what Ariadne must observe before it is allowed to say it observed it*.

---

## 10. Current implementation statements and code map

This section preserves the current-code facts separately, so they cannot be mistaken for already-finished framework behavior.

| Current implementation area | Verified behavior | Final-framework gap |
|---|---|---|
| Extension activation | Starts `ariadne session`; sends `Init` with workspace root. | Initial raw scan needs valid/settled treatment before it becomes a research baseline. |
| Edit transport | Sends a full-document `UpdateFile`, not a small delta. | Live scan still needs a settled-observation gate. |
| Engine response | Emits a flat JSON findings array for each analysis response. | Result needs valid/session/lifecycle metadata before Trends uses it. |
| UI reaction | Active panel and diagnostics update from each result. | This fast path should remain separate from conservative measurement. |
| Current tracker storage | Converts every result to a `ScanSnapshot` and appends it in `workspaceState`. | Replace primary raw-history model with session/lifecycle summaries and serialized writes. |
| Current tracking identity | `cwe_id::type`; within snapshot, `instance_name` or `file:line`. | Replace with logical/content/scope-aware finding-instance identity. |
| Current statuses | `new`, immediate improving, immediate persisting, immediate resolved. | Replace with candidate/active/provisional/durable lifecycle and four public statuses. |
| Current resolved count | Any type seen in history but absent now is counted resolved. | Record one durable transition only after grace and later confirmation. |
| Current metrics | Basic counts and notifications; no F/P/T, recurrence, toggle, or cross-session score. | Implement only after identity, sessions, and lifecycle state are reliable. |
| Current session meaning | Snapshot history persists across VS Code restarts; no real final checkpoint. | Add operational sessions and count completed eligible sessions only. |

### 10.1 Important current-code caveats to preserve in implementation planning

1. **Current `persistingPatterns` is scan-to-scan, not time-based.** It is based on the latest/previous result and a broad type key.
2. **Current `resolvedThisSession` is not a one-time durable event.** An absent type seen earlier can be reported resolved again on later scans.
3. **Current storage is asynchronous read-modify-write.** The finalization correctly requires serialized persistence and a rapid-emission acceptance test.
4. **Current engine payload does not yet provide all context needed for the specified fingerprints.** The engine/API must be extended, or the extension must safely derive an equivalent from available structured data.
5. **Current severity cards and trend grouping do not use the same unit consistently.** The final rule is instance-level tracking and type-level UI grouping.
6. **The first raw scan can precede unsaved editor-buffer synchronization.** Do not turn it automatically into a baseline.
7. **Open and create behavior can temporarily produce incomplete content views.** A settled valid checkpoint is the correct boundary before Trends claims a transition.

### 10.2 Code anchors

- [`documentEvents.ts`](../src/modules/detection/bridge/documentEvents.ts) — `Init`, tracked-file events, full-buffer updates, dual debounce timers, and close behavior.
- [`iostream.ts`](../src/modules/detection/bridge/iostream.ts) — Rust process and line-delimited JSON findings callback.
- [`session.rs`](../../ariadne-core/src/cli/session.rs) — persistent Rust session, message handling, and analysis emission.
- [`pipeline.rs`](../../ariadne-core/src/engine/pipeline.rs) — full detection pipeline entry point.
- [`convert.ts`](../src/modules/detection/bridge/convert.ts) — current flat finding conversion and grouping into snapshots.
- [`snapshotAnalyzer.ts`](../src/modules/tracker/analysis/snapshotAnalyzer.ts) — current immediate-diff tracker logic.
- [`sessionStore.ts`](../src/modules/tracker/storage/sessionStore.ts) — current persisted raw snapshot history.
- [`extension.ts`](../src/extension.ts) — current fan-out to panel, storage, session metrics, notifications, and diagnostics.

---

## 11. Implementation order, safeguards, and lead-review decisions

The order matters. F/P/T and recurrence are misleading if Ariadne does not first know whether it is looking at the same finding and a valid checkpoint.

| Order | Implement | Why it must happen before the next step |
|---:|---|---|
| 1 | Stable logical/content/scope identity. | A lifecycle cannot be correct if same/different findings cannot be distinguished. |
| 2 | Real session boundaries and a serial persistence queue. | Cross-session scores need known endpoints and ordered records. |
| 3 | Live-versus-settled observation routing and valid-analysis checks. | Diagnostics stay responsive while trend data remains conservative. |
| 4 | Finding lifecycle records: candidate, confirmation, provisional/durable resolution, recurrence, and toggle fields. | Public statuses require a state machine, not a single diff. |
| 5 | Within-session F/P/T and proportional cross-session F/P. | A baseline and matched cohort must already exist. |
| 6 | Identical-restoration tracking and raw recurrence research export. | They depend on lifecycle transitions and must not contaminate remediation credit. |
| 7 | Trends UI/notifications using only four public statuses and instance counts. | The UI should expose completed evidence, not old scan-to-scan labels. |
| 8 | Replay histories, acceptance tests, and pilot threshold review. | The proposed 30 s / 2 confirmations / 5 s values must be evaluated on observed data. |

### 11.1 Minimum acceptance tests from the finalization

Before research reporting, the implementation should demonstrate at least these outcomes:

| Scenario | Expected result |
|---|---|
| Same finding moves after line insertion | Same logical lifecycle, not a false resolved/new pair. |
| Same instance name in different files/methods | Separate identities. |
| Core process, parse, or transport failure | No resolution or remediation event. |
| Continuous typing creates interim scans | Interim scans do not confirm lifecycle transitions. |
| Brief absence then return within grace | No Resolved status. |
| Absence through grace and a later checkpoint | One durable Resolved transition. |
| Baseline count falls while instances remain | Improving plus correct F/P. |
| Count increases | Persisting; expanded detail may report increase; no fifth status. |
| New finding after baseline | Separate lifecycle/baseline; no ratio corruption. |
| Exact code disappears and returns in a session | Toggle counter increments; no durable fix credit. |
| Changed-content reappearance after durable resolution | Recurrence event recorded. |
| Identical return after provisional resolution | Provisional fix invalidated; no `F_cross` credit. |
| First recurrence event only | Stored, but no public Recurring Pattern badge yet. |
| Sessions before first detection | Excluded from cross-session denominator. |
| Two same-type instances have different histories | Instance statuses remain distinct; UI groups by type correctly. |
| Rapid result emissions | Ordered persistence without overwritten snapshots/summaries. |
| Partial remediation: 1 of 5 instances resolved | Proportional `RemediationCredit = 1/5`, not flat `1.0`. |
| All five versus one instance resolved | All-resolved case produces strictly higher `F_cross` with equal session counts. |
| Fewer than roughly 5–6 eligible sessions | UI Recurring badge may be absent, while raw recurrence count remains in export. |
| Research recurrence export | Returns raw per-instance `recurrenceCount`, not only badge-qualified results. |

### 11.2 Lead-review checklist

Before implementation begins, the lead should approve or amend:

- [ ] The four public statuses and exclusion of `new`, `mixed`, and `regressing` from the Trends card.
- [ ] Instance-level tracking and the required fingerprint fields.
- [ ] The definitions of valid and settled observations.
- [ ] Starting values of 30 seconds, two settled confirmations, and five seconds of absence grace.
- [ ] The operational session definition and valid final checkpoint.
- [ ] F/P/T meanings and severity weights.
- [ ] The eligible-session denominator and proportional cross-session F/P credit.
- [ ] Durable confirmation before a finding receives F-cross remediation credit.
- [ ] The two-reappearance public Recurring threshold, raw recurrence export, and cold-start reporting caveat.
- [ ] The identical-restoration integrity flag and its exclusion from durable-fix credit.
- [ ] The claim boundary: scanner trends are observational and require qualitative evidence for learning/intent claims.

### 11.3 Final implementation position

> Ariadne should track stable, context-aware finding instances across valid settled observations and completed sessions. It should report only Persisting, Improving, Resolved, and Recurring in the Trends UI; aggregate instances by vulnerability type for readability; and determine Persisting from observed duration and confirmations rather than scan count. F measures matched-baseline remediation, P measures severity-weighted residual burden, and T compares comparable completed-session F scores. Cross-session F and P use proportional per-session credit so partial remediation is not overstated. Resolution is provisional until later absence confirms it. Identical restoration is a measurement-integrity flag, not a student-behavior classification. The UI threshold for Recurring must never suppress raw recurrence data in research exports. Every result remains an observational signal, not proof of intent, permanent security, or secure-coding understanding.
