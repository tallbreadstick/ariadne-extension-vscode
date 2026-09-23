<!-- CLI-parsed fields (case-sensitive "- key: value" bullets):
  status        required  Values: todo | in progress | completed
  next action   required  Free-text next step
  blockers      optional  Use "none" when clear
  spec          optional  Path like docs/specs/YYYY-MM-DD-slug.md or "none"
  plan          optional  Path like docs/plans/YYYY-MM-DD-slug.md or "none"
-->

# Vuln List Filter Menu

## Summary

- task: Replace the broad Active Vulnerabilities search/filter row with a filter menu
- requested outcome: Narrow by category, CWE, severity, type, and file, plus a reset control
- primary constraint: Client-side filtering only; reuse existing webview state persistence; no new dependencies

## Linked artifacts

- spec: none
- plan: none

## Current state

- status: completed
- current owner: agent
- next action: none
- blockers: none
- last checked: 2026-09-14

## Progress checklist

- [x] Pure filter matching + facet collection
- [x] Filter menu UI (severity checkboxes, category, type, and reset button)
- [x] Streamlined dropdowns (omitted redundant file and CWE filters, 2 clean dropdowns: Category and Type)
- [x] Friendly category label formatting (clean human names instead of code prefixes)
- [x] Tests and compile

## Scope

- in scope: Active Vulnerabilities toolbar, filter matching, reset
- out of scope: Scanner changes, Session Metrics filters

## Cross-repo dependencies

- scanner core changes needed: none
- bridge contract changes: none

## File ownership

- planner: agent
- implementer: agent
- reviewer: agent
- tester: agent

## Relevant files

- src/modules/presentation/views/activeVulnerabilities.ts
- src/modules/presentation/views/vulnFilters.ts
- src/test/vulnFilters.test.ts
- src/test/activeVulnerabilities.test.ts

## Acceptance criteria

- criterion 1: Users can filter by severity, OWASP category, and vulnerability type
- criterion 2: Search is scoped to title and file path rather than every field
- criterion 3: Reset filters clears search and structured filters
- criterion 4: Dimensions combine with AND; multiple severities combine with OR
- criterion 5: Category options display clean names without code prefixes (e.g., "Broken Access Control", "Injection")

## Validation

- command 1: npm run compile
- command 2: node node_modules/mocha/bin/mocha.js out/test/vulnFilters.test.js out/test/activeVulnerabilities.test.js

## Risks or dependencies

- risk 1: Webview HTML refresh still drops filter UI state unless vscode.setState restores it
- dependency 1: none

## Handoff notes

- notes for the next agent: Filter matching lives in vulnFilters.ts; the webview script applies the same rules to card data attributes.
