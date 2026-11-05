<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Task B1 Active Vuln Explain Button Sticky Header

## Summary

- task: Finding Cards "Explain Vulnerability" Action Button & Sticky Header
- requested outcome: Replace card "Ask Ariadne" links with a styled "Explain Vulnerability" button featuring a sparkle icon, and introduce a sticky header displaying "Active Vulnerabilities" with a total count badge.
- primary constraint: Follow VS Code theme variables, preserve responsive details layout and existing search/filter mechanisms.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: Antigravity & Renz
- next action: none
- blockers: none
- last checked: 2026-10-07

## Progress checklist

- [x] Add SPARKLE_SVG icon helper in activeVulnerabilities.ts
- [x] Update card CTA link to "Explain Vulnerability" with sparkle icon and updated class/styling
- [x] Add sticky header container with title and total badge above the findings stack / toolbar
- [x] Update client-side filtering script to update total badge / visible counts cleanly if needed
- [x] Validate compilation and styling

## Scope

- in scope: src/modules/presentation/views/activeVulnerabilities.ts, associated unit tests
- out of scope: Track A files, Session Metrics overhaul (Tasks B2-B5)

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: User (Renz)
- tester: Antigravity & User

## Relevant files

- src/modules/presentation/views/activeVulnerabilities.ts: Active vulnerabilities webview HTML/CSS builder
- src/test/activeVulnerabilities.test.ts: Tests for active vulnerabilities view rendering

## Acceptance criteria

- Finding cards render "Explain Vulnerability" with sparkle icon rather than "Ask Ariadne"
- Action button links directly to feedback panel via command URI
- Sticky header displays "Active Vulnerabilities" title and total issues count badge
- Header stays visible and styled properly when scrolling through finding cards
- npm run compile succeeds cleanly

## Validation

- command 1: npm run compile
- command 2: npm run workflow -- check

## Risks or dependencies

- risk 1: Sticky header layout clipping toolbar search or filter dropdowns. Must verify z-index and sticky offsets.
- dependency 1: none

## Handoff notes

- notes for the next agent: Task B1 focuses specifically on the Active Vulnerabilities panel header and card action buttons.
