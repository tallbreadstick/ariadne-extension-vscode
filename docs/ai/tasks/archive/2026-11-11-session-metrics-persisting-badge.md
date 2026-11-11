<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Session Metrics Persisting Badge

## Summary

- task: Move Persisting Patterns report-count subtitle beside the vulnerability label as an inline pill and shorten wording to "Across X reports".
- requested outcome: Prevent the report count from colliding visually with the right-aligned open instance count so users can preview Option A.
- primary constraint: Keep row heights uniform across Trends sections and avoid number-to-number adjacency.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: antigravity
- next action: none
- blockers: none
- last checked: 2026-11-11

## Progress checklist

- [x] Update Persisting Patterns sub-item layout to inline pill beside vulnerability name
- [x] Rename subtitle text from "Present since X reports" to "Across X reports"
- [x] Update unit tests and run validation

## Scope

- in scope: `sessionMetrics.ts`, `extension.ts`, `snapshotAnalyzer.ts`, `panelTypes.ts`, `sessionMetrics.test.ts`, `sessionMetricsView.test.ts`
- out of scope: Other Trends sections (`Improving`, `Recurring`, `Resolved`), scanner core

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: antigravity
- implementer: antigravity
- reviewer: user
- tester: antigravity

## Relevant files

- file or directory 1: `src/modules/tracker/views/sessionMetrics.ts`
- file or directory 2: `src/modules/tracker/analysis/snapshotAnalyzer.ts`
- file or directory 3: `src/extension.ts`

## Acceptance criteria

- criterion 1: Persisting Patterns subtitle renders as an inline pill next to `.sub-label` inside `.sub-label-group`, leaving `.sub-count` isolated on the right.
- criterion 2: Persisting subtitle reads `"Across X reports"` (`"Across 1 report"` for singular) everywhere it is generated.

## Validation

- command 1: `npm run compile`
- command 2: `npm run compile-tests`

## Risks or dependencies

- risk 1: Narrow sidebar/panel widths; mitigated with `flex-wrap: wrap` on `.sub-label-group`.
- dependency 1: none

## Handoff notes

- notes for the next agent: User requested to preview Option A first; finalize workflow brief once approved.
