<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Task B2 Terminology Refinement Scan to Report

## Summary

- task: Terminology Refinement ("Scan" -> "Report") and Persisting Patterns Subtitle
- requested outcome: In Session Metrics, replace "Full scan" with "Full Report", update signin copy, and add subtitle badge ("Present since X reports" / "Present across X reports") beside the count in persisting items inside the Persisting Patterns collapsible row.
- primary constraint: Consistent styling with Improving Trends sub-items (.sub-progress / .sub-subtitle).

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

- [x] Add optional reportCount and subtitle to TrendSubItem in panelTypes.ts
- [x] Update sessionMetrics.ts header from "Full scan" to "Full Report"
- [x] Add buildPersistingSubItems with subtitle badge ("Present since X reports")
- [x] Update CSS for .sub-subtitle and .persisting-subtitle
- [x] Track reportCount on FindingLifecycleRecord and VulnerabilityDelta
- [x] Populate reportCount in buildCurrentSessionMetrics and snapshotAnalyzer
- [x] Increment reportCount after successful full reports (performHourlySessionRollover)
- [x] Add unit tests verifying "Full Report" header and persisting subtitle in sessionMetricsView.test.ts and sessionMetrics.test.ts
- [x] Validate compilation and test execution

## Scope

- in scope: src/modules/presentation/panelTypes.ts, src/modules/tracker/views/sessionMetrics.ts, src/modules/tracker/analysis/lifecycleTypes.ts, src/modules/tracker/analysis/analysisTypes.ts, src/modules/tracker/analysis/snapshotAnalyzer.ts, src/extension.ts, src/test/
- out of scope: Tasks B3-B6

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: Antigravity
- implementer: Antigravity
- reviewer: User (Renz)
- tester: Antigravity & User

## Relevant files

- src/modules/presentation/panelTypes.ts: TrendSubItem definition
- src/modules/tracker/views/sessionMetrics.ts: Session Metrics HTML/CSS builder
- src/modules/tracker/analysis/lifecycleTypes.ts: FindingLifecycleRecord definition
- src/modules/tracker/analysis/analysisTypes.ts: VulnerabilityDelta definition
- src/modules/tracker/analysis/snapshotAnalyzer.ts: Snapshot analyzer & delta mapper
- src/extension.ts: Metric computation & full report rollover handler
- src/test/sessionMetricsView.test.ts: View unit tests
- src/test/sessionMetrics.test.ts: Unit tests for Session Metrics

## Acceptance criteria

- "Full scan" section header is reworded to "Full Report"
- Persisting Patterns items render subtitle ("Present since X reports" or "Present across X reports") beside the count
- Layout matches Improving Trends structure
- npm run compile passes with 0 errors

## Validation

- command 1: npm run compile
- command 2: npx mocha out/test/sessionMetrics.test.js

## Risks or dependencies

- risk 1: Subtitle wrapping on small screen widths; handle white-space and responsive layout cleanly.
- dependency 1: none

## Handoff notes

- notes for the next agent: Task B2 focuses on Session Metrics terminology and Persisting Patterns subtitles.
