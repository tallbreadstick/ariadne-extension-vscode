# Commented Out Code Warning Implementation Plan

**Goal:** Notify users once via warning toast when they comment out vulnerable code and surface a persistent `Commented out` pill in Session Metrics Persisting Patterns.

**Architecture:** Track `!wasCommentedOut -> isCommentedOut` transitions in `lifecycleEngine.ts`, route them into `SessionAnalysis.commentedOutFindings` and `candidateToasts.ts` / `notificationToast.ts`, and propagate `commentedOutCount` through `VulnerabilityDelta` / `TrendSubItem` to `sessionMetrics.ts` and `extension.ts`.

**Tech Stack:** TypeScript, VS Code Extension API, Mocha, ESLint.

---

## References

- spec: [2026-11-11-commented-out-code-warning.md](../specs/2026-11-11-commented-out-code-warning.md)
- task brief: [2026-11-11-commented-out-code-warning.md](../ai/tasks/2026-11-11-commented-out-code-warning.md)

## Steps

- [x] Step 1: Add `isNewlyCommentedOut` to `lifecycleTypes.ts` and update `lifecycleEngine.ts` transition logic (suppressing `isAbsentCandidate` when commented out).
- [x] Step 2: Update `analysisTypes.ts`, `snapshotAnalyzer.ts`, and `panelTypes.ts` to expose `commentedOutFindings` and `commentedOutCount`.
- [x] Step 3: Add `formatCommentedOutMessage` and `'commentedOut'` toast handling in `candidateToasts.ts` and `notificationToast.ts`.
- [x] Step 4: Render the `Commented out` pill in `sessionMetrics.ts` and populate `commentedOutCount` in `extension.ts`.
- [x] Step 5: Add/update unit tests in `candidateToast.test.ts`, `lifecycleEngine.test.ts`, `sessionMetrics.test.ts`, and `sessionMetricsView.test.ts`.

## Validation

- [x] Run `npm run compile`, `npm run compile-tests`, and Mocha tests from `docs/ai/commands.md`.

## Risks

- risk 1: Existing tests asserting absence behavior on commented-out findings; verify all lifecycle tests remain green.

## Handoff notes

- anything the next agent needs to know: None.
