You are right—the simpler model is better.

### 1. Live scan vs save-triggered scan

Use the same scan pipeline for both. The difference is what we do with its result:

```text
Tracked-file change
→ scan
→ use findings + lightweight scan metadata for immediate left-panel updates
→ do not commit FLC, SessionRecord, or Trends changes

Tracked-file save
→ same scan
→ use complete scan metadata
→ if valid, wait for the settled condition
→ commit findings to both left and right panels, FLCs, SessionRecord, and Trends
```

So there is no need to “reuse” a prior live result. The save triggers its own official scan. The live scan is simply the fast UI update; the save scan is the measurement candidate.

`valid` means the save-triggered result belongs to the correct request/revision and completed successfully. `settled` means no tracked-file change occurred during the required quiet period. Only then does that saved result become official.

### Attention placement and Trends structure

Agreed: Attention should be a normal card within the existing scrollable Session Notifications feed, alongside recurrence and other session cards. It should not create a new UI group.

For example:

```text
[notification card]
SQL Injection: 1 active instance still needs review.
Open Active Vulnerabilities
```

It is an alert/notification, not a fifth lifecycle status.

And yes: I simplified the Trends display only to explain placement. Keep the existing collapsible Trends design.

```text
Collapsed Trends
  Persisting Patterns       3
  Improving Trends          1
  Resolved This Session     2
  Recurring                 1

Expanded Improving Trends
  SQL Injection — Some progress (+2.00)
  1 of 1 prior unresolved instances fixed
```

The expanded area stays type-level and count-based; it does not show an A–E instance list. The notification card can link the user to the left panel for actual instances.

### Score ranges

I agree with using ranges for users, while retaining decimals for research and debugging. A raw `+2.00` alone has little meaning to most users.

I would make the range a description, not another status:

| Trend score `T` | User-facing description |
|---|---|
| `0 < T < 4` | Some progress |
| `4 ≤ T < 7` | Clear progress |
| `7 ≤ T ≤ 10` | Major progress |

Show both together:

```text
Some progress (+2.00)
```

Two important safeguards:

- `T = 0` should not appear under Improving Trends as “Stagnant.” It means there was no durably measured movement since the prior completed session. If active findings remain, they are surfaced through Persisting and/or the notification feed.
- Avoid making `+7` or `+10` sound like the project is safe. It means strong progress on the prior session’s known instances—not that no active vulnerabilities remain.

The most useful user text is the score plus a count-based explanation:

```text
Some progress (+2.00)
1 of 1 prior unresolved instances fixed
```

That prevents Scenario 3 from feeling misleading: `+2.00` is numerically smaller than Session 2’s `+8.00`, but the user can see that they fixed the final remaining prior-session instance.

### F-only versus pairwise Trend `T`

The better approach is to keep both, but give them different jobs. They are not competing definitions of the same metric.

| Metric | Meaning | Best use |
|---|---|---|
| `F` | Historical fix coverage across all FLCs ever observed for that vulnerability type | Long-term progress / fix coverage |
| `T` | Change since the previous completed session, using that session’s known FLCs | Improving ranking and direction |
| `P` | Current unresolved persistence pressure | Persisting ranking |
| Attention notification | Active finding not adequately surfaced by the ranked Trends lists | Preventing neglected active vulnerabilities |

Using only `F` gives a good historical story, but it is not a trend: it cannot clearly say whether this session moved upward, stayed unchanged, or moved downward.

Using only `T` gives a real direction, but has intentional one-session scope. In the revised example:

```text
Session 2:
A–D fixed, E active
T = +8.00

Session 3:
E fixed, F newly appears
T = +2.00
```

F is deliberately excluded from Session 3’s `T`, because `T` answers: “Did we improve the work known at the end of Session 2?” The answer is yes: the final old instance, E, was fixed.

F is still not ignored:

```text
Category F = 8.33 / 10   // five of six ever-observed instances resolved
Category P = 1.33 / 10   // one High-severity instance remains active
Notification = F needs review
```

Then, if F remains active into Session 4, it becomes part of Session 4’s comparison set and can affect the next Trend score.

So my recommendation remains:

- Use `F` as the historical fix-coverage measure.
- Use `T` in the collapsible Trends panel for actual upward/downward movement.
- Use `P` and the notification feed so a newly active vulnerability is immediately visible rather than hidden by the pairwise Trend calculation.