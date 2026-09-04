<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Task Brief: Trends Collapsible Chevrons + Third Panel Split Section

## Summary

- task: UI-only update to the Session Metrics panel — collapsible trend rows and a new third section
- requested outcome: Four collapsible chevron rows in the Trends section; a horizontally split third section with Common Vulnerabilities (left) and Notifications (right), both independently scrollable; Notifications restyled to match the card container of Common Vulnerabilities
- primary constraint: UI/layout only — no backend logic, calculations, or F/P/T values; use placeholders for unimplemented data; do not implement other overhaul tasks

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: in progress
- current owner: Antigravity (RENCE's UI task)
- next action: implement changes in sessionMetrics.ts and panelTypes.ts
- blockers: none
- last checked: 2026-09-04

## Progress checklist

- [x] Create branch feature/ui-trends-chevron-split-panel
- [ ] Add optional sub-item fields to TrendData in panelTypes.ts
- [ ] Rewrite Trends section in sessionMetrics.ts with collapsible rows (all 4 start collapsed)
- [ ] Add split third section: Common Vulnerabilities left + Notifications right
- [ ] Update Notifications UI to match card container style
- [ ] Validate: npx tsc --noEmit
- [ ] Commit

## Scope

- in scope: sessionMetrics.ts CSS + HTML + JS, panelTypes.ts TrendData optional fields
- out of scope: F/P/T calculation logic, fingerprinting, lifecycle states, scanning process changes, FLC records, any other overhaul tasks

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: RENCE
- tester: RENCE

## Relevant files

- src/modules/tracker/views/sessionMetrics.ts
- src/modules/presentation/panelTypes.ts

## Acceptance criteria

- Trends section has four collapsible rows; each has a chevron that rotates on toggle
- All four rows start collapsed; clicking header expands/collapses sub-items
- Sub-items show placeholder data when real data is absent
- Improving Trends sub-items show color-coded progress labels (Some/Clear/Major progress)
- Third section has Common Vulnerabilities and Notifications side by side
- Both panels scroll independently
- Notifications uses same card/container visual style as Common Vulnerabilities
- Dismiss animation on notification cards still works
- npx tsc --noEmit passes with no errors

## Validation

- command 1: npx tsc --noEmit

## Risks or dependencies

- risk 1: When real sub-item data is wired in later, callers of buildSessionMetricsHtml must populate the new optional TrendData fields; document this in handoff notes

## Handoff notes

- notes for the next agent: TrendData now has optional `persistingItems`, `improvingItems`, `recurringItems`, `resolvedItems` fields. Wire these from snapshotAnalyzer.ts when F/P/T calculation is implemented. The Common Vulnerabilities section is a placeholder — its content will be populated as part of the Common Vulnerabilities overhaul task assigned to ERVIN.
