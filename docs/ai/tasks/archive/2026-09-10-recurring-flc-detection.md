<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Recurring Flc Detection

## Summary

- task: Complete end-to-end integration and presentation of Recurring Finding Lifecycle (FLC) detection in Session Metrics and Tracker
- requested outcome: Recurring patterns detected by lifecycle engine are properly exposed in TrendData, mapped through snapshotAnalyzer, rendered in the Session Metrics webview panel with sub-items, and initialize cleanly
- primary constraint: Maintain zero-performance overhead on save-triggered scans (FLC evaluations run on settled scans with in-memory map lookups)

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: RENCE
- next action: ready for review and integration
- blockers: none
- last checked: 2026-09-10

## Progress checklist

- [x] Create feature branch `feature/recurring-flc-detection`
- [x] Add `recurringPatterns: number` to `TrendData` interface in `src/modules/presentation/panelTypes.ts`
- [x] Map `recurringPatterns` and build `recurringItems` sub-items in `toSessionMetrics()` in `src/modules/tracker/analysis/snapshotAnalyzer.ts`
- [x] Replace hardcoded placeholder `recurringCount = 0` with `trends.recurringPatterns` in `src/modules/tracker/views/sessionMetrics.ts`
- [x] Add `recurringPatterns: 0` to initial metrics in `src/extension.ts`
- [x] Verify compilation, type-check, and lint via `npm run compile`
- [x] Validate task brief with `npm run workflow -- check`

## Scope

- in scope: Presentation and wiring of recurring FLC data across `panelTypes.ts`, `snapshotAnalyzer.ts`, `sessionMetrics.ts`, and `extension.ts`
- out of scope: Underlying lifecycle state machine in `lifecycleEngine.ts` (already implemented by Abel)

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: RENCE
- implementer: RENCE
- reviewer: ERVIN / ABEL
- tester: RENCE

## Relevant files

- `src/modules/presentation/panelTypes.ts`: TrendData interface definition
- `src/modules/tracker/analysis/snapshotAnalyzer.ts`: Mapping analysis deltas to SessionMetrics trends
- `src/modules/tracker/views/sessionMetrics.ts`: HTML builder for Session Metrics webview
- `src/extension.ts`: Activation lifecycle and initial metrics initialization

## Acceptance criteria

- `TrendData` includes `recurringPatterns: number` and optional `recurringItems?: TrendSubItem[]`
- `toSessionMetrics` maps `recurringPatterns` and computes per-type `recurringItems`
- `buildSessionMetricsHtml` renders real recurring count and collapsible sub-items without hardcoded 0 placeholders
- Clean type-checking and lint passing with zero errors
- Initial metrics upon extension activation contains `recurringPatterns: 0`

## Validation

- `npm run check-types`
- `npm run lint`
- `npm run compile`
- `npm run workflow -- check`

## Risks or dependencies

- Performance risk: Verified that pulling FLCs per settled scan uses in-memory Map lookup and does not introduce disk I/O or loop slowdowns
- Threshold alignment: Verified default recurrence threshold is 1 (first reappearance after resolution = recurring), consistent with `RECURRENCE_THRESHOLD`

## Handoff notes

- The lifecycle engine was already computing `analysis.recurringPatterns` and tagging deltas with status `'recurring'`. The presentation layer had been stubbed with `const recurringCount = 0`. With this change, any recurring finding cleanly surfaces in both the Session Metrics count and the collapsible sub-items row.
