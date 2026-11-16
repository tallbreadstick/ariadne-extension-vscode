<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Integrate Commented Out And Ui

## Summary

- task: Integrate Florence's commented-out warning branch and Zydric's UI refinements onto a PR targeting fix/demo-bugs.
- requested outcome: Both branch tips are in one branch, conflicts keep both behaviors, Start Coding and Focus Active Vulnerabilities do not focus a hidden bottom panel, and sessionMetrics.test.ts imports processObservation.
- primary constraint: Do not change commented-out resolution rules, do not drop postGraceAbsenceCount, and do not retarget master.

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: integration agent
- next action: none
- blockers: none
- last checked: 2026-11-11

## Progress checklist

- [x] Confirm tips f5b4e36 and e21fadf
- [x] Merge Florence, then Zydric, keeping both sides of the two conflicts
- [x] Route onboarding panel focus through the gateway when the bottom panel is hidden
- [x] Import processObservation in sessionMetrics.test.ts
- [x] Typecheck and run the extension test suite

## Scope

- in scope: merge feature/commented-out-code-warning and integrate/ui-refinements-and-settings; conflict resolution; hidden-panel focus; missing import
- out of scope: rewriting the eight pre-existing lifecycle tests; changing commented-out resolution; restyling the settings accordion or metrics UI; merging into master

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: integration agent
- implementer: integration agent
- reviewer: integration agent
- tester: integration agent

## Relevant files

- src/extension.ts
- src/modules/feedback/views/signInPanel.ts
- src/modules/presentation/onboarding/onboardingPanel.ts
- src/test/sessionMetrics.test.ts
- src/test/onboardingPanel.test.ts

## Acceptance criteria

- criterion 1: PR targets fix/demo-bugs and contains both branch tips
- criterion 2: Commenting out a finding still does not resolve it, and postGraceAbsenceCount remains
- criterion 3: Start Coding and Focus Active Vulnerabilities focus the gateway while signed out, and the real view once ariadne.panelReady is set
- criterion 4: sessionMetrics.test.ts typechecks

## Validation

- command 1: npx tsc -p tsconfig.test.json --noEmit
- command 2: npm test

## Risks or dependencies

- risk 1: Eight lifecycle tests and one onboarding highlight-color assertion already fail on fix/demo-bugs. They were left unchanged.
- dependency 1: none

## Handoff notes

- Florence tip f5b4e36 merged cleanly onto fix/demo-bugs (7ebaea3). Zydric tip e21fadf then conflicted only in src/extension.ts and src/modules/feedback/views/signInPanel.ts.
- extension.ts keeps the gateway and panelReady block and the onboarding callbacks. signInPanel.ts keeps the Configuration accordion and the highlight-panel listener.
- Onboarding actions call planOnboardingPanelFocus. Signed-out or broken scanner focuses ariadne.panel.gateway. Signed-in startup or download shows the gateway, then focuses the requested view after ariadne.panelReady. Focus Active Vulnerabilities and Focus Full Report still spotlight the view once it is shown. Start Coding does not spotlight.
- The Copilot usage-meter width transition is unchanged. A CSS comment marks it so the design detector does not treat that existing meter motion as a new layout animation.
