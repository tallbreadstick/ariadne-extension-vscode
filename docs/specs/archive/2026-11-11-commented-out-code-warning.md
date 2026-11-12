# Spec: Commented Out Code Warning

## Purpose

Warn users when a previously detected vulnerability disappears from Live Scan because it was commented out rather than fixed, and surface its commented-out state persistently in Session Metrics.

## Scope

- in scope: Transition detection (`isNewlyCommentedOut`), suppressing false `isAbsentCandidate` / `newPersistingFindings` alerts on commented-out transitions, warning toast formatting (`candidateToasts.ts`, `notificationToast.ts`), Session Metrics `Commented out` pill (`snapshotAnalyzer.ts`, `extension.ts`, `panelTypes.ts`, `sessionMetrics.ts`), and unit tests.
- out of scope: Rust scanner behavior, inline editor diagnostics on commented lines.

## Proposed behavior

1. **Lifecycle transition (`lifecycleEngine.ts`)**: When a settled save detects a previously uncommented absent finding as commented out (`!wasCommentedOut && lifecycle.isCommentedOut`), set `isNewlyCommentedOut: true` on `FindingClassification` and do not set `isAbsentCandidate: true`.
2. **Toast notifications (`candidateToasts.ts`, `notificationToast.ts`)**:
   - Single finding: `Ariadne: <Type> is commented out—hidden from Live Scan, but tracked in Full Report until fixed or removed.`
   - Multiple findings: `Ariadne: <N> vulnerabilities (<Types>) are commented out—hidden from Live Scan, but tracked in Full Report until fixed or removed.`
   - Uses `showWarningMessage`, honors `ariadne.notifications.level`, uses a 2s event cooldown, and excludes `isNewlyCommentedOut` items from `newPersistingFindings` to avoid redundant toasts.
3. **Session Metrics pill (`sessionMetrics.ts`, `snapshotAnalyzer.ts`, `extension.ts`)**: Pass `commentedOutCount` on `TrendSubItem` for Persisting Patterns and render an amber pill (`Commented out` or `<K> commented out`) beside `Across X reports`.

## Acceptance criteria

- [x] Commenting out a finding emits `isNewlyCommentedOut: true` once per transition and suppresses `isAbsentCandidate`
- [x] Warning toast renders exact single and multi-finding wording via `showWarningMessage`
- [x] Persisting Patterns row displays the `Commented out` pill beside `Across X reports` when `commentedOutCount > 0`
- [x] Unit tests cover lifecycle transition, toast formatting/prioritization, and Session Metrics pill rendering

## Constraints

- technical: Pure analysis modules (`candidateToasts.ts`, `lifecycleEngine.ts`, `snapshotAnalyzer.ts`) must remain free of `vscode` imports.
- product: Consistent with existing `Ariadne:` toast tone; avoids repeat-save spam.
- delivery: Atomic, reviewable changes with passing compile, lint, and tests.

## Cross-repo impact

- scanner core: none
- bridge contract: none

## Risks and open questions

- risk 1: Narrow Session Metrics panel width with two inline pills; mitigated by `flex-wrap: wrap` on `.sub-label-group`.
- question 1: none

## Related docs

- plan: [2026-11-11-commented-out-code-warning.md](../plans/2026-11-11-commented-out-code-warning.md)
- task brief: [2026-11-11-commented-out-code-warning.md](../ai/tasks/2026-11-11-commented-out-code-warning.md)
