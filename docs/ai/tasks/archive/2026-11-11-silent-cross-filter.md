<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Silent Cross Filter

## Summary

- task: Prevent opening the filter drawer when cross-filtering from persisting patterns or trend cards
- requested outcome: Clicking a vulnerability in persisting patterns or any trend card filters active vulnerabilities without toggling open the filter drawer menu
- primary constraint: Keep filter state applied and synchronized (chips, dropdowns, badges, and card DOM filtering) without mutating the filter drawer drawer visibility

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: implementer
- next action: none
- blockers: none
- last checked: 2026-11-11

## Progress checklist

- [x] Identify latest remote branch across repositories (`origin/fix/demo-bugs`) and branch off (`fix/silent-cross-filter`)
- [x] Remove `setFilterVisibility(true)` from cross-filter message handlers (`set-filter-severity` and `set-filter-type`) in `activeVulnerabilities.ts`
- [x] Add regression test verifying cross-filter messages do not call `setFilterVisibility(true)`
- [x] Validate compilation and unit tests pass

## Scope

- in scope: `src/modules/presentation/views/activeVulnerabilities.ts`, unit test in `src/test/activeVulnerabilities.test.ts`
- out of scope: Scanner engine changes, session metrics cross-filtering dispatch logic

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: user
- tester: agent

## Relevant files

- file or directory 1: src/modules/presentation/views/activeVulnerabilities.ts
- file or directory 2: src/test/activeVulnerabilities.test.ts

## Acceptance criteria

- criterion 1: Clicking persisting pattern or trend card item triggers `set-filter-type` or `set-filter-severity` and filters active vulnerabilities
- criterion 2: The filter drawer (`filterMenu`) does not open automatically upon receiving cross-filter messages

## Validation

- command 1: npm run compile
- command 2: npx mocha out/test/activeVulnerabilities.test.js

## Risks or dependencies

- risk 1: none
- dependency 1: none

## Handoff notes

- notes for the next agent: The filter drawer toggle button still works as expected when manually clicked by the user.
