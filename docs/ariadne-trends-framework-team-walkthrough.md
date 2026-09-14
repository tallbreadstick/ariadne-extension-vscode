# Ariadne Trends Framework — Section-by-Section Team Walkthrough

**Purpose:** A simple speaking script that follows the finalization document in exactly the same order.  
**Source of truth:** [`ariadne-trends-framework-finalization.md`](./ariadne-trends-framework-finalization.md)  
**Audience:** Ariadne research team and research lead  
**Suggested length:** 20–30 minutes, plus questions

## Lead quick-start — read this before Section 1

> Before we go through the full framework, here is the one-minute version.
>
> This is a **proposed tracking framework**, not a change to Ariadne's security-detection rules. Ariadne will still scan code as it does today. The proposal changes how the extension follows the scanner's findings over time.
>
> We will track one stable, context-aware finding instance at a time, instead of treating every finding with the same CWE as one problem. We will show only four public statuses: Persisting, Improving, Resolved, and Recurring.
>
> A finding is not called Persisting merely because it appeared in two nearby scans. It must remain active for a minimum active comparable observed time and appear in enough accepted settled scans. A finding is not called Resolved after one missing scan. It must stay absent through a grace period and a later comparable valid checkpoint.
>
> The framework also protects the data from common mistakes: a scanner failure cannot create a false fix; moving code to another line cannot create a false new issue; and hiding then restoring exactly the same code is recorded as an integrity flag rather than credited as a fix.

| What the lead needs to know first | Final decision | Why it matters |
|---|---|---|
| Scope | This is a proposed trends-tracking layer for the VS Code extension, not a replacement for the Rust SAST engine. | We are improving interpretation of findings over time, not changing what the scanner detects. |
| Public result | Use only Persisting, Improving, Resolved, and Recurring. | The status model stays aligned with the meeting recap and remains understandable. |
| Main unit | Track stable finding instances, then group them by CWE/type in the UI. | Two findings with the same CWE can have different histories and must not be merged. |
| Persistence rule | Use active comparable observed duration plus settled confirmations, not raw scan count. | Scan count and inactive gaps must not create persistence evidence. |
| Resolution rule | Require provisional absence, a grace period, and a later comparable valid confirmation. | A temporary edit, comment-out, failed scan, or scope change must not become a claimed fix. |
| Scores | F measures matched remediation, P measures severity-weighted residual burden, and T compares F across comparable sessions. | None of these scores is a substitute for the time-based Persisting rule. |
| Research boundary | Report observed code behavior only; do not infer intent, understanding, or permanent remediation. | The data is useful research evidence, but it is not proof of why a student acted. |

> The detailed walkthrough starts now. The final decisions the lead is being asked to approve are the tracking unit and fingerprints, valid and settled observations, initial timing values, session definition, score definitions, recurrence rule, toggle safeguard, and research claim limits.

> **How to use this script:** Read the quoted text aloud. The short notes below it explain what to emphasize if the team asks questions. This script does not replace the finalization document; it makes every section easier to explain.

---

# 1. Executive decision

> I will start with the main decision.
>
> We are keeping four public Trend statuses only:
>
> 1. Persisting
> 2. Improving
> 3. Resolved
> 4. Recurring
>
> We are not adding public statuses such as New, Mixed, or Regressing. This keeps the Trends card simple and matches the framework recap.

> The framework uses three different kinds of evidence. We must not mix them up.

| What we use | Simple question it answers | What we use it for |
|---|---|---|
| Observed time plus confirmation scans | Has this finding stayed open long enough to matter? | Persisting status |
| Counts of the same matched findings | Did the open problem get smaller? | Improving status and fix calculations |
| History of completed sessions | Did the finding return after it was confirmed gone? | Recurring status and cross-session analysis |

> In simple terms: time tells us whether something stayed around, counts tell us whether it got smaller, and session history tells us whether it came back.

> We are keeping the three scores from the recap: F, P, and T.
>
> - F means remediation score. It tells us how much of the original problem was fixed.
> - P means severity-weighted residual-risk score. It tells us how much of the original problem is still open, while giving more weight to more severe vulnerabilities.
> - T means trend score. It compares F between two comparable sessions.

> The important correction is that P is not a time score. P does not tell us how long a vulnerability has existed. Time-based persistence does that.

> We are not using EWMA in this final framework. EWMA would add another score based on scan frequency. Ariadne scans while people type, so scan frequency depends on typing behavior. The time-and-confirmation lifecycle is easier to explain and better fits our four statuses.

**Key point to emphasize:** This is not a new security scanner. This is a stronger way to track the findings the scanner already produces.

---

## 1.1 Safeguards and known loopholes at a glance

> Before we move to the research objective, we need to make one thing clear: the framework has safeguards, but no scanner can see everything that happened between scans.
>
> A safeguard tells Ariadne when it must **not** make a claim. If the evidence is weak, the safe decision is to wait, mark the result incomparable, mark a match ambiguous, or exclude a session from the score.

| Risk or loophole | Direct safeguard |
|---|---|
| Fast typing shows temporary code states | Only valid, settled scans can change Trends data. |
| The scanner, parser, transport, or workspace setup fails | Failure can never count as a fix. |
| A rule is disabled, a file is excluded, the project changes, or the engine/parser changes | The scan is incomparable with the baseline. It cannot resolve a finding or change scores. |
| An old scan finishes after newer code was scanned | Ariadne checks the session sequence and document version/content hash, then ignores stale results for Trends. |
| Code moves to a different line | Logical fingerprints follow the finding; line number is only a location hint. |
| Two identical-looking findings cannot be uniquely matched | Use one-to-one matching. If it is still unclear, mark it ambiguous and give no fix, recurrence, or score credit. |
| Code is deleted or commented out briefly | First absence is provisional. Ariadne requires a grace period and later comparable confirmation. |
| Exactly the same code returns | Record an Identical Restoration integrity flag; do not credit a fix. |
| Code remains commented out or suppressed and never returns | Ariadne can report scanner absence only. It cannot prove the code is semantically secure or that the student intentionally fixed it. |
| A new finding appears after a baseline | Give it its own lifecycle and baseline. Do not distort the old F or P ratio. |
| VS Code closes before the final check | Mark the session incomplete and exclude it from cross-session scores. |
| Ariadne was inactive for hours or days | Do not add that unobserved wall-clock time to the Persisting timer. |
| A student action happens entirely between scans | Do not invent an event that Ariadne did not observe. |

> The later sections define each safeguard precisely. The acceptance tests near the end are the gate: the framework is not ready for research reporting until they pass.

**Key point to emphasize:** The framework is conservative on purpose. It prefers withholding a conclusion over recording a misleading fix, recurrence, or research score.

---

# 2. Final research objective and claim boundaries

## 2.1 Objective

> The purpose of the Trends framework is to observe what happens to vulnerabilities over time.
>
> For each finding, Ariadne should tell us whether it:
>
> - stays unresolved;
> - becomes smaller because some instances were fixed;
> - becomes confirmed absent; or
> - comes back after being confirmed absent.

> The normal severity cards answer, “How serious is the code right now?” The Trends framework answers, “What is happening to the code over time?”

## 2.2 What we may claim

> With this framework, we can report:
>
> - how long Ariadne observed a finding as active;
> - when a remediation was confirmed;
> - how much of the original finding burden remains;
> - how often a finding returns; and
> - how these things change across completed sessions.

## 2.3 What we must not claim

> We must also be clear about limits.
>
> The framework cannot prove that a student intended to hide code.
>
> It cannot prove that one missing scan means a permanent fix.
>
> It cannot prove that a recurring finding means the student did not understand the concept.
>
> It cannot prove that a student independently wrote vulnerable code again. The code may have returned because of a refactor, a revert, a copied template, or a tool difference.

> So our trend data is evidence about code behavior. It is not proof about a student's intention, understanding, or learning outcome.

**Key point to emphasize:** For research, recurrence and resolution are signals that may lead to interviews, reviews, or other evidence. They are not final proof by themselves.

---

# 3. Terms and measurement units

> Before we calculate anything, we need to agree on the words we use.

| Term | Plain meaning |
|---|---|
| Occurrence | One reported location for a finding, such as one file and line. |
| Finding instance | One specific security issue in a specific code context. It can have one or more occurrences. |
| Vulnerability type | The broad label, such as SQL Injection or CWE-89. It is for grouping, not for deciding identity. |
| Baseline cohort | The matched findings that exist when we first confirm a problem in a session. |
| Valid observation | A complete, successful Ariadne result that we can trust for calculations. |
| Settled observation | A valid scan taken at a stable point, such as after saving, after an idle period, from manual Analyze, or at session end. |
| Comparable observation | A valid, settled scan with the same analysis context and accepted ordering as the baseline/lifecycle record it is being compared with. |
| Analysis-context fingerprint | A versioned summary of the project, scanned files, enabled rules/configuration, engine version, parser capability, and ignore/exclusion settings. |
| Provisional resolution | Ariadne did not find the issue once, but we have not confirmed that it is really gone. |
| Durable confirmed resolution | Ariadne still does not find the issue at a later accepted comparable checkpoint. |
| Observation session | A defined work period with a baseline and a final accepted comparable check. |
| Eligible session | A completed session from the time a finding first appears until its current state or confirmed resolution. |
| Incomplete session | A session without an accepted, valid, comparable final check. It remains auditable but is excluded from cross-session scores. |

## 3.1 The unit rule

> The main tracking unit is a finding instance, not just a CWE type.
>
> Example: SQL injection in `OrderService.search` and SQL injection in `AdminController.lookup` are different finding instances. One can be fixed while the other stays open.

> We must track them separately first. After that, the interface can group them under SQL Injection.

## 3.2 The UI rule

> The collapsed Trends card will count finding instances.
>
> It will not count broad CWE groups. It will not count every raw line occurrence either.

> In the expanded view, we group the instances by vulnerability type.

> This means the same type can appear in more than one section. For example, one SQL injection instance can be Improving while another SQL injection instance is Persisting. That is correct because they are different pieces of code.

**Key point to emphasize:** We count individual problems, then group them for readability. We do not pretend every finding of the same type has the same history.

---

# 4. Stable finding identity

> The framework cannot work if we do not know whether a finding in one scan is the same finding in the next scan.

> Line numbers are not enough. If a student adds ten lines above a vulnerability, the line number changes even though the vulnerability is still the same.

## 4.1 Required identifiers

> We will use stable identifiers for different jobs.

| Fingerprint | What it does |
|---|---|
| Logical fingerprint | Helps us follow the same logical finding when line numbers move or small harmless edits happen. |
| Content fingerprint | Helps us tell when the same risky code and context return after an absence. |
| Scope fingerprint | Identifies the surrounding method, class, or source/sink context. |
| Occurrence discriminator | Separates repeated, otherwise identical issues inside the same scope. |

> A fingerprint will use information such as:

```text
rule ID
+ CWE and vulnerability type
+ affected symbol name and kind
+ class or method context
+ relevant source/sink expression or normalized code structure
+ file path as a secondary clue
```

> The line number is only a location hint. It is not the main identity.

> The fingerprint algorithm itself must have a version. If we change the algorithm, we do not automatically assume old and new fingerprints mean the same thing unless we validate a safe migration.

## 4.2 Matching rules

| What Ariadne sees | What we conclude |
|---|---|
| Same logical fingerprint | It may be the same finding continuing through edits. |
| Same logical fingerprint, same content, same scope | It may be the same code restored after it disappeared. |
| Same logical fingerprint, changed content, same scope | It may be a reappearance after the code changed. |
| Same CWE/rule but different logical fingerprint | Treat it as a separate finding instance. |
| More than one possible old-to-new match | The match is ambiguous. Do not claim a fix, recurrence, continuity, or partial remediation. |
| No unique one-to-one match | Keep separate candidates or mark the comparison unavailable. Do not collapse duplicates into one issue. |

> We use one-to-one matching. One previous occurrence may match only one current occurrence, and one current occurrence may match only one previous occurrence.

> If duplicate code or a fingerprint collision makes that impossible, we mark the cohort ambiguous. Its last known state can remain visible, but it gets no resolution, recurrence, F/P/T, or cross-session credit until a later scan lets us match it safely.

## 4.3 Privacy rule

> For tracking, we should store hashes or normalized structural information. We should not store extra raw source code just to build analytics.

**Key point to emphasize:** Stable identity is the foundation. If identity is wrong, persistence, improvement, resolution, and recurrence can all be wrong.

---

# 5. Valid and settled observations

## 5.1 Why every scan is not a trend event

> Ariadne scans live while the student types. The current extension has a 300 millisecond debounce, but it also forces scans during continuous typing.

> This is good for live editor warnings. It is not safe to use every one of those scans as research evidence. The code can be incomplete during a fast edit.

> So we separate two jobs:
>
> - Live scans update warnings quickly in the editor.
> - Settled scans confirm changes in the Trends framework.

## 5.2 What counts as a settled scan

> We will treat these as eligible settled observations:
>
> 1. A manual Analyze action.
> 2. A scan after a longer idle period.
> 3. A scan after saving.
> 4. A final scan at session end.

> We will start with three values:

```text
minimum active comparable observed duration: 30 seconds
minimum settled confirmations: 2
absence grace period: 5 seconds
```

> In simple terms: a finding must be present for 30 seconds and be seen in two stable scans before we call it Persisting. When it disappears, we wait five seconds and check again before we call it Resolved.

> These are starting settings. We will test them with real history data. We can adjust them if they are too strict or too loose.

## 5.3 Valid-analysis safeguard

> A missing finding can count as a resolution only when the scan itself is complete and successful.

> These events must never create a resolution:
>
> - the Ariadne core process crashes;
> - the extension receives invalid output;
> - the workspace is not fully initialized;
> - the analysis explicitly failed;
> - a parser or transport error is known; or
> - a required source file or snapshot is unavailable.

> Tool failure is not a code fix.

## 5.4 Analysis-context comparability safeguard

> A scan can succeed and still be unsafe to compare with the baseline.
>
> For example, a finding may disappear because someone disabled its rule, excluded its file, opened a different project, updated the engine, or changed parser support. The scanner did not fail, but it was not looking at the same thing.

> Every settled scan must carry an analysis-context fingerprint containing:

```text
project or workspace identity
scanned-file scope
enabled rules and configuration version
engine version
language/parser capability version
include, ignore, exclusion, and suppression settings
```

> If that fingerprint differs from the baseline or active lifecycle context, mark the scan **incomparable**.
>
> An incomparable scan may still update live editor warnings, but it cannot:
>
> - resolve a finding;
> - record recurrence or identical restoration;
> - add a persistence confirmation or time;
> - change F, P, T, F_cross, or P_cross; or
> - count an absent finding as a fix.

> If we intentionally change scope, we can explicitly create a new baseline. That starts a new cohort. It does not award a fix to the old cohort.

## 5.5 Stale-result and ordering safeguard

> Live scans are asynchronous. An old scan can finish after a newer scan.
>
> Saving results in order is not enough. We also need to know which document each result belongs to.

> Each observation must carry:

```text
session ID
monotonic observation sequence number
document version or normalized content hash
analysis start and completion times
analysis-context fingerprint
```

> Ariadne applies a result to Trends only if it belongs to the active session, has the right context, and is not stale for the document or checkpoint.
>
> A late result for old code is ignored for lifecycle calculations. It cannot make a finding disappear, return, or become the final session result.

**Key point to emphasize:** A scan must be stable and trustworthy before it changes research data.

---

# 6. Session boundaries and storage

## 6.1 What a session means

> The recap uses session-based scores, so we must define a session clearly.

> Our proposed rule is:

```text
Session starts: first accepted valid settled scan after activation,
                or after an explicit Start Session action.

Session ends: explicit End Session action,
              controlled study checkpoint,
              or normal deactivation with a final accepted comparable settled scan.
```

> A session is complete only if its final scan is accepted, valid, settled, and comparable.

> If VS Code closes, crashes, or the final scan fails before this happens, mark the session as incomplete or abandoned. We may retain it for audit, but it cannot enter any cross-session numerator or denominator. We never make up a final result from an earlier live scan.

> If the research study needs reliable session boundaries, an explicit Start Session and End Session action is better than guessing from whether VS Code is open.

## 6.2 What we store

> We do not want to store unlimited full scans forever.

> For each session, we store:

```text
session ID
start time
end time
completion status: completed, incomplete, or abandoned
analysis-context fingerprint
last accepted observation sequence number
baseline checkpoint
final checkpoint
per-instance lifecycle summary
F, P, and T inputs and results
```

> For each finding instance, we store:

```text
logical fingerprint
content fingerprint
scope fingerprint
occurrence discriminator
fingerprint scheme version
baseline analysis-context fingerprint
first confirmed time
last confirmed time
persistence-window start time
active comparable observed duration
time it went missing
provisional resolution time
durable resolution time
baseline count
current count
persistence-window confirmation count
recurrence count
in-session toggle count
identical restoration count
ambiguous match count
```

> Every saved checkpoint also records its accepted sequence number, document version/content hash, and analysis-context fingerprint. That tells us later why a scan was eligible or excluded.

> This gives us the information we need without saving every complete scan forever.

## 6.3 What the code currently does

> The current code does not do this yet.

> It stores a scan snapshot after every engine result. It keeps those snapshots in workspace state, even after VS Code restarts. It does not have a real session start or end.

> So the final framework is a proposed design. It is not a claim that the code already works this way.

**Key point to emphasize:** We need real session boundaries before we can honestly use session-based research scores.

---

# 7. Lifecycle and public status rules

## 7.1 Internal lifecycle

> Internally, a finding follows this path.

```text
first accepted comparable observation
  → candidate, not yet eligible for Trends
  → active tracked finding
  → finding disappears
  → provisional resolution
  → either stays absent and becomes durable confirmed resolution
  → or returns and is checked for recurrence or identical restoration
```

> Candidate is an internal stage. It is not a fifth status on the Trends card.

> Every lifecycle change in this section needs an accepted, valid, settled, comparable scan and an unambiguous one-to-one match. If either condition is missing, Ariadne waits instead of claiming a change.

## 7.2 The public status rules

| Status | Plain rule |
|---|---|
| Persisting | The finding is active long enough in a comparable persistence window, has enough settled confirmations, and is not improving. |
| Improving | The finding is still active, but the number of matched open occurrences has gone down in the same comparable cohort. |
| Resolved | The finding stayed absent long enough and a later comparable valid checkpoint confirmed scanner absence. This is not proof of a permanent semantic fix. |
| Recurring | The finding was durably confirmed resolved, then later came back with the same logical identity in a comparable context and meets the recurrence rule. |

## 7.3 Status priority

> When more than one description could apply, we use this order:

```text
1. Recurring
2. Resolved
3. Improving
4. Persisting
5. Candidate: not shown in Trends yet
```

> This prevents a finding from being shown as Resolved and Improving at the same time. It also makes sure a return after resolution is not hidden just because the current count dropped.

## 7.4 No regression status

> If a count increases, the status stays Persisting. We do not create a Regressing status. The expanded details can say that the count went from three to five.

> This keeps the four public statuses from the recap while still showing the increase honestly.

**Key point to emphasize:** The four public statuses stay simple, but the internal lifecycle gives them reliable meaning.

---

# 8. Time-based persistence

> Time-based persistence is the central change.

> At an accepted, comparable settled scan time `t`, we calculate:

```text
observed age = active, comparable observation time
               in the current persistence window
```

> The persistence window begins when Ariadne first confirms the finding in the current active session and the current analysis context.

> At each later accepted active scan, Ariadne adds only the interval since the previous accepted active scan in that same window.

> It does not add an interval that crosses an accepted absence, a session boundary, a deactivation or restart, an incomplete session, or a rules, scope, engine, or parser change. While a finding is provisionally absent, its persistence clock freezes. If it returns before durable resolution, a new active interval can begin.

> Time after the last accepted active scan is never assumed. This is conservative: Ariadne counts time it can bracket with accepted evidence, not time it merely guesses about.

> The confirmation count also belongs to this persistence window. It resets when a new session or analysis context starts a new window. A brief provisional absence freezes the time; it does not create a false completed fix.

> The historical first-confirmed time is still stored for research history. It just does not give a new session free persistence time based on hours or days when Ariadne was not observing.

> A finding can become Persisting when all three are true:

```text
the finding is active now
the observed age is at least the minimum duration
the finding has enough settled confirmations in this persistence window
```

> With the starting values, this means the finding must still be active after 30 seconds and appear in at least two settled scans.

## 8.1 Interpretation

> We call this observed persistence. Ariadne reports what it saw while it could observe the same context. It does not claim to know about edits that happened and were undone between scans.

> If we later want calendar time since first detection, we can store it as a separate value called elapsed time since first detection. It must not replace the observed-age rule for Persisting.

## 8.2 The absence grace period

> When an accepted, comparable valid settled scan no longer finds a finding, Ariadne stores the time it went missing and marks it as provisional resolution.

> If it comes back before confirmation, we continue the same lifecycle.

> If it remains absent through the grace period and later comparable valid confirmation, it becomes Resolved.

> This is how we avoid calling a temporary deletion or comment-out a genuine fix.

**Key point to emphasize:** We measure time and confirmation, not just “present in the previous scan.”

---

# 9. F, P, and T formulas

## 9.1 Within-session baseline cohort

> For one matched finding instance or matched group, we define:

```text
B = the number of occurrences at the first accepted comparable confirmation
O = the number of matched occurrences still open now
R = B − O, meaning how many baseline occurrences were removed
W = severity weight
```

> The severity weights from the recap stay the same:

```text
Critical = 1.0
High     = 0.8
Medium   = 0.6
Low      = 0.4
```

## 9.2 Meaning and formulas

> The three scores answer different questions and have strict limits.

| Score | What it means | When it is allowed |
|---|---|---|
| F | The proportion of a matched baseline that is no longer detected, on a 0–10 scale. | The same unambiguous matched baseline and comparable analysis context must be used. |
| P | The severity-weighted amount of that matched baseline still open, on a 0–10 scale. | The same comparable baseline cohort must be used. It is not time persistence. |
| T | The change in F between comparable sessions. | The matched cohort, analysis context, and final-checkpoint definition must match. |

> F is the matched-baseline detector-absence or remediation score. It tells us how much of the baseline is no longer detected in the same comparable context.

```text
F = (R / B) × 10
```

> Example: four occurrences existed at baseline. Two are now gone.

```text
F = (2 / 4) × 10 = 5
```

> F is five out of ten because half of the matched baseline is no longer detected. This is an operational scanner result, not proof that the remaining code is semantically secure.

### P formula

> P is the severity-weighted residual-risk score.

```text
P = min(1, O / B) × W × 10
```

> The `min(1, ...)` part keeps the score in its stated range even if data changes.

> Example: four occurrences started, two remain, and the severity is High.

```text
P = min(1, 2 / 4) × 0.8 × 10 = 4
```

> P is four because half the baseline remains and the issue is High severity.

> P is not a time score. A finding open for one minute and one open for one week can have the same P if the same proportion remains.

## 9.3 New instances after baseline

> If a new finding appears after the baseline, it starts its own lifecycle and baseline. We do not let it break the original ratio.

> Example: a pattern starts with three instances, all three are fixed, then a new fourth instance appears later. That new instance must not make the original baseline calculation confusing. It is a separate tracked item.

## 9.4 Do not use one global P threshold

> P has different maximum values depending on severity:

```text
Critical can reach 10
High can reach 8
Medium can reach 6
Low can reach 4
```

> So we cannot say “P of seven always means high persistence.” A Low severity issue can never reach seven.

> We use time and lifecycle rules for status. We use P for priority and reporting.

## 9.5 Trend score

> T compares remediation between two comparable sessions.

```text
T = F in current session − F in previous comparable session
```

> If the sessions do not have the same matched baseline and analysis context, or they do not have accepted comparable final checkpoints, T is not available. We show `N/A`, not zero.

**Key point to emphasize:** F tells us what was fixed, P tells us what remains, and T tells us whether remediation changed between valid sessions.

---

# 10. Cross-session formulas

> Cross-session scores use only eligible completed, comparable sessions with unambiguous matches.

> Eligible sessions begin when the finding first appears. We do not include sessions before the finding existed, because they would make a new issue look less persistent than it is.

```text
eligible sessions = completed, comparable sessions from first confirmed appearance
                    through the current state or durable resolution
```

> The cross-session remediation score is:

```text
F_cross =
  eligible sessions with a durable confirmed absence/remediation event
  divided by eligible completed, comparable sessions
  multiplied by 10
```

> The cross-session persistence score is:

```text
P_cross =
  eligible sessions ending with the finding Persisting
  divided by eligible completed, comparable sessions
  multiplied by severity weight and 10
```

## 10.1 Interpretation

> These are session-based scores. They are not time-duration scores. Incomplete sessions, incomparable scans, and ambiguous matches do not enter either score.

> A session that lasts five minutes and a session that lasts five hours each count as one completed session. The observed-duration metric from Section 8 is what captures elapsed time.

## 10.2 Durable remediation/absence rule

> A one-session disappearance is not enough to add fix credit to F_cross. It is only provisional. We add credit only after a later eligible comparable checkpoint confirms that the finding stayed absent.

> Even then, it is a durable scanner-absence event. It is not proof that the code is semantically secure or that the student intentionally remediated it.

**Key point to emphasize:** Cross-session scores show patterns across work periods. They do not replace time-based persistence.

---

# 11. Recurrence and identical restoration

## 11.1 Recurrence

> We store recurrence as a count of this event:

```text
durable confirmed resolution → active again in a comparable context
```

> The first return is stored in research data as one recurrence event.

> To avoid showing a Recurring Pattern too quickly, the public Trends card shows Recurring only after two confirmed returns.

```text
recurrenceCount >= 2
```

> This makes “alternates at least twice” precise. It means two confirmed reappearances after durable confirmed resolutions.

> Before the threshold is met, the current active finding is shown using the normal Persisting or Improving rule, while recurrence history remains in the data.

## 11.2 Identical restoration or suspected toggle

> We also handle a special edge case.

> A student can temporarily comment out, delete, or paste back risky code. A scanner only sees whether the risky code exists at the time of the scan. It cannot know the reason the code disappeared.

> We add an internal flag called Identical Restoration.

> Ariadne records this flag when all three are true:

```text
the finding was active
the finding became absent in an accepted comparable valid observation
the finding returned with the same logical fingerprint,
the same content fingerprint, and the same scope fingerprint
```

> This means “Ariadne observed the same risky code return.” It does not mean that we know the student intended to hide code or did not understand the vulnerability.

## 11.3 In-session toggle count

> We also store two counters:

```text
inSessionToggleCount
identicalRestorationCount
```

> These increase only when Ariadne actually observes this accepted, comparable sequence:

```text
active → absent → active
```

> The finding must have matching logical, content, and scope fingerprints.

> This lets us catch a visible comment-out and paste-back inside a session without storing every full scan forever.

> If the user comments out and restores code between scans, Ariadne cannot know it happened. We do not invent an event that we did not observe.

## 11.4 Effect on scores

> When Ariadne sees identical restoration:
>
> - it cancels the earlier provisional resolution;
> - it does not count a durable fix;
> - it gives no F_cross fix credit;
> - it stores the event for research review; and
> - it does not claim anything about student intent or understanding.

> If the finding returns with changed content but the same logical identity, we record recurrence after the durable-resolution rule. We still do not say that the student independently wrote the issue again. We need other qualitative evidence for that claim.

> There is one limit we cannot remove with scanner data alone. If code stays commented out, suppressed, or otherwise undetected and never returns, Ariadne cannot tell whether it was genuinely remediated. In a stable comparable scope, it can report durable scanner absence. It cannot say that the code is semantically secure, that the student intentionally fixed it, or that learning happened.

> If the rule, file scope, ignore setting, or suppression configuration changed, that is different: Section 5.4 marks the observation incomparable, so it cannot become Resolved at all.

**Key point to emphasize:** Identical Restoration is an internal data-quality flag, not a fifth status.

---

# 12. Examples

## 12.1 Stable unresolved finding

> Example one: a finding stays open.

```text
10:00:00  settled scan: finding A is active
10:00:30  settled scan: finding A is active
10:00:35  settled scan: finding A is active
```

> At 10:00:30, Ariadne has seen A in two settled scans over 30 seconds. It can become Persisting unless its matched count has reduced enough to make it Improving.

## 12.2 Partial remediation

> Example two: a problem becomes smaller.

```text
Baseline count B = 4
Current open count O = 2
Severity = High, so W = 0.8
```

```text
F = ((4 − 2) / 4) × 10 = 5
P = min(1, 2 / 4) × 0.8 × 10 = 4
```

> Two out of four occurrences were removed. The finding is Improving because some matched occurrences remain but the count went down.

## 12.3 Confirmed resolution

> Example three: a finding disappears and stays gone.

```text
10:00:00  finding A is active
10:01:00  accepted comparable settled scan: A is absent → provisional resolution
10:01:07  accepted comparable settled scan: A is still absent → durable confirmed resolution
```

> After the grace period and later valid confirmation, A is Resolved. We say it is confirmed absent. We do not say it is permanently fixed.

## 12.4 Identical restoration in the same session

> Example four: code disappears and comes back exactly the same.

```text
10:00:00  A active; logical L, content C, scope S
10:01:00  A absent
10:01:03  A active; logical L, content C, scope S
```

> Ariadne records Identical Restoration and increments the in-session toggle count. It does not count a durable fix.

## 12.5 Reappearance after durable resolution

> Example five: code returns after it was confirmed absent.

```text
Session 1 ends: A is durably resolved
Session 2 ends: A returns with the same logical fingerprint,
                but the risky code changed
```

> Ariadne records one recurrence transition. It does not appear as a public Recurring Pattern until the recurrence threshold of two confirmed returns is met.

## 12.6 Same CWE, different issue

> Example six: two issues have the same CWE but are not the same instance.

```text
Existing issue: SQL Injection in OrderService.search
Later issue:    SQL Injection in AdminController.lookup
```

> These are separate findings. The same CWE label alone is not enough to claim recurrence or continuity.

## 12.7 Scan scope or engine context changes

> Example seven: a scan can work properly but look at a different target.

```text
Baseline: rule R is enabled and file A is in scope; A is active
Later:    rule R is disabled, or file A is excluded
Scan:     A is absent
```

> This scan is valid, but its analysis context changed. It is incomparable. It cannot resolve A or give F or F_cross credit.

> If we intentionally want to use the new setup, we explicitly create a new baseline. We do not call the old problem fixed.

## 12.8 An older scan returns last

> Example eight: an old result arrives after newer code was already scanned.

```text
Sequence 42: document version V2 is analyzed and accepted
Sequence 41: an earlier analysis of document version V1 finishes afterward
```

> Sequence 41 is stale. Ariadne ignores it for Trends. It cannot overwrite V2, change a finding's lifecycle, or become the final session checkpoint.

## 12.9 Incomplete session

> Example nine: the session cannot finish safely.

```text
End Session is requested
The final scan fails, or VS Code closes before it finishes
```

> We record an incomplete or abandoned session. It can be kept for audit, but it contributes nothing to T, F_cross, or P_cross.

## 12.10 Duplicate matching is ambiguous

> Example ten: Ariadne cannot tell which copy of the same expression changed.

```text
Baseline: two identical risky expressions in one method
Later:    one matching expression remains, but no stable discriminator exists
```

> We do not guess which original occurrence was removed. The comparison is ambiguous, so Ariadne withholds partial-fix, resolution, recurrence, and score credit until a later scan lets it match safely.

---

# 13. Current codebase versus the final framework

> We need to be honest with ourselves and the lead. The current code is a prototype. It does not implement the final framework yet.

| Area | What the code does today | What the final framework requires |
|---|---|---|
| Identity | Uses `cwe_id::type` | Uses stable finding-instance fingerprints |
| Instance grouping | Usually groups by instance name, with file/line fallback | Uses logical, content, and scope fingerprints |
| Scan input | Uses every engine result | Uses only accepted, valid, settled, comparable scans to confirm trends |
| Analysis scope | Does not compare rule/configuration/file-scope/engine changes | Uses an analysis-context fingerprint; changes are incomparable, not fixes |
| Result ordering | Does not protect lifecycle from stale document results | Uses session sequence plus document version/content hash; stale results are excluded |
| Time | Stores a timestamp but does not use it for status | Uses active comparable observed duration, confirmation window, and grace period |
| Persisting | Present in the immediate previous scan with equal or higher instance count | Active long enough with settled confirmation and no improving condition |
| Improving | Immediate count reduction | Confirmed matched baseline reduction |
| Resolved | Seen anywhere before but absent now | Durable confirmed absence transition |
| Recurring | Does not exist | Durable resolved finding returns with explicit threshold |
| F, P, T | Does not exist | Defined supplementary calculations |
| Session | No real session boundary | Explicit completed observation session |
| Trend count | Counts CWE/type groups | Counts fingerprinted instances, grouped by type in UI |
| Toggle handling | Does not exist | Identical-restoration flag and counters |
| Incomplete session | Does not have a completed-session model | Uses incomplete/abandoned state and excludes it from cross-session metrics |

> The main current files are:

```text
src/modules/tracker/analysis/snapshotAnalyzer.ts
src/modules/tracker/analysis/analysisTypes.ts
src/modules/detection/bridge/convert.ts
src/modules/tracker/storage/sessionStore.ts
src/modules/detection/bridge/documentEvents.ts
src/extension.ts
```

## 13.1 Current implementation caveats to preserve in the handoff

> We also need to remember these current code problems:
>
> 1. Current persistence means only “same broad type in the latest two scans.” It is not time-based.
> 2. Current resolved tracking looks through all saved history and can report the same resolution more than once.
> 3. Saving scans is asynchronous. Fast results can cause write-order problems unless we serialize persistence.
> 4. The Rust result payload does not yet include all scope and structure data needed for stable matching.
> 5. Severity cards count occurrences, while trend tracking currently uses different units. The final framework fixes this by using finding instances for trend totals.
> 6. Current scan results do not keep an analysis-context fingerprint, document-version/content identity, or lifecycle sequence. A scope change or late old scan could create a false transition.
> 7. Current grouping does not do versioned one-to-one matching for duplicate identical occurrences. It cannot safely award partial-fix credit when matching is unclear.
> 8. Current workspace-state history is not a completed-session model. A shutdown or failed final scan needs an explicit incomplete-session rule.

**Key point to emphasize:** We must present the final framework as proposed work until the implementation and tests are complete.

---

# 14. Required implementation order

> The order matters. We should not calculate advanced scores before we can reliably identify the same finding.

> Step one: add stable, versioned identity data. We need logical, content, scope, and duplicate-occurrence identifiers, plus conservative one-to-one matching.

> Step two: add an accepted-observation envelope. Every scan needs its analysis-context fingerprint, session ID, monotonic sequence, document version/content hash, and timestamps. We reject stale or incomparable results for Trends.

> Step three: add real session start, end, and final checkpoint behavior. We also need incomplete-session recovery, active comparable persistence windows, and a serial storage queue.

> Step four: separate live scans from settled scans. Live warnings stay fast, but only accepted settled scans control trend transitions.

> Step five: add lifecycle records. This includes persistence-window confirmations, absence grace period, provisional resolution, durable resolution, recurrence, identical restoration, and ambiguity fields.

> Step six: add F, P, T, F_cross, and P_cross. We do this only after comparable, unambiguous baseline matching works.

> Step seven: update the Trends card and notifications. The card counts instances and groups them by type. It uses only the four public statuses.

> Step eight: test with recorded histories and tune the 30-second, two-confirmation, and five-second starting values before research reporting.

---

# 15. Required acceptance tests

> Before we use the framework for research reporting, these cases must pass.

| Test case | What must happen |
|---|---|
| Lines are inserted above a finding | The same finding keeps its lifecycle. It does not become new or resolved because its line moved. |
| Same variable name in different places | Findings in different files or methods stay separate. |
| Two identical risky expressions are in the same scope | One-to-one matching keeps them separate. If it cannot, Ariadne marks the cohort ambiguous and gives no transition or score credit. |
| The fingerprint algorithm changes | Ariadne does not match old and new fingerprints automatically unless a validated migration exists. |
| Engine/core/transport failure | Ariadne does not count a resolution or remediation event. |
| Rule set, engine, parser, file scope, ignore, or exclusion settings change | The scan is incomparable. It cannot resolve, recur, confirm persistence, or change F/P/T/cross-session scores. An explicit re-baseline starts a new cohort. |
| Continuous typing | Interim scans do not create confirmed trend changes. |
| A slow scan of old code returns after a newer scan | Ariadne discards the old result for Trends. It cannot overwrite the accepted state or final checkpoint. |
| Brief absence then return | The finding does not become Resolved. |
| Absence remains through later confirmation | One durable Resolved transition occurs. |
| VS Code deactivates or restarts before a final comparable checkpoint | The session is incomplete or abandoned and is excluded from every cross-session numerator and denominator. |
| A finding appears in a new session after a long inactive gap | Its history remains, but inactive wall-clock time does not satisfy the current persistence window. |
| Baseline count falls but remains above zero | The finding becomes Improving and F/P are correct. |
| Count rises | The finding stays Persisting; details show the increase; no new public status appears. |
| New finding after a baseline | It receives a separate lifecycle and does not break the old ratio. |
| Identical code disappears then returns in one session | Toggle/identical-restoration counter increases and no durable fix is counted. |
| Changed code returns after durable resolution | A recurrence transition is recorded. |
| Identical finding returns after provisional resolution | The provisional resolution is canceled and F_cross gets no fix credit. |
| One recurrence return | It is recorded in data but does not yet show as public Recurring Pattern. |
| Sessions before first detection | They do not enter the cross-session denominator. |
| Two same-type findings have different histories | They keep separate statuses and are grouped correctly in the UI. |
| Fast engine results | Storage stays ordered and no trend data is overwritten. |
| Code stays commented, suppressed, or otherwise absent without a scope change | Ariadne reports durable scanner absence only; it makes no claim about semantic correctness, intent, or learning. |

> These tests are not optional. They are what make the framework safe enough for research use.

---

# 16. Final statement for lead review

> The final framework can be summarized in one statement.

> Ariadne will track stable, context-aware finding instances across accepted, valid, settled, comparable observations and completed sessions. It will report Persisting, Improving, Resolved, and Recurring findings. It will group those instances by vulnerability type in the interface. It will use active comparable observed time, not scan count or inactive wall-clock time, to decide persistence. F measures matched-baseline detector absence or remediation. P measures severity-weighted residual burden. T compares remediation across comparable completed sessions. A resolution stays provisional until later comparable absence confirms it. Scope changes, stale results, ambiguous matches, and incomplete sessions cannot create credit or transitions. Identical restoration is a data-quality flag, not a claim about student behavior. All results are observations and do not prove intent, permanent remediation, semantic security, or secure-coding understanding.

> In plain language: we will be careful about what we count, careful about when we call something fixed, and careful about what research claims we make.

---

# 17. Lead approval checklist

> Before we start implementation, we need the lead to approve these exact decisions.

> 1. Keep only the four public statuses: Persisting, Improving, Resolved, and Recurring.
>
> 2. Track stable finding instances first, then group them by type in the interface.
>
> 3. Approve the versioned fingerprint scheme, the one-to-one duplicate matching rule, and what happens when matching is ambiguous.
>
> 4. Define what counts as a valid, settled, and comparable observation, including the analysis-context fingerprint.
>
> 5. Approve the stale-result rule: session sequence plus document version/content identity before applying a scan.
>
> 6. Approve the starting values: 30 seconds, two settled confirmations, and five-second absence grace period, plus the active comparable persistence-window rule.
>
> 7. Define how a session starts, ends, and produces an accepted comparable final checkpoint. Approve the incomplete or abandoned-session rule.
>
> 8. Approve the exact meanings of F, P, T, and the severity weights.
>
> 9. Approve that cross-session denominators use only eligible comparable sessions after first detection.
>
> 10. Approve that F_cross receives detector-absence/remediation credit only after durable confirmed resolution.
>
> 11. Approve that public Recurring Pattern requires two confirmed reappearances.
>
> 12. Approve Identical Restoration as an internal integrity flag that does not receive durable-fix credit.
>
> 13. Approve the research claim limits: Ariadne reports observed scanner behavior, not student intent, semantic security, or guaranteed learning.
>
> 14. Approve the acceptance-test gate, including scope-change, stale-result, duplicate-match, and incomplete-session tests.

> Once the lead approves these items, we can move to implementation in the order we discussed.

---

# Closing sentence

> The framework is now detailed enough to implement, test, and defend. Our next job is not to change the idea again. Our next job is to build it carefully and prove it works with the acceptance tests.
