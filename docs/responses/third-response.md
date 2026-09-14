Yes—your lead’s concern identifies a real mismatch: one expanding score is trying to answer both “how healthy is this category now?” and “did the student improve this session?” Those should not be forced into the same `T`.

Keep the rest of the document unchanged; revise only these parts.

## 2. Additional condition: prevent active findings from being neglected

Do not add a fifth Trends status. Add an **attention rule** and a **coverage rule** instead.

```text
An active FLC must be represented in one of two places:

1. A visible Trends result; or
2. The Active Vulnerabilities panel plus an explicit “not shown by Trends filters” notice.
```

Suggested alert condition:

```text
unaddressedAlertEligible =
  currently detected
  AND at least 2 settled detections
  AND observed for at least 30 seconds
  AND no durable resolution
  AND (
    it was filtered out by P >= 6 / Top 5 limits
    OR it remained open through 2 completed sessions
  )
```

Example non-status notification:

> SQL Injection still has 1 active instance. It is not in the displayed Trends rankings. Review Active Vulnerabilities.

This is an alert/notification, not a new public status. It should:

- link to the left Active Vulnerabilities panel;
- fire once per vulnerability key per session, with cooldown;
- reset when the finding is durably resolved;
- be based only on valid settled measurements.

The right panel can also show a neutral coverage footer:

```text
Showing 5 ranked vulnerability types.
2 active findings are outside these filters.
```

That prevents the `P >= 6` and Top 5 rules from making lower-scoring but still-open vulnerabilities disappear from the student’s awareness.

## 3. Yes: tracked-file changes and saves can both scan

Your understanding is correct, with one important refinement:

| Event | Scan purpose | Left panel | Right/Trends panel |
|---|---|---:|---:|
| Tracked-file change | Real-time feedback | Yes | No |
| Tracked-file save | Measurement checkpoint | Yes, immediately | Only after valid + 2-second settled gate |

```text
Tracked-file change
  -> 300 ms debounce/live scan
  -> raw VulnerabilityMetadata[]
  -> Active Vulnerabilities + diagnostics

Tracked-file save
  -> full-workspace measurement scan
  -> matching request ID/revision + success/complete = valid
  -> no tracked change for 2 seconds = settled
  -> Active Vulnerabilities + diagnostics + FLCs + SessionRecord + Trends
```

So both may scan, but they have different permissions.

The live result has enough scanner data for the left panel. The save result needs extra protocol metadata—request ID, revision, reason, success, and complete—before it may update the right panel.

It is somewhat more complex, but it is the right separation:

- live scans keep Ariadne responsive;
- save scans keep research/trend evidence defensible;
- a temporary edit cannot become a false fix or false recurrence.

To avoid duplicate work in version one:

```text
On save:
  1. flush/cancel that file’s pending debounce update;
  2. send one explicit save-measurement request;
  3. do not reuse an earlier live result unless it is proven to be
     the same full-workspace revision and has all measurement metadata.
```

## 4–5. Fixing the sudden `T` swing

The lead is right: under the previous expanding formula, this is awkward:

```text
S2: 4 of 5 fixed
F = 8.00
T = +8.00

S3: fifth original fixed, but 1 new instance appears
F = 5/6 × 10 = 8.33
T = +0.33
```

Mathematically, `+0.33` is correct for net category health. But it is a poor answer to “how much did the student improve this session?” The student did fix E; one new FLC should not make that work look almost meaningless.

### Recommended revision: split category health from pairwise progress

Keep expanding membership for current category health:

```text
F_category = durably resolved / all ever-observed FLCs
P_category = unresolved / all ever-observed FLCs × severity weight
```

But calculate `T` only over the **previous completed session’s known FLCs**.

This is not a permanent baseline or a baseline-group model. It is a temporary, pairwise comparison set used only for one `T` calculation.

```text
comparisonSet(Sn) =
  FLC IDs known in the previous completed session, Sn-1

F_compare =
  durable resolutions within comparisonSet / comparisonSet size × 10

T_live =
  F_compare(current latest settled state)
  − F_compare(previous completed session)

T_final =
  same calculation at the final checkpoint
```

### Revised Scenario 2 → Scenario 3

At S2 final:

```text
Known comparison set from S1: A, B, C, D, E

A–D resolved; E remains open

F_compare(S2) = 4/5 × 10 = 8.00
T_final(S2) = 8.00 − 0.00 = +8.00

F_category(S2) = 8.00
P_category(S2) = 1.60
```

At S3:

```text
E is durably resolved.
F is a later unmatched FLC.

T comparison set remains A–E.
F is excluded from this one pairwise T calculation.

F_compare(S3) = 5/5 × 10 = 10.00
T_live(S3) = 10.00 − 8.00 = +2.00
```

Meanwhile, the expanding category state remains honest:

```text
All observed FLCs: A–F

F_category(S3) = 5/6 × 10 = 8.33
P_category(S3) = 1/6 × 8 = 1.33

Unmatched active instances since S2: 1 (F)
```

The UI can therefore say:

```text
Improving Trends · Top 5 by current T

SQL Injection                         1 active   T +2.00
Attention: 1 unmatched active instance since the previous session
```

This says both true things:

- E was successfully fixed this session: `T +2.00`.
- F is a current unresolved instance and must not be ignored.

### Why this solves the lead’s concern

| Value | Meaning |
|---|---|
| `F_category` / `P_category` | Current overall health of SQL Injection, including later instances. |
| `T` | Improvement or worsening of work already known in the previous completed session. |
| `unmatchedActiveCount` | Current active instances introduced since the previous completed session. |

A new FLC no longer causes `T` to fall from `+8.00` to `+0.33`. It affects `F_category`, `P_category`, the Active Vulnerabilities panel, and the attention alert instead.

A true recurrence of an already-known FLC still makes `T` negative. That is meaningful:

```text
Previous session comparison set: A–G
A was previously resolved, then returns.

F_compare(previous) = 5/7 × 10 = 7.14
F_compare(current)  = 4/7 × 10 = 5.71

T = -1.43
```

So negative `T` becomes a signal of worsening known work or recurrence—not simply a penalty because a newly discovered instance expanded the denominator.

This revised definition needs explicit lead approval because `T` would now mean:

> Pairwise progress on the previous session’s known FLCs, not net category-health change.