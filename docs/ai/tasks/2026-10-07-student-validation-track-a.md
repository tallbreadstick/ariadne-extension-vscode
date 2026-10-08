<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Student Validation Track A: Annotation Branding, Hover, Status Bar & Onboarding

## Summary

- task: Implement Track A UI/UX refinements addressing student validation testing feedback.
- requested outcome: Distinct [Ariadne] inline branding, reframing "Ask Ariadne" to "Explain Vulnerability", single authoritative status bar total, and post-login/activation panel auto-reveal with onboarding orientation.
- primary constraint: Do not re-introduce Problems panel entries; preserve ErrorLens-style highlight; adhere to VS Code UX standards.

## Linked artifacts

- spec: none
- plan: docs/plans/2026-10-07-student-validation-ui-ux-masterplan.md

## Current state

- status: in progress
- current owner: Abel
- next action: Implement Step 2 (Session resolution progress and next focus target modeling)
- blockers: none
- last checked: 2026-10-08

## Progress checklist

- [x] Task A1: Add `[Ariadne]` prefix to end-of-line decorations in DiagnosticManager.ts
- [x] Task A2: Reword hover popup CTA to code-pill button with `$(lightbulb)` icon in HoverProvider.ts
- [x] Task A3: Update status bar text to single authoritative total (`$(shield) Ariadne: N Issues`) and click command in statusBar.ts
- [x] Task A4: Add auto-open panel on sign-in and first-run welcome onboarding toast in extension.ts
- [x] Task A5: Move search bar into filter drawer, rename tab to ACTIVE VULNERABILITIES, and align header with Live Scan badge
- [x] Validation: Typecheck and lint (`npm run check-types`, `npm run lint`, `npm run compile`) passed with 0 errors

## Scope

- in scope: DiagnosticManager.ts, HoverProvider.ts, statusBar.ts, extension.ts, relevant test assertions.
- out of scope: Track B files (activeVulnerabilities.ts, sessionMetrics.ts, notificationToast.ts).

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Abel & AI Pair
- implementer: Abel & AI Pair
- reviewer: Renz
- tester: Abel

## Relevant files

- src/modules/presentation/diagnostics/DiagnosticManager.ts: End-of-line decoration branding
- src/modules/presentation/diagnostics/HoverProvider.ts: Markdown hover button link reframing
- src/modules/tracker/views/statusBar.ts: Status bar text simplification
- src/extension.ts: Auto-open panels on sign-in and startup, first-use welcome toast
- src/test/sidebarSettings.test.ts: Test suite verification
- src/test/extension.test.ts: Test suite verification

## Acceptance criteria

- End-of-line annotations render `[Ariadne]` prefix preceding finding names.
- Hover popup CTA reads `$(sparkle) Explain Vulnerability` styled as a button link.
- Status bar displays single aggregate total count matching active vulnerabilities.
- Signing in or launching on a Java workspace with findings reveals the bottom panel and provides clear orientation.
- TypeScript compilation and linter pass with 0 errors.

## Validation

- command 1: npm run check-types
- command 2: npm run lint
- command 3: npm run compile
- command 4: npm test

## Risks or dependencies

- risk 1: Ensure status bar text handles 0 issues ("All Clear") gracefully without broken layout.
- dependency 1: Hover link arguments must match the `openFeedbackPanel` command payload signature.

## Handoff notes

- notes for the next agent: Track A runs in parallel with Track B. Do not modify Track B files to avoid git conflicts.
