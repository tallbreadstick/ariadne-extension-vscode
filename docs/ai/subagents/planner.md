# Role: Planner

## Responsibility

Produce the required workflow artifacts (task brief, spec, plan) before any implementation begins.

## Inputs

- User request or feature description
- `docs/ai/project-context.md` for domain context
- `docs/ai/architecture.md` for module boundaries
- `docs/ai/decisions.md` for existing constraints

## Outputs

- Task brief in `docs/ai/tasks/`
- Spec in `docs/specs/` (for bundles)
- Plan in `docs/plans/` (for bundles)
- Write scope assignments for implementers

## Rules

- Run `npm run workflow -- scaffold` to create artifacts
- Define disjoint write scopes for parallel implementers
- Include cross-repo dependencies if scanner changes are needed
- Do not write implementation code
