# Handoff Contract

Every subagent handoff should include:

## Required fields

- role:
- goal:
- task brief:
- spec:
- plan:
- exact write scope:
- read-only context:
- constraints:
- validation expectation:
- output format:

## Example

```text
role: implementer
goal: add code lens provider for scan detections
task brief: docs/ai/tasks/2026-09-01-code-lens-detections.md
spec: docs/specs/2026-09-01-code-lens-detections.md
plan: none
exact write scope: src/modules/detection/providers/DetectionCodeLensProvider.ts, src/test/codeLens.test.ts
read-only context: docs/ai/architecture.md, src/modules/detection/bridge/convert.ts
constraints: do not change bridge layer; provider must use existing Detection type; do not reference private scanner repo
validation expectation: npm test passes, extension activates without error
output format: short summary, changed files, test result, remaining risks
```

## Rules

- write scope must be explicit and as small as possible
- if multiple subagents are active, their write scopes must not overlap
- include artifact paths even when intentionally omitted — use explicit `none`
- if you cannot honor the scope, stop and escalate
- never reference the private scanner repo URL or internals in handoff artifacts committed to this public repo
