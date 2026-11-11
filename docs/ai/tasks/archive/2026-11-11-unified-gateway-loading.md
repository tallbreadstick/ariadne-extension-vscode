<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Unified Gateway Loading

## Summary

- task: Unify bottom panel loading and sign-in states into a single gateway view with centered layout, Ariadne shield logo, and cycling tips
- requested outcome: Remove duplicate side-by-side loading/sign-in views, center the layout, display accurate status messages (downloading/starting/scanning), and reveal Active Vulnerabilities and Session Metrics only when ready
- primary constraint: Use VS Code context keys (when clause) and ensure backwards compatibility with existing view messaging

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

- [x] Create feature branch `feat/unified-gateway-loading`
- [x] Create `src/modules/presentation/views/gatewayPanel.ts` with centered layout, Ariadne shield logo, dynamic states, and cycling security tips
- [x] Update `src/modules/presentation/views/startupLoading.ts` with centered layout, logo, and tips
- [x] Update `package.json` with `ariadne.panel.gateway` and `when` conditions (`ariadne.panelReady`)
- [x] Wire `gatewayProvider` and `ariadne.panelReady` context management in `src/extension.ts`
- [x] Add consent checkboxes and direct GitHub sign-in handling with pulse attention animation in bottom gateway panel
- [x] Add bi-directional real-time consent synchronization between sidebar and bottom gateway panel
- [x] Add automated section unfolding and pulse attention animation when navigating to settings
- [x] Fix perimeter beam animation overflow scrollbars
- [x] Add comprehensive unit tests in `src/test/gatewayPanel.test.ts`
- [x] Validate compilation and unit tests (all 28 tests passing)

## Scope

- in scope: Bottom panel loading/sign-in view consolidation, gateway view implementation, tips carousel, status progression
- out of scope: Scanner engine changes, sidebar settings internals

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: user
- tester: agent

## Relevant files

- file or directory 1: src/modules/presentation/views/gatewayPanel.ts
- file or directory 2: src/modules/presentation/views/startupLoading.ts
- file or directory 3: package.json
- file or directory 4: src/extension.ts
- file or directory 5: src/test/gatewayPanel.test.ts

## Acceptance criteria

- criterion 1: When signed out or loading, the bottom panel renders a single unified full-width view without split dividers
- criterion 2: Content is vertically and horizontally centered with the Ariadne shield logo
- criterion 3: Loading states accurately reflect downloading, initializing, or scanning with a cycling security tips carousel
- criterion 4: Once ready, the bottom panel transitions smoothly to the split Active Vulnerabilities and Session Metrics tabs

## Validation

- command 1: npm run compile
- command 2: npx mocha out/test/gatewayPanel.test.js out/test/activeVulnerabilities.test.js out/test/vulnFilters.test.js
- command 3: npm run workflow -- check

## Risks or dependencies

- risk 1: Context key `ariadne.panelReady` must accurately toggle on all lifecycle transitions (login, logout, crash, recovery)
- dependency 1: none

## Handoff notes

- notes for the next agent: The gateway view can be tested by launching with F5 or manually toggling login state.
