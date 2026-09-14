# Ariadne Trends Framework — Handoff for a New Chat

**Purpose:** Give a new chat enough accurate context to continue the framework discussion without repeating rejected designs.

**Read this first:** This is a **design handoff**, not implemented behaviour. Ariadne's current code still saves raw snapshots and derives type-level statuses from adjacent snapshots. The proposed lifecycle/session framework has not been implemented.

## 1. Important correction: do not carry forward the last proposed answer

The immediately preceding proposal to use **one original baseline set per vulnerability key**, put later findings in a `new since baseline` bucket, and show one simple roll-up row was not approved by the lead. Do **not** present it as a decision or implement it.

The earlier “one new baseline group for every later instance of the same vulnerability key” design is also **not approved**. The lead considers that approach potentially too complicated for the desired panel.

The open problem is therefore:

```text
How should Ariadne calculate and display one vulnerability's F, P, T,
resolved/open/new/recurring information when its individual FLC instances
change over several sessions, without making the UI difficult to understand
or changing the meaning of the metrics without an explicit decision?
```

Do not solve this by silently inventing a new baseline rule. Explain the alternatives, their exact maths, their UI effect, and ask for/record an explicit lead decision before calling any one final.

---

## 2. What is known about the current code (facts, not proposals)

| Area | Current behaviour |
|---|---|
| Live scan trigger | A tracked-file edit schedules Rust analysis with a 300 ms debounce. |
| Tracked files | `.java`, `application.properties`, `.gitignore`, and `.env`. |
| Save trigger | There is **no** `onDidSaveTextDocument` Trends/measurement listener yet. Adding it is proposed work. |
| Rust protocol | Rust currently emits a bare `VulnerabilityMetadata[]`; there is no request ID, reason, revision marker, success/complete envelope, or final-session reason. |
| Current status calculation | The extension stores raw snapshots and compares the latest type-level count against the immediately previous snapshot. |
| Current shutdown | `deactivate()` returns immediately; a disposable stops the Rust process. There is no asynchronous final-session scan today. |

Relevant implementation files:

```text
ariadne-extension-vscode/src/modules/detection/bridge/documentEvents.ts
ariadne-extension-vscode/src/modules/detection/bridge/messages.ts
ariadne-extension-vscode/src/modules/detection/bridge/iostream.ts
ariadne-extension-vscode/src/modules/tracker/analysis/analysisTypes.ts
ariadne-extension-vscode/src/modules/tracker/analysis/snapshotAnalyzer.ts
ariadne-extension-vscode/src/modules/tracker/storage/sessionStore.ts
ariadne-extension-vscode/src/extension.ts
ariadne-core/src/cli/session.rs
```

---

## 3. Working design points from the team discussion

These are the current working assumptions. A new chat must distinguish them from the **open metric/UI decision** in Section 5.

1. **Real-time UI remains.** Live scan results may update diagnostics and the active-vulnerabilities UI.
2. **Trends data is more conservative than live UI data.** Only a trusted measurement result may update lifecycle/session Trends records.
3. **Measurement candidate:** saving a tracked file triggers a full-workspace measurement scan. This must be added; it is not in the current code.
4. **Two-second delay:** after a matching, successful measurement result returns, the workspace must remain unchanged for two seconds before the result can be used for Trends. The scan is sent immediately on save; the two seconds is a gate after the result, not a delay before scanning.
5. **Two gates only:**

   ```text
   valid   = matching request/revision, successful, complete result
   settled = valid result and no tracked-file change during the 2-second window
   ```

   The older extra term `accepted` should not be reintroduced as a third state.
6. **FLC is per finding instance.** A scanner-reported SQL finding in one code context has its own FindingLifecycleRecord. Five distinct SQL findings normally mean five FLCs.
7. **Public statuses should stay limited:** Persisting, Improving, Resolved, and Recurring. `candidate` and `provisional resolution` may exist internally but must not become extra public Trends statuses.
8. **Persisting:** requires the finding/pattern to still be present, at least two settled detections, and at least 30 seconds observed duration. The exact aggregation unit for a vulnerability-level Persisting display is part of the open decision below. Note: persisting pattern which is displayed in the ui based  on calculation. Persisting status is for the lifecycle status. They are two different things, which could be confusing. We could rename the persisting status to active, but the rule is the same, just the name is different.
9. **Resolution:** one settled absence is provisional only. A later settled absence at least five seconds later is required for durable resolution. A timer by itself must not mark a finding resolved.
10. **Cross-session aggregate `F_cross` and `P_cross` are removed.** Pairwise `T` was previously proposed as a comparison of a current completed session to the prior comparable completed session, but the metric unit must be settled together with the baseline decision.
11. **Session start:** do not create a session merely on activation. The intended trigger is the first valid, settled measurement scan after activation.
12. **Session end:** proposed to use an asynchronous final scan during extension deactivation, with a timeout and safe fallback/incomplete-session rules. This still needs implementation and careful verification.
13. **UI direction:** the lead's original recap gives a specific **collapsible Trends-card** proposal. The next discussion must preserve this shape unless the lead changes it:

   ```text
   Collapsed Trends card rows: one row per public status
     Persisting Patterns    <total instance count>
     Improving Trends       <total instance count>
     Recurring Patterns     <total instance count>
     Resolved This Session  <total instance count>

   Expanded status row:
     group its instances by vulnerability type
     then list each instance's file and line
   ```

   The collapsed number is an **instance count**, not a count of vulnerability types. This is a display decision from the original lead recap. It does not, by itself, decide how F/P/T are calculated when new same-type instances appear.

---

## 4. What needs a fresh, explicit decision

### 4.1 The metric/reporting unit is not final

The team agrees on the distinction below, but has **not approved** one of the calculation models:

```text
FLC = one finding instance
Panel row = likely one vulnerability type/key, such as SQL Injection
Open question = how the row's F, P, T are calculated when new instances
of that same type appear later
```

The next chat must compare these choices with numbers, not choose quietly:

| Choice | Core idea | Benefit | Cost / meaning change |
|---|---|---|---|
| Fixed baseline membership | F/P/T use only instances present in a fixed initial set. Later same-type instances are separately reported. | F and T keep the meaning “progress on the original set.” | Panel needs clear separate counts for later instances; one simple score cannot represent all current instances. |
| Expanding per-vulnerability membership | Every later same-type FLC joins the one vulnerability total. | One direct row/score can say how many have ever been seen, resolved, and remain. | `B` changes; F/T become a **net vulnerability-category health** measure, not progress on one fixed original problem set. |
| Separate baseline groups | Each set first seen at a different time gets separate F/P/T. | Each metric has a fixed denominator. | More difficult to present; lead has not approved it. |

It is valid to prefer the second choice if the lead wants a simple overall category score, but the formula labels and thesis claims must be updated accordingly. It is invalid to use an expanding denominator while still claiming F/T describe a fixed original baseline.

### 4.2 Panel design is not final

The current UI and the original proposed UI must not be confused:

| Area | Current UI | Original lead proposal |
|---|---|---|
| Active Vulnerabilities panel | Already has a collapsible card for each raw finding. Its collapsed header shows severity, CWE/title, and file location; expanding it shows details. | No confirmed change from the recap. |
| Session Metrics severity cards | Flat cards for Critical, High, Medium, and Low current counts. | Remain separate from Trends. |
| Trends card | Three flat count rows: Persisting, Improving, Resolved; no expansion. | One collapsible row per public Trends status, including Recurring; collapsed count is total instances, expanded content groups the instances by vulnerability type and then location. |

The next chat should answer:

- How is an FLC placed in exactly one status row without hiding its vulnerability type, recurrence history, or confirmation state?
- What happens when one vulnerability type has instances in different status rows at the same time?
- Where, if anywhere, should F/P/T appear, and what exactly do they mean at that level?
- How are a recurrence of an old FLC and a brand-new same-type FLC distinguished in the expanded UI?

---

## 5. Required five-scenario walkthrough for the next chat

For every scan in every scenario, the next chat must show:

```text
trigger -> raw/live UI result -> valid? -> 2-second settled?
-> FLC changes -> SessionRecord changes -> panel collapsed/expanded state
-> F/P/T calculation or why it is N/A -> public status
```

It must explicitly state whether an instance is an old matched FLC, a recurring FLC, or a new FLC. It must not call an absence a durable fix until the second settled absence has occurred.

### Scenario 1 — First use: no previous scan or session

```text
No FLCs, no SessionRecords, no existing Trends baseline.
Open the extension/workspace.
```

Resolve:

- Does initial/live scan run immediately? What does the UI say before a first save?
- Does the first save trigger a scan immediately, then wait two seconds for settlement?
- What happens if it is valid but the student edits during the two seconds?
- What exact empty/loading/pending-state text should the collapsible Trends panel show?
- When are the first SessionRecord and FLCs created?

### Scenario 2 — Later activation: Session 2

```text
At least one completed SessionRecord and its FLCs already exist.
The extension activates again, then the student edits and saves.
```

Resolve:

- What previous information is restored for display?
- Does restoring history create Session 2? (Expected working assumption: no.)
- Exactly when does Session 2 begin?
- How does the first settled Session 2 result update existing FLCs and panel values?
- Which value is a previous-session reference, and which is a fixed baseline? Do not overwrite the historical record.

### Scenario 3 — All prior instances fixed, then a new same-type instance appears

```text
Example: five SQL Injection FLCs were present earlier.
All five reach durable resolution.
Then a settled scan finds one SQL Injection instance that does not match any old FLC.
```

Resolve:

- How is that new SQL FLC created and classified?
- What are the exact collapsed and expanded SQL panel values?
- What happens to F, P, and T under each candidate metric model?
- Is the old work still shown as fixed? Is the new currently open problem visible immediately?
- Which model best fits the lead’s desired simple UI, and what definition must accompany it?

### Scenario 4 — Nothing from Scenario 3 is fixed; another new same-type instance appears

```text
The Session 3 new SQL instance remains open.
In Session 4, another unmatched SQL instance appears.
```

Resolve:

- How many SQL FLCs exist and what is each FLC's state?
- What does the collapsed SQL row show without hiding either open instance?
- How do F, P, and T change under the candidate models?
- Does the UI show one expanded list of instances, multiple groups, or another approved structure?
- What is Persisting, Improving, Resolved, or Recurring at this point, and why?

### Scenario 5 — Accidental close

```text
The student saves a fix, but VS Code/extension closes before a final-session
scan has produced a valid settled result.
```

Resolve:

- Difference between a successful earlier settled save and an unconfirmed last save.
- When safe fallback to the latest settled save is allowed.
- When the session is incomplete instead.
- What is retained after reopening, what is ignored for final-session metrics, and when the next session begins.
- What the UI says so the student does not mistake an incomplete session for a successful final Trends update.

---

## 6. Documents to provide to the next chat

Attach these in this order:

1. **This handoff file** — it prevents the new chat from treating rejected proposals as final.
2. **A screenshot of the current Trends UI.** The original lead recap's proposed collapsible layout is now described in Section 3, but the screenshot remains useful for dimensions and visual language.
3. [`ariadne_trends_framework_recap (1).md`]— historical source of the original UI proposal: separate severity/Trends cards, collapsible status rows, instance counts, and type/location grouping. Its formulas and storage decisions have later revisions, so use it only for the stated UI direction unless a later lead decision confirms more.
4. [`ariadne-trends-framework-final-implementation-walkthrough.md`](ariadne-trends-framework-final-implementation-walkthrough.md) — useful for the session, storage, request-correlation, fingerprint, and shutdown material. It has older conflicting metric wording, so it is reference material, not the final authority on F/P/T's unit.
5. [`ariadne-trends-framework-realtime-stability-and-cohort-clarification.md`](ariadne-trends-framework-realtime-stability-and-cohort-clarification.md) — use its save-triggered/two-second/valid-settled material. Its baseline-group conclusion is under review and must not be treated as approved.
6. The lead’s comments from today, preferably as a concise pasted list rather than the entire chat transcript.

Do **not** attach several older copies of the same walkthrough as if they are all authoritative. In particular, the copies in Downloads are useful historical reference but are not the latest workspace files and contain superseded wording such as `accepted observation` or earlier metric ownership. If they are attached, label them **historical only**.

The new chat has the same workspace only if it is opened against this project. If not, include the actual-code file list from Section 2, or attach the relevant source files as well.

---
