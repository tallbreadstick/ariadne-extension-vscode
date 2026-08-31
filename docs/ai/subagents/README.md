# Subagent Roles

When a task benefits from splitting work across roles, use the role definitions below. Each role has a dedicated file with detailed instructions.

## Available roles

| Role | File | Purpose |
|---|---|---|
| Planner | [planner.md](planner.md) | Produces specs, plans, and task briefs before implementation starts |
| Implementer | [implementer.md](implementer.md) | Writes code within the assigned write scope |
| Reviewer | [reviewer.md](reviewer.md) | Reviews code changes for correctness, style, and security |
| Tester | [tester.md](tester.md) | Writes and runs tests to validate changes |

## When to use subagents

- The task crosses multiple modules with independent file ownership
- Implementation and review benefit from separation of concerns
- Multiple agents can work in parallel on disjoint write scopes

## When NOT to use subagents

- Small, contained changes within a single module
- Wording-only edits
- Simple bug fixes with clear scope

## Handoff protocol

Every subagent handoff must follow the contract in [handoff-contract.md](handoff-contract.md).
