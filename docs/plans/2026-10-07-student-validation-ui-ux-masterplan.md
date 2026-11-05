# Student Validation UI/UX Refinement Masterplan

**Date:** 2026-10-07  
**Active Working Branch:** `feat/vuln-highlighting` (contains `feat/ui-overhaul` + latest commits `a17115a`, `eee7024`, `f68ca3d`)  
**Owners:** Abel & Renz  
**Sources:**  
- Student Validation Report (`docs/validation/Ariadne_Detailed_Initial_Validation_Report.md`)  
- Team Meeting Alignment Notes (2026-10-06 / 2026-10-07)  
- Codebase Audit of `feat/vuln-highlighting` (2026-10-07)  
- Pedagogical Guardrails (SRS & SDD Module 1–4 specifications)

---

## 1. Executive Summary & Audit of Latest Pushed Commits

We fetched and checked out `feat/vuln-highlighting` (which incorporates `feat/ui-overhaul`). A detailed code audit of the recent commits (`a17115a`, `eee7024`, `f68ca3d`) confirms that several items discussed last night have **already been implemented and verified**:

### ✅ Completed in `feat/vuln-highlighting`:
1. **Problems Panel Pollution Removed (`f68ca3d`):**
   - `diagnosticCollection = vscode.languages.createDiagnosticCollection("ariadne")` and `_publishDiagnostics` have been **completely removed** from [`DiagnosticManager.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/diagnostics/DiagnosticManager.ts).
   - Zero-width entries no longer pollute the native Problems panel or cause count mismatches.
2. **Squiggly Underlines Removed (`eee7024`):**
   - In [`DiagnosticManager.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/diagnostics/DiagnosticManager.ts), `textDecoration: underline wavy ${color}` was removed.
   - Editor annotations now use ErrorLens-style background highlight tints (`backgroundColor: bg`) plus overview-ruler dots.
   - Added `setHighlightsVisible(visible: boolean)` to toggle highlights.
3. **Sidebar Settings Overhaul (`a17115a` & `f68ca3d`):**
   - In [`signInPanel.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/feedback/views/signInPanel.ts) and [`package.json`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/package.json):
     - Added Core section with a toggle switch to show/hide editor vulnerability highlights.
     - Added scanner target selection, release downloads, and binary health status banner.
     - Renamed sidebar view to "Ariadne" with commands `openPanel` and `openSettings`.

---

## 2. Remaining Work Breakdown & Ownership

```
┌─────────────────────────────────────────────────────────────┐
│                 TRACK A — ABEL                              │
│  Annotation Branding, Hover Reframing, Status Bar Count,    │
│  Auto-Open & First-Run Onboarding                           │
│                                                             │
│  Files: DiagnosticManager.ts, HoverProvider.ts,             │
│         statusBar.ts, extension.ts                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 TRACK B — RENZ                              │
│  Active Vulnerabilities Panel, Session Metrics Dashboard,   │
│  Trends Interactivity, Common Vulns & Gamification          │
│                                                             │
│  Files: activeVulnerabilities.ts, sessionMetrics.ts,        │
│         notificationToast.ts, panelTypes.ts                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Track A: Annotation Branding, Hover, Status Bar & Onboarding
**Assigned to:** Abel  
**Primary Files:** `src/modules/presentation/diagnostics/`, `src/modules/tracker/views/`, `src/extension.ts`

### Task A1: Annotation Label Branding (`[Ariadne]` Prefix)
- **Status:** Pending  
- **Problem:** While squiggles are gone, the end-of-line text (e.g. `Return Mutable Internal Reference`) still lacks Ariadne branding, so students can still mistake it for a generic comment or compiler text (Theme 5 / R4, R15, R16, R20).
- **Implementation:**
  - In [`DiagnosticManager.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/diagnostics/DiagnosticManager.ts#L170-L179):
    - Update `contentText` in `after` renderOptions:
      ```typescript
      contentText: `  [Ariadne] ${lineFindings.map((f) => f.vulnerabilityName).join("  ·  ")}`,
      ```
- **Verification:** Save `Student.java`; observe `[Ariadne] Return Mutable Internal Reference` at end of line.

### Task A2: Hover Popup "Explain Vulnerability" Button Reframing
- **Status:** Pending  
- **Problem:** In [`HoverProvider.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/diagnostics/HoverProvider.ts#L115), the CTA still reads `*[Ask Ariadne →](...)*`. This primed students to expect a conversational chatbox (Theme 4 / Task 4). Abel noted: *"Ask ariadne try to make a button in hover"*.
- **Implementation:**
  - In [`HoverProvider.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/diagnostics/HoverProvider.ts):
    - Change link text to **`$(sparkle) Explain Vulnerability`**.
    - Style as an explicit markdown button:
      ```typescript
      md.appendMarkdown(`\n\n[$(sparkle) Explain Vulnerability](command:ariadne-extension-vscode.openFeedbackPanel?${commandArgs} "View structured security explanation")\n\n`);
      ```
- **Verification:** Hovering over highlighted code displays `$(sparkle) Explain Vulnerability` button that opens `feedbackPanel.ts`.

### Task A3: Authoritative Status Bar Total Count
- **Status:** Pending  
- **Problem:** Currently displays multi-segment cascade (`X Critical · Y High`) which confused students during Task 2. Abel noted: *"Ariadne status bar, total number of vulns instead of 2 high 6 medium"*.
- **Implementation:**
  - In [`src/modules/tracker/views/statusBar.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/statusBar.ts):
    - In `buildStatusText`:
      - If total > 0: `$(shield) Ariadne: ${total} Issues`
      - If total === 0: `$(check) Ariadne: All Clear`
    - Keep the full severity breakdown inside `buildTooltip`.
- **Verification:** Status bar displays single total (`$(shield) Ariadne: 12 Issues`); hover tooltip shows full breakdown.

### Task A4: Auto-Open Panels on Sign-in & Startup + First-Run Onboarding
- **Status:** Pending  
- **Problem:** Bottom panel requires `Ctrl+J` which ~45% of students did not know (Themes 1 & 3, Expert Scenario 1). Renz noted: *"Once user sign - automatically open ariadne bottom panel and side panel."* Abel noted: *"Student needs onboarding on what Ariadne is so that they know what to expect"*.
- **Implementation:**
  - In [`src/extension.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/extension.ts):
    - Add helper `revealAriadnePanels()` executing:
      ```typescript
      vscode.commands.executeCommand('ariadne.panel.activeVulnerabilities.focus');
      ```
    - Trigger `revealAriadnePanels()`:
      1. Immediately upon successful GitHub sign-in.
      2. On extension activation when an active Java project contains findings.
    - On first workspace launch (tracked via `globalState.get('ariadne.hasSeenWelcome')`):
      - Show an informational welcome toast:
        `"Welcome to Ariadne! We are actively monitoring your Java code for security vulnerabilities. Ariadne provides guided explanations to help you fix issues independently."`
        - Actions: `[Open Panel (Ctrl+J)]`, `[Got it]`.
- **Verification:** Signing in or activating the extension immediately surfaces the bottom panel with orientation tips.

---

## Track B: Active Vulnerabilities, Session Metrics & Gamification
**Assigned to:** Renz  
**Primary Files:** `src/modules/presentation/views/`, `src/modules/tracker/views/`, `src/modules/tracker/analysis/`

### Task B1: Finding Cards "Explain Vulnerability" Action Button & Sticky Header
- **Status:** Pending  
- **Problem:** Finding cards in `activeVulnerabilities.ts` still use "Ask Ariadne" and lack a prominent direct CTA button next to the file link.
- **Implementation:**
  - In [`src/modules/presentation/views/activeVulnerabilities.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/views/activeVulnerabilities.ts):
    - Replace card "Ask Ariadne" links with a styled button:
      `<a class="btn btn-explain" href="${feedbackHref}" title="View AI conceptual explanation"><svg class="sparkle-icon">...</svg> Explain Vulnerability</a>`
    - Add sticky header at the top of the findings list:
      `<div class="active-vuln-header"><h3>Active Vulnerabilities</h3><span class="total-badge">${vulns.length} Issues Total</span></div>`
- **Verification:** Each card displays a clear, clickable `Explain Vulnerability` button that opens the explanation panel.

### Task B2: Terminology Refinement ("Scan" → "Report")
- **Status:** Pending  
- **Problem:** Renz noted: *"Full Scan - replace with Full Reports"*. Abel noted: *"Reword 'Full scan' to 'Full Report'. In persisting pattern from trends UI: 'present since __ reports'"*.
- **Implementation:**
  - In [`src/modules/tracker/views/sessionMetrics.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/sessionMetrics.ts):
    - Replace `"Auto Full Scan"` and `"Full Scan Interval"` with **`"Auto Full Report"`** and **`"Full Report Interval"`**.
    - Replace `"Run Full Scan Now"` with **`"Generate Full Report Now"`**.
    - In Persisting Patterns subtitle: change `"Present across X scans"` to **`"Present across X reports"`** or **`"Present since X reports"`**.
- **Verification:** No user-facing text in Session Metrics references "Full Scan"; all labels read "Full Report".

### Task B3: Session Context Badge
- **Status:** Pending  
- **Problem:** Session boundaries were completely invisible (§3.4). Renz & Abel noted: *"Add session label besides to it / for example 'Pulled from previous session'"*.
- **Implementation:**
  - In [`sessionMetrics.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/sessionMetrics.ts):
    - In the panel header next to "Session Metrics", render a session status badge:
      `<span class="session-badge current">Current Session</span>`
      (or `<span class="session-badge restored">Previous Session (Restored)</span>` when displaying restored prior session metrics).
- **Verification:** Header clearly displays the session origin badge.

### Task B4: Trends Interactivity & Explanatory Tooltips
- **Status:** Pending  
- **Problem:** Trends felt like a static data bank (§3.5). Renz noted: *"Trends - give a short description / Tooltip - Trends"*, *"Hyperlink that auto filters active vulnerabilities when clicked"*. Abel noted: *"Session metric cards clickable filtering active vulnerabilities"*.
- **Implementation:**
  - In [`sessionMetrics.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/sessionMetrics.ts):
    - Add tooltip / subtitle explanations:
      - **Trends:** *"Compares current vulnerabilities against previous reports to highlight progress and unresolved risks."*
      - **Persisting Patterns:** *"Vulnerabilities that remain unaddressed across multiple reports."*
      - **Improving Trends:** *"Vulnerabilities where occurrences are decreasing."*
    - Add click handlers posting messages to extension host:
      - Clicking any severity card (Critical, High, Medium, Low) posts `{ type: 'filter-severity', severity: 'critical' }`.
      - Clicking a trend item or common vulnerability type posts `{ type: 'filter-type', vulnType: item.type }`.
  - In [`AriadneViewProvider.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/AriadneViewProvider.ts) / [`vulnFilters.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/presentation/views/vulnFilters.ts):
    - Handle `filter-severity` and `filter-type` messages to switch focus to Active Vulnerabilities and apply the matching filter.
- **Verification:** Clicking the "Critical" card in Session Metrics automatically switches to Active Vulnerabilities filtered to Critical issues.

### Task B5: Improving Trends Categorical Display & Notification Feed Removal
- **Status:** Pending  
- **Problem:** Raw 0–10 scores were arbitrary; the in-panel notification feed was redundant. Renz & Abel noted: *"Improving Trends - Remove score but keep category indicator"*, *"Remove Notification Section in panel"*.
- **Implementation:**
  - In [`sessionMetrics.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/sessionMetrics.ts):
    - In `buildImprovingSubItems`, remove the numeric score badge (e.g. `+1.8`).
    - Keep and emphasize the categorical progress badge:
      `<span class="progress-pill progress-clear">Clear progress</span>`
    - Remove the entire Notification Feed container (`#notification-feed-card`, lines 520–540) and associated styles.
- **Verification:** Improving Trends renders clean progress badges with no numeric scores; notification feed is gone.

### Task B6: Common Vulnerabilities Graduation Toast & Gamified Summary
- **Status:** Pending  
- **Problem:** Graduation occurred silently without motivating the student. Abel noted: *"reward something or gamify... add a great job something"*. Renz noted: *"toast notification, notify user that this vulnerability has been resolved and hasn't appeared in consecutive sessions... 'good job' type of feedback"*.
- **Implementation:**
  - In [`src/modules/tracker/views/notificationToast.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/notificationToast.ts):
    - When a common vulnerability graduates across consecutive sessions:
      `vscode.window.showInformationMessage(\`🎉 Great job! "\${graduatedVuln.name}" has graduated — not detected across consecutive sessions!\`);`
  - In [`sessionMetrics.ts`](file:///home/zdrco/Projects/School/ariadne-project/ariadne-extension-vscode/src/modules/tracker/views/sessionMetrics.ts):
    - In Common Vulnerabilities, add an achievement summary pill:
      `<div class="common-vuln-summary"><span>\${graduatedCount} of \${totalCommon} Common Weaknesses Overcome!</span></div>`
- **Verification:** Graduation triggers a celebratory toast, and the Common Vulnerabilities section highlights the milestone.

---

## 3. Definition of Done
- [x] Native Problems panel is completely free of Ariadne entries. *(Verified in `feat/vuln-highlighting`)*
- [x] Inline annotations show clean background tints without squiggles. *(Verified in `feat/vuln-highlighting`)*
- [x] Sidebar settings overhauled with highlight toggle and scanner health. *(Verified in `feat/vuln-highlighting`)*
- [x] End-of-line labels include `[Ariadne]` prefix. *(Track A)*
- [x] "Ask Ariadne" reworded to "Explain Vulnerability" on hover. *(Track A)*
- [x] Status bar shows authoritative total count (`$(shield) Ariadne: 12 Issues`) and opens panel on click. *(Track A)*
- [x] Panels auto-reveal on sign-in and startup with orientation tips. *(Track A)*
- [ ] "Ask Ariadne" reworded to "Explain Vulnerability" on cards. *(Track B)*
- [ ] "Full Scan" replaced with "Full Report" throughout Session Metrics. *(Track B)*
- [ ] Session context badge rendered next to Session Metrics header. *(Track B)*
- [ ] Trends items and metric cards cross-filter the Active Vulnerabilities panel. *(Track B)*
- [ ] Improving Trends displays categorical badges without numeric scores. *(Track B)*
- [ ] In-panel notification feed removed. *(Track B)*
- [ ] Common vulnerabilities graduation triggers celebratory toast & summary. *(Track B)*
- [x] `npm run compile` succeeds with 0 errors.
