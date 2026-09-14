No implementation changes made. The handoff is correct: today’s Trends UI is a raw-snapshot diff, not the proposed lifecycle/session framework.

## What the code actually does

- `ariadne-core` is a long-lived Rust scanner: it builds AST/index/semantic/data-flow state, runs taint/pattern/config detectors, then emits a flat `VulnerabilityMetadata[]`. [`pipeline.rs`](/home/zdrco/Projects/School/ariadne-project/ariadne-core/src/engine/pipeline.rs:44) [`session.rs`](/home/zdrco/Projects/School/ariadne-project/ariadne-core/src/cli/session.rs:79)
- `Init`, file create/delete/rename, and every `UpdateFile` trigger an analysis. `Init` can scan before open editor buffers are synchronized, so it cannot safely become a Trends baseline. [`documentEvents.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/detection/bridge/documentEvents.ts:182) [`session.rs`](/home/zdrco/Projects/School/ariadne-project/ariadne-core/src/cli/session.rs:157)
- The protocol has no request ID, revision, reason, success/complete envelope, or final-session reason; the extension only accepts JSON arrays. [`messages.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/detection/bridge/messages.ts:15) [`iostream.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/detection/bridge/iostream.ts:25)
- Every result currently updates active cards, diagnostics, raw snapshot storage, and immediate Trends calculations. [`extension.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/extension.ts:216)
- Current identity is `cwe::type`, with “instances” grouped by `instance_name` or `file:line`; it is not a stable per-finding lifecycle identity. [`convert.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/detection/bridge/convert.ts:111)
- Current Trends counts vulnerability types, not FLC instances. The screenshot’s “Recurring issue” notifications are actually produced by the current `persisting` branch; there is no true public Recurring row yet. [`snapshotAnalyzer.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/analysis/snapshotAnalyzer.ts:131) [`sessionMetrics.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/sessionMetrics.ts:344)
- Shutdown is immediate; no final scan is awaited. [`extension.ts`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/extension.ts:414)

So the screenshot is useful for visual language, but not evidence that its current counts or notification labels implement the new framework.

## Numerical fixture used below

The real files/locations were not supplied, so these are illustrative labels only:

| FLC | Example location | History |
|---|---|---|
| A–E | Five original High SQL Injection findings | Original matched FLCs |
| F | `InvoiceRepository.java:44` | Later unmatched SQL finding |
| G | `ExportRepository.java:62` | Another later unmatched SQL finding |

All are High severity, so `W = 0.8`.

```text
R = durably resolved FLCs
O = FLCs not durably resolved, including a first provisional absence

F = 10 × R / B
P = 10 × W × O / B = 8 × O / B
T = final F(current completed session) − final F(previous comparable completed session)
```

`T` is always `N/A` during an active session. It is calculated only at a completed final checkpoint. There is no `F_cross` or `P_cross`.

## The three models, without treating any as approved

| Model | Membership | Meaning |
|---|---|---|
| Fixed baseline membership | A–E remain the only scored members forever; F/G are separately reported. | Genuine progress on the original five, but no one score represents all current SQL findings. This is the rejected/not-approved one-original-set proposal. |
| Expanding per-vulnerability membership | Every distinct FLC ever seen for the SQL key joins `B`. | One simple category score, but it becomes net category health—not progress on a fixed original set. |
| Separate baseline groups | C1=A–E, C2=F, C3=G each receive separate scores. | Fixed denominators, but several scores under one SQL type. This is also not approved. |

The handoff explicitly says not to present either fixed-one-baseline or baseline groups as decided. [`ariadne-trends-framework-new-chat-handoff.md`](/home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/docs/ariadne-trends-framework-new-chat-handoff.md:9)

## Panel rule needed before any model works

There is no approved “collapsed SQL row.” The intended panel has four collapsed status rows; SQL Injection appears inside an expanded status row, possibly more than once.

Use this non-overlapping display policy:

| Public row | What it contains |
|---|---|
| Resolved This Session | FLCs that reach durable resolution during this session. |
| Recurring Patterns | Currently detected FLCs that are matched returns under the approved recurrence rule. Same CWE/type alone is never recurrence. |
| Improving Trends | Currently open FLCs whose type had a durable resolution in this same session. This means “remaining instances in an improving type,” not “this individual FLC is partially fixed.” |
| Persisting Patterns | Currently detected FLCs with two settled detections and at least 30 seconds observed duration, unless covered above. |

A first detection or a first settled absence has no public Trends row yet. That is not a fifth status: it is simply not eligible for a public status. The UI may show an operational notice such as “Trend evidence is still being collected,” while the Active Vulnerabilities panel still shows the live finding immediately.

This avoids double counting. For example, with one durable resolution and four remaining original SQL findings:

```text
F = 2.00, P = 6.40
Resolved This Session  1    -> A
Improving Trends       4    -> B–E
```

The same SQL type appears in two expanded rows, but each FLC appears only once.

## Scenario 1 — First use

| Scan | Trigger / live UI | Valid / settled | FLC change | SessionRecord change | F/P/T and panel |
|---|---|---|---|---|---|
| L0 | Activation sends `Init`; raw findings can update active cards and diagnostics. | Not a measurement; no Trends settlement. | None. | None. | Trends: `Waiting for first saved measurement.` All four counts `0`. |
| M1 | First tracked-file save sends a full-workspace measurement immediately. Raw UI shows A–E. | Valid if correlation/revision/success/complete match; settled only after 2 unchanged seconds. | On settlement, create A–E as five FLCs. | Create active S1 and its baseline checkpoint. | All models: `B=5, R=0, O=5, F=0.00, P=8.00, T=N/A`. No public row yet. |
| M1-cancelled | Student edits during the two seconds. Raw UI may still have shown M1. | Valid, but not settled. | No changes. | No changes. | Exact notice: `Saved measurement changed before confirmation; Trends was not updated.` |
| M2 | Later save still finds A–E, at least 30 seconds after M1. | Valid and settled. | A–E are old matched FLCs; second settled detection. | Update S1 latest settled summary. | `B=5 R=0 O=5 F=0.00 P=8.00 T=N/A`. Collapsed: Persisting `5`; expanded SQL lists A–E. |
| S1 final | Valid settled final scan still finds A–E. | Valid and settled. | No new lifecycle transition. | S1 becomes completed. | Final `F=0.00 P=8.00 T=N/A`. This is S2’s future reference. |

Before the first save, the exact Trends copy should be:

> Waiting for a saved measurement. Live findings are shown in Active Vulnerabilities.

That is operational text, not a status.

## Scenario 2 — Later activation and Session 2

| Scan | Trigger / live UI | Valid / settled | FLC change | SessionRecord change | F/P/T and panel |
|---|---|---|---|---|---|
| L2 | Activation restores S1 and A–E for historical display; a live scan may show A–E again. | Not a measurement. | None. | Do not create S2. | Show `Last completed session available. A new session begins after a saved measurement.` |
| S2-M1 | Student edits and saves; result still contains A–E. | Valid and settled. | A–E are old matched FLCs; confirmations increase. | Create active S2. `previousCompletedSessionId=S1`; baseline checkpoint is S2-M1. | All models: `B=5 R=0 O=5 F=0.00 P=8.00 T=N/A`. Persisting `5`. |
| S2-M2 | Student saves a fix; raw result contains none of A–E. | Valid and settled. | A–E receive only a first absence; not durable. | Update S2 latest summary. | Still `F=0.00 P=8.00`. No Resolved count. Active panel is empty; Trends says confirmation is required. |
| S2-M3 | At least five seconds later, another saved measurement still contains none of A–E. | Valid and settled. | A–E become durably resolved. | Update S2 latest summary. | `B=5 R=5 O=0 F=10.00 P=0.00 T=N/A`. Resolved This Session `5`; expanded SQL lists A–E. |
| S2 final | Final result remains empty. | Valid and settled. | No change. | Complete S2; do not overwrite S1. | Final `F=10.00 P=0.00 T=+10.00` versus S1’s `F=0.00`. |

The fixed baseline is the original membership A–E. The previous-session reference is S1’s immutable final `F=0.00`; it never replaces `B`.

## Scenario 3 — Five old instances fixed, then F appears

At S3-M1, F is an unmatched new FLC, not a recurrence. A–E remain retained durably resolved FLCs.

| Model | Exact S3-M1 values | If this becomes S3 final | Expanded SQL disclosure |
|---|---|---|---|
| Fixed membership | Original set: `B=5 R=5 O=0 F=10.00 P=0.00`. F is separately reported and has no F/P/T in this pure model. | `T=10.00−10.00=0.00` for A–E. | `Original set: 5/5 confirmed resolved. Later unmatched findings: 1 (F).` |
| Expanding membership | `B=6 R=5 O=1 F=8.33 P=1.33`. | `T=8.33−10.00=−1.67`. | `Ever observed: 6; confirmed resolved: 5; unresolved: 1.` |
| Separate groups | C1(A–E): `F=10.00 P=0.00`; C2(F): `B=1 R=0 O=1 F=0.00 P=8.00`. | C1 `T=0.00`; C2 `T=N/A`. | Two metric blocks, C1 and C2. No honest single SQL score exists. |

Panel result at S3-M1:

```text
Active Vulnerabilities: F is visible immediately.

Persisting Patterns       0
Improving Trends          0
Recurring Patterns        0
Resolved This Session     0

Notice: One saved SQL finding still needs Trends evidence.
```

The old five are not counted under “Resolved This Session,” because they were resolved in S2. They remain visible in historical metric detail, so the new F does not erase the old work.

## Scenario 4 — F stays open, G appears

Assume S4-M1 occurs at least 30 seconds after F’s first settled detection.

- F is an old matched FLC, still unresolved: it qualifies as Persisting.
- G is an unmatched new FLC: it has one settled detection and is not Recurring.
- A–E remain durably resolved.
- No FLC is Improving or Resolved in S4, and neither F nor G is Recurring.

| Model | Exact S4-M1 values | If this becomes S4 final |
|---|---|---|
| Fixed membership | A–E: `B=5 R=5 O=0 F=10.00 P=0.00`; F/G separately reported. | `T=0.00` for original A–E. |
| Expanding membership | `B=7 R=5 O=2 F=7.14 P=2.29`. | `T=7.14−8.33=−1.19`. |
| Separate groups | C1: `F=10.00 P=0.00 T=0.00`; C2(F): `F=0.00 P=8.00 T=0.00`; C3(G): `F=0.00 P=8.00 T=N/A`. | Still three metric blocks. |

Panel result:

```text
Active Vulnerabilities: F and G are both visible as raw cards.

Persisting Patterns       1
  SQL Injection
  └── InvoiceRepository.java:44  (F)

Improving Trends          0
Recurring Patterns        0
Resolved This Session     0

Supporting detail: one other current SQL finding still needs Trends evidence.
  ExportRepository.java:62  (G; excluded from the Persisting count)
```

This is the key distinction: the Active Vulnerabilities panel makes both open findings visible now. The Trends count may not call G Persisting until its evidence meets the given rule. That is not hiding G, and it does not invent a “New” status.

## Scenario 5 — Accidental close

Assume S5-M0 was an earlier valid settled measurement of F and G:

```text
Expanding model at S5-M0:
B=7, R=5, O=2, F=7.14, P=2.29
```

| Case | FLC / SessionRecord result | Final metric result |
|---|---|---|
| Last saved fix never becomes valid and settled | FLCs remain at S5-M0’s last trusted states. Because a tracked file changed after S5-M0, fallback is unsafe. S5 becomes incomplete. | No final F/P/T. The last values are audit-only, not S5’s outcome. |
| The saved fix became valid and settled once, then final scan fails | F moves to provisional absence only. If no later tracked edit occurred, fallback to this saved checkpoint is safe. | No remediation credit yet: Expanding remains `F=7.14 P=2.29 T=0.00`; fixed model remains `F=10.00 P=0.00 T=0.00`; C2 remains `F=0.00 P=8.00 T=0.00`. |
| A prior absence plus this saved checkpoint prove durable resolution | F becomes durably resolved before shutdown. Safe fallback is allowed if no later tracked edit occurred. | Expanding: `B=7 R=6 O=1 F=8.57 P=1.14 T=+1.43`. Fixed original A–E remains `F=10.00 P=0.00 T=0.00`; C2 becomes `F=10.00 P=0.00 T=+10.00`. |

On reopening after an incomplete S5:

```text
Final Trends measurement was not recorded for the previous session.
No F/P/T was assigned to that session.
A new session begins after the next saved measurement.
```

Keep the incomplete record for audit, keep FLC states only through the last valid settled observation, skip S5 as a `T` reference, and do not create S6 merely by reopening.

## Recommendation for lead approval

I recommend **expanding per-vulnerability membership**, but only with this explicit change in meaning:

> F, P, and T measure the current health of an ever-observed vulnerability category, not remediation progress on a fixed original problem set.

That produces the simple SQL category detail the lead wants:

```text
SQL Injection
F 8.33 / 10   P 1.33 / 10   T −1.67
5 confirmed resolutions · 1 unresolved instance
```

It also truthfully lowers the category score when F or G appears, even though A–E remain fixed.

Trade-off: the thesis/report must not describe `T` as “progress on the original baseline.” It is a net category-health change between completed sessions. Historical SessionRecords must preserve their own `B/R/O/F/P/T` snapshots; S2’s completed `B=5` must never mutate to `B=6` or `B=7`.

The fixed model preserves original-set remediation meaning but forces a separate “later findings” disclosure. Separate groups preserve denominators but visibly recreate the complexity the handoff says the lead does not want.

Before implementation, the lead should explicitly approve that revised metric meaning. The existing protocol, FLC storage, save gate, fingerprint context, serial persistence, and async finalization are all prerequisites—not implementation details that can safely be skipped.