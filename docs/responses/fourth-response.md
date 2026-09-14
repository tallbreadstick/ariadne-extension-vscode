Here are the targeted clarifications for Sections 3–5.

### 1. Why not reuse the earlier live result?

Think of a live scan as a draft photo taken while the student is typing, and a save scan as the official photo used for Trends.

A live result can update the left-side active-vulnerability list and diagnostics quickly. But it must not become an official FLC/session measurement unless we can prove all of this:

- it represents the same full workspace state as the save;
- it was a full-workspace measurement, not merely a typing-triggered update;
- its request ID and workspace revision match the latest save;
- the scan succeeded and completed;
- no tracked file changed during the settling period.

Otherwise, an older result could return after a save and falsely create, resolve, or update an FLC.

The current engine may analyze its in-memory workspace after a file update, but the extension currently receives only a bare findings array. It has no request/revision/completion envelope proving that the returned result is the official saved workspace state. Therefore, for the first implementation, a save should always request and use a fresh full measurement for FLCs, `SessionRecord`, and Trends. The live result remains useful, just not authoritative for metrics. Annotation 1

### 2. Where the previous-session comparison set belongs

Yes—the previous session’s FLCs should be retained through `SessionRecord.perInstanceLifecycleSummaries`, including instances resolved during that session. Do not retain only currently active instances.

However, the new session should also store a frozen reference to them separately:

```ts
type TrendComparison = {
  sourceSessionId: string;
  flcIds: string[];               // frozen at session start
  sourceFinalScore: number;       // F_compare at the prior session's end
};

type SessionRecord = {
  // ...
  perInstanceLifecycleSummaries: Record<string, InstanceLifecycleSummary>;
  trendComparison?: TrendComparison; // absent in Session 1
};
```

For example:

```text
Completed Session 2 summaries: A, B, C, D, E
  A–D resolved; E still active

Session 3 trendComparison:
  sourceSessionId: Session 2
  flcIds: [A, B, C, D, E]
  sourceFinalScore: 8.00

Session 3 lifecycle summaries:
  A, B, C, D, E, F
```

When E is resolved and new F appears in Session 3:

```text
T = (5 / 5 × 10) − 8.00 = +2.00
Category F = 5 / 6 × 10 = 8.33
Category P = 10 × 0.8 × 1 / 6 = 1.33   // if SQL is High severity
```

F does not enter Session 3’s `T` denominator, because it was not known in the previous completed session. It does enter category health and the Attention feed. If F remains into Session 4, it becomes part of that next session’s comparison set.

This is not a lifetime baseline or a baseline-group UI model: no instances are partitioned into separate groups. It is a frozen, one-session reference used only to make `T` mean “progress on work known at the end of the prior session.”

### 3. Attention cards in the scrollable session-notification feed

Yes, that is viable UX-wise. I would place it at the top of the existing scrollable feed, immediately below the Trends summary and before ordinary session notifications:

```text
TRENDS
  Persisting Patterns      3
  Improving Trends         1
  Resolved This Session    2

NEEDS ATTENTION (2)
  SQL Injection — 1 active instance needs review
  Hardcoded Credentials — 2 active instances need review

SESSION NOTIFICATIONS
  ... existing cards ...
```

This should be a persistent section, not a one-time toast. Each card should aggregate by vulnerability type, show only a count, and link to the filtered Active Vulnerabilities panel. Cap it to a small number of cards and show an overflow count/link.

Because the feed can be below the fold, add a compact count near the Trends header, such as `Attention: 2`. “Needs attention” is a UI queue label, not a fifth lifecycle status; the only statuses remain Persisting, Improving, Resolved, and Recurring.

### 4. Showing Trend score in the initial panel

That is a good addition, provided the label explains what the number means. A bare `+2.00` is too easy to misread as overall security health.

```text
TREND SCORE
+2.00  Live
Progress on instances known in the prior completed session
```

Rules:

- Session 1 shows `N/A — first session`, not `0`.
- Later active sessions can show `T_live` after a valid settled full measurement.
- At session end, the same value becomes final.
- New unmatched findings do not lower this score by expanding its denominator.
- A recurrence of an instance from the prior session can lower it, which is meaningful.

If the card represents the whole workspace, calculate it from all comparison-set FLCs together, rather than averaging vulnerability-type scores:

```text
T_workspace = 10 × (resolvedNow − resolvedAtPriorSessionEnd) / totalComparisonFLCs
```

Individual vulnerability-type rows can still show their own `T`, such as `SQL Injection  +2.00`.