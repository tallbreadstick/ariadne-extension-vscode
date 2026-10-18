<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Onboarding Guide (Interactive Webview Panel)

## Summary

- task: Implement an interactive, VS Code-themed Onboarding Guide webview panel and first-run experience based on docs-walkthrough/Onnboarding Guide.md
- requested outcome: A dedicated Onboarding Guide webview tab that introduces Ariadne, explains the saving/scanning/session lifecycle, highlights each feature (Settings, Active Vulnerabilities, Full Report, Inline Highlighting) with locations and interactive action buttons to navigate there, and concludes with a friendly exit message. Auto-opens on first install and is accessible via command and sidebar settings.
- primary constraint: Native VS Code sandbox does not allow arbitrary DOM overlays or floating highlight circles outside webviews/editors; use webview-rendered visual cues and command-driven interactive action buttons (Option A).

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: agent
- next action: none
- blockers: none
- last checked: 2026-10-18

## Progress checklist

- [x] Create `src/modules/presentation/onboarding/onboardingPanel.ts` with HTML builder and webview message handling
- [x] Support interactive action buttons (Open Settings, Open Active Vulnerabilities, Open Full Report, Start Coding)
- [x] Register command `ariadne-extension-vscode.openOnboarding` in `package.json` and `extension.ts`
- [x] Connect first-run detection in `extension.ts` using `globalState` (`ariadne.hasSeenOnboarding`)
- [x] Add link/button to Onboarding Guide in Sidebar Settings (`signInPanel.ts`)
- [x] Add unit tests in `src/test/onboardingPanel.test.ts`
- [x] Validate compilation (`npm run compile`) and tests (`npm run compile-tests`)

## Scope

- in scope:
  - Onboarding Guide webview panel (Option A) covering all 4 sections in Onboarding Guide.md
  - Visual location badges and explanations for Settings, Active Vulnerabilities, Full Report, and Inline Highlighting
  - Interactive navigation buttons executing VS Code commands (`focus` on views)
  - First-run auto-display mechanism and re-triggerable command
  - Unit tests verifying HTML structure, content, and state transitions
- out of scope:
  - Modifying the Software Test Document (explicitly on hold per user request)
  - DOM injection into VS Code shell (unsupported by VS Code)

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/presentation/onboarding/onboardingPanel.ts
- src/modules/presentation/onboarding/welcomeToast.ts
- src/modules/feedback/views/signInPanel.ts
- src/extension.ts
- package.json
- src/test/onboardingPanel.test.ts

## Acceptance criteria

- criterion 1: Onboarding webview tab opens with title "Welcome to Ariadne" and renders all 4 guide sections (Welcome, Saving & Scanning, Feature Highlights, Friendly Exit).
- criterion 2: Action buttons in the guide trigger interactive navigation (opening Sidebar Settings, Active Vulnerabilities panel, and Full Report panel).
- criterion 3: Automatically opens on first run when `ariadne.hasSeenOnboarding` is unset, and can be manually reopened via Command Palette `Ariadne: Open Onboarding Guide`.
- criterion 4: All tests pass with zero compilation errors (`tsc --noEmit`).

## Validation

- command 1: `npx tsc --noEmit`
- command 2: `npm test`

## Risks or dependencies

- risk 1: Retaining webview focus without jarring the user when clicking navigation action buttons -> handle panel focus cleanly and provide a dismiss/done action.

## Handoff notes

- notes for the next agent: Branch `feature/interactive-onboarding-guide` contains the implementation.

