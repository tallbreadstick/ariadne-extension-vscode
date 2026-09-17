<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Feedback Path Overflow

## Summary

- task: Adjust the file path display in the AI Feedback Panel so long paths do not cause horizontal scrolling
- requested outcome: The panel never horizontally scrolls due to long file paths; paths remain readable and informative with full path on hover tooltip
- primary constraint: Keep path readable, keep dark mode UI aesthetic consistent, and prevent any horizontal scrollbars on narrow or wide screens

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: agent
- next action: none
- blockers: none
- last checked: 2026-09-16

## Progress checklist

- [x] add formatDisplayPath helper in feedbackPanel.ts
- [x] update HTML to render display path with title tooltip containing full path
- [x] update CSS for body, panel, header-content, header-sub, and meta-file to prevent horizontal overflow
- [x] add unit tests for formatDisplayPath and path rendering
- [x] run typecheck and lint
- [x] validate workflow check

## Scope

- in scope:
  - Format long absolute file paths into compact display paths (e.g., ".../controller/LandlordController.java")
  - Set tooltip title on meta-file span to display the complete original path and line number
  - CSS overflow safeguards: overflow-x: hidden on body/panel, flex-shrink and text-overflow ellipsis on meta-file
  - Unit tests for formatDisplayPath
- out of scope:
  - Interactive file clicking/navigation via webview message bus
  - Modifications to Rust scanner or backend diagnostics

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/feedback/views/feedbackPanel.ts: webview HTML and CSS generation
- src/test/feedbackPanel.test.ts: unit tests for feedbackPanel formatting

## Acceptance criteria

- criterion 1: Extremely long absolute Windows/POSIX file paths do not cause the AI feedback panel to horizontally scroll
- criterion 2: File path display remains readable and useful by showing the immediate directory and file name
- criterion 3: Full file path and line number are preserved and visible via title hover tooltip
- criterion 4: All tests, linter, and typechecks pass

## Validation

- command 1: npm.cmd run check-types
- command 2: npm.cmd run lint
- command 3: npm.cmd run compile
- command 4: npm.cmd run workflow -- check

## Risks or dependencies

- risk 1: none
- dependency 1: none

## Handoff notes

- notes for the next agent: All changes are isolated to the feedback panel view rendering and styling.
