Keep the rest of `initial-response.md` unchanged. These are the targeted replacements/additions for the lead’s comments.

## 1. Replace the current `T` paragraph

Replace:

> `T` is always `N/A` during an active session.

With:

```text
T_final is N/A while a session is active, because the final checkpoint does not exist yet.

From Session 2 onward, Ariadne may display a provisional live value:

T_live = F_latestSettled(current session)
       − F_final(previous comparable completed session)

Session 1:
  T_live = N/A
  T_final = N/A
  because there is no prior completed session.

Session 2+:
  T_live is available after each valid settled measurement.
  It is used for the Improving-ranking display only.
  It becomes official T_final only when the session receives a valid final
  checkpoint or safe fallback.
```

Example:

```text
S1 final F = 0.00

S2, first settled result: F = 0.00
T_live = 0.00 − 0.00 = 0.00

S2, after four durable fixes: F = 8.00
T_live = 8.00 − 0.00 = +8.00

S2 final:
T_final = +8.00
```

So the lead is right: later active sessions can hold a provisional trend value. It must be visibly labelled as current/provisional, not stored as the session’s final `T`.

## 2. Replace the panel rule section

The lifecycle still decides whether a result is trustworthy. The formulas decide what is displayed and in what order.

```text
Live result
  -> Active Vulnerabilities and diagnostics only

Valid settled measurement
  -> update FLCs and F/P/T_live

Panel display
  -> rank/filter the computed values
```

Use this panel behavior:

```text
Persisting Patterns
  eligibility:
    - finding is still present
    - at least two settled detections
    - at least 30 seconds observed
    - P >= 6.00
  ordering:
    - highest P first
  display:
    - show all qualifying vulnerability types

Improving Trends
  eligibility:
    - T_live > 0
    - previous comparable completed session exists
  ordering:
    - highest T_live first
  display:
    - top five vulnerability types only

Resolved This Session
  eligibility:
    - durable resolution happened in this session

Recurring Patterns
  eligibility:
    - an old durably resolved FLC returned by a valid identity match
    - recurrence threshold must be explicitly confirmed by the lead
```

The hard limits are display filters, not new lifecycle statuses.

Use counts instead of A–E location lists. This replaces every earlier “expanded SQL lists A–E” sentence:

```text
▼ Persisting Patterns · P ≥ 6.00                 7

  SQL Injection                                  5   P 8.00
  Hardcoded Credentials                          2   P 6.40

▼ Improving Trends · Top 5 by current T          4

  SQL Injection                                  1   T +8.00
  XSS                                            3   T +4.00
```

The number beside each vulnerability type is its instance count; do not expand into file/line lists. If a hard limit hides results, say so:

```text
Showing 5 of 8 improving vulnerability types.
```

One important consequence: with expanding membership, `P >= 6` can hide a genuinely persistent individual finding after many historical resolutions. That is a filter choice, not evidence that the finding stopped persisting.

For example, at `B=7, R=5, O=2`:

```text
P = 8 × 2/7 = 2.29
```

The two remaining open findings are still in Active Vulnerabilities, but SQL Injection would not appear in Persisting Patterns under the lead’s `P >= 6` display rule.

## 3. Add this save-trigger versus live-debounce decision

Use a hybrid model.

| Purpose | Trigger | Why |
|---|---|---|
| Active Vulnerabilities / diagnostics | Existing real-time 300 ms debounce | Fast feedback while the student writes code. |
| FLCs, SessionRecords, F/P/T, Trends panel | Tracked-file save, then valid + 2-second settled gate | Records deliberate, stable checkpoints rather than temporary edit states. |

The current 300 ms logic is not a stability guarantee: it includes a max-wait scan during continuous typing. It can observe temporary deletions, half-written code, or a briefly reintroduced vulnerability.

Recommended flow:

```text
Tracked-file change
  -> increment workspace revision
  -> 300 ms live scan
  -> update Active Vulnerabilities only

Tracked-file save
  -> flush any pending buffer update
  -> request full-workspace measurement with request ID + revision
  -> matching successful complete result = valid
  -> wait two seconds
  -> if no tracked file changed = settled
  -> update FLCs, SessionRecord, F/P/T_live, and Trends panel
```

Why not use live debounce for Trends?

- It would give faster metric changes.
- But it would falsely count temporary edits as fixes, improvements, new findings, or recurrence.
- It would make the capstone’s measurement data much less defensible.

So: real-time for feedback; save plus settlement for research/trends evidence.

## 4. Replace Scenario 2 and Scenario 3 with this partial-fix path

This addresses the missing “four of five fixed, then the last one is fixed, then a new instance appears” case.

Assume five original High SQL FLCs: A–E. `W = 0.8`.

### Revised Scenario 2 — Four of five are fixed

| Scan | FLC result | B / R / O | F | P | T |
|---|---|---:|---:|---:|---:|
| S2-M1 | A–E are old matched open FLCs. | 5 / 0 / 5 | 0.00 | 8.00 | `T_live=0.00` |
| S2-M2 | A–D absent once only; provisional. E remains open. | 5 / 0 / 5 | 0.00 | 8.00 | `T_live=0.00` |
| S2-M3 | A–D absent again at least five seconds later; durable. E remains open. | 5 / 4 / 1 | 8.00 | 1.60 | `T_live=+8.00` |
| S2 final | Same state. | 5 / 4 / 1 | 8.00 | 1.60 | `T_final=+8.00` |

Panel:

```text
Improving Trends · Top 5 by current T             1
  SQL Injection                                   1   T +8.00

Resolved This Session                             4
  SQL Injection                                   4
```

The Improving count is the one currently open SQL instance, E. The Resolved count is A–D. No instance is double-counted.

### Revised Scenario 3 — E is fixed, then F appears

| Scan | FLC result | Fixed membership | Expanding membership | Separate groups |
|---|---|---|---|---|
| S3-M1 | E absent once; provisional only. | `F=8.00 P=1.60 T_live=0.00` | Same | C1 same |
| S3-M2 | E absent again after five seconds; E becomes durable. | `B=5 R=5 O=0 F=10.00 P=0.00 T_live=+2.00` | Same | C1 same |
| S3-M3 | F appears; unmatched, so create FLC-F. | Original A–E remain `F=10.00 P=0.00 T_live=+2.00`; F is separately reported. | `B=6 R=5 O=1 F=8.33 P=1.33 T_live=+0.33` | C1: `F=10.00 P=0.00 T_live=+2.00`; C2(F): `F=0.00 P=8.00 T=N/A` |

Why `T_live=+0.33` under expanding membership?

```text
S2 final F = 4/5 × 10 = 8.00

S3 after F appears:
F = 5/6 × 10 = 8.33

T_live = 8.33 − 8.00 = +0.33
```

The category is still net-improving versus S2: five of six observed FLCs are now durably resolved, compared with four of five at S2’s end.

But it is only a small improvement, and the panel should show that honestly:

```text
Improving Trends · Top 5 by current T             1
  SQL Injection                                   1   T +0.33
```

If the lead does not want a newly introduced open FLC to appear beneath an improving net score, then expanding membership is not sufficient by itself. That would require either a separate “current additions” measure or returning to a fixed-set model.

## 5. Clarify the negative-`T` concern

With expanding membership, negative `T` is valid and should not be clamped.

After Scenario 3, suppose F remains open and G appears:

```text
S3 final:
B=6, R=5, F=8.33

S4:
B=7, R=5, O=2
F=5/7 × 10 = 7.14
P=2/7 × 8 = 2.29

T_live = 7.14 − 8.33 = -1.19
```

That does not erase the earlier +8.00 or +0.33. Those completed-session values stay historically true. It means the category’s net health worsened because another unresolved instance appeared.

Use this interpretation:

```text
T > 0  = net category improvement
T = 0  = no net category change
T < 0  = net category worsening
```

A negative `T` is not a fifth public status. It simply does not qualify for Improving Trends.

If the project requires `T` never to become negative, then the project cannot honestly use an expanding denominator and still call `T = Fcurrent − Fprevious`. Clamping it to zero would hide new risk. The alternative is a separate remediation-only score, which would be a new metric requiring explicit approval.

## 6. Add Scenario 6 — Recurrence of one of the original five

Precondition: after Scenario 4:

```text
A–E = durably resolved
F and G = unresolved
Expanding membership:
B=7, R=5, O=2, F=7.14, P=2.29
```

Then A returns.

| Condition of A’s return | FLC result |
|---|---|
| Same SQL type but different logical/scope identity | New FLC; not recurrence. |
| Exact same old vulnerable code returns | A becomes open again, but record an identical-restoration/toggle event; not ordinary Recurring. |
| Same logical/scope identity, changed vulnerable content | Reuse FLC-A; increment `recurrenceCount`; this is a true recurrence. |

For a true recurrence:

```text
B remains 7. A is not a new FLC.

R = 4
O = 3

F = 4/7 × 10 = 5.71
P = 3/7 × 8 = 3.43
T_live = 5.71 − 7.14 = -1.43
```

Comparison across models:

| Model | Result after A recurs |
|---|---|
| Fixed membership | `B=5 R=4 O=1 F=8.00 P=1.60 T=-2.00`; F/G remain outside the original metric. |
| Expanding membership | `B=7 R=4 O=3 F=5.71 P=3.43 T=-1.43`. |
| Separate groups | C1(A–E): `F=8.00 P=1.60 T=-2.00`; C2/C3 unchanged. |

If the earlier two-return threshold remains:

```text
First changed-content return:
  recurrenceCount = 1
  recurrence history is recorded
  not yet shown in Recurring Patterns

A is fixed durably again, then returns a second time:
  recurrenceCount = 2
  Recurring Patterns includes:
    SQL Injection   1
```

I recommend that a qualified Recurring item bypass the `P >= 6` Persisting filter. Otherwise a real recurrence can disappear from the Trends panel merely because historical fixes lowered `P`.

These changes preserve the four public statuses: Persisting, Improving, Resolved, and Recurring.