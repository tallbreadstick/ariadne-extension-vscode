# Agent Index

This file is the shared entrypoint for coding agents in this repository.

## Always read

- `docs/ai/commands.md`
- `docs/ai/standards.md`

## Read when relevant

- `docs/ai/project-context.md` for product or business context
- `docs/ai/architecture.md` for system shape and module boundaries
- `docs/ai/future-work.md` for known gaps and deferred improvements
- `docs/specs/` for approved behavior, architecture, or workflow specs
- `docs/plans/` for approved implementation plans
- `docs/ai/tasks/` for the current task brief and in-flight execution state
- `docs/ai/subagents/README.md` when splitting work across roles
- `docs/ai/decisions.md`
- `docs/ai/external-skills.md` for Ponytail, ECC, and Impeccable plugin guidance

## Scanner core (private)

- The scanner core is a **private** Rust repository. Do not reference its URL, internal structure, or proprietary logic in any file committed to this public repo.
- The scanner is **already integrated** and usable from the extension via the bridge layer (`src/modules/detection/bridge/`).
- Integration mechanism: child_process spawning the `ariadne` binary in `session` mode, communicating via newline-delimited JSON over stdin/stdout.
- If a change requires scanner-side modifications, note it as a cross-repo dependency in the task brief. The user will coordinate with the private repo separately.

## Agent bootstrap protocol

When an agent first arrives in this repository — or is resuming without prior context — it **must** follow this bootstrap sequence before doing any implementation work.

### Phase 1: Scan the repository

1. Read `AGENTS.md` (this file), `docs/ai/commands.md`, and `docs/ai/standards.md`.
2. Scan the folder structure to build a mental map of the codebase:
   - `src/` — extension source (modules, types, utils)
   - `docs/` — specs, plans, tasks, architecture
   - `package.json` — dependencies, scripts
   - `tsconfig.json` — TypeScript config
3. Read `docs/ai/project-context.md` and `docs/ai/architecture.md` for existing context.
4. Read `docs/ai/decisions.md` for decisions already recorded.
5. Check for an active task: look in `docs/ai/tasks/` for any non-archived brief.

### Phase 2: Request documents for MVP context

After the scan, if `docs/ai/project-context.md` or `docs/ai/decisions.md` are incomplete or have unfilled placeholders, ask the user to provide:

- The project's product requirements document (PRD) or capstone proposal
- The MVP feature list and what was shipped
- Any architectural diagrams, design documents, or meeting notes from the MVP phase
- The scanner core's public API contract (input/output format documentation)

Use these documents to populate:
- `docs/ai/project-context.md` — product summary, domain concepts, tech stack
- `docs/ai/decisions.md` → **MVP decisions** section — extract architectural and design decisions from the provided documents

### Phase 3: Clarify post-MVP context interactively

After MVP context is established, ask the user:

- What features are currently being implemented or planned?
- What design decisions have been made for these features? Ask for any supporting files (specs, sketches, chat logs, issue threads).
- Are there any new constraints, dependencies, or architectural changes since the MVP?

Use these answers to populate:
- `docs/ai/decisions.md` → **Post-MVP decisions** section
- `docs/ai/future-work.md` — known gaps and deferred work
- New task briefs in `docs/ai/tasks/` for in-flight work

### When to re-bootstrap

- If `docs/ai/project-context.md` has `<!-- FILL -->` placeholders → run Phase 2
- If `docs/ai/decisions.md` has `<!-- FILL -->` placeholders → run Phase 2 + 3
- If you are a new agent instance with no prior conversation context → run all three phases
- If context is already complete and current → skip straight to the workflow sequence

## Mandatory workflow sequence

Every non-trivial task **must** follow this sequence. No exceptions.

```text
# 1. Before starting — check for active tasks
npm run workflow -- status

# 2. Create the proportional workflow artifacts
npm run workflow -- scaffold --slug <topic>

# 3. Implement the change

# 4. Validate the task brief
npm run workflow -- check

# 5. Archive when done
npm run workflow -- finalize
```

### Artifact classification

- Tiny wording-only edits: no workflow artifact required.
- Small, contained changes: create a task brief with `npm run workflow -- scaffold --slug <topic>`.
- Complex work that crosses modules, changes a public contract, changes architecture or workflow, or has multiple independently reviewable steps: create a bundle with `npm run workflow -- scaffold --slug <topic> --artifacts bundle --reason "<why a spec and plan are needed>"`.

## Core workflow

1. Run `npm run workflow -- status` before starting. Do not begin implementation if there is no active task brief.
2. Classify the work using the rules above.
3. Create or update a matching spec in `docs/specs/` and plan in `docs/plans/` only for an approved bundle.
4. Automatically append an Architecture Decision Record (ADR) to `docs/ai/decisions.md` (under **Post-MVP decisions**) when introducing a new framework, dependency, or design pattern.
5. Make the smallest change that solves the task clearly.
6. Update docs when behavior, architecture, or workflow changes.
7. Run `npm run workflow -- check` to validate the task brief, then run the best available validation command from `docs/ai/commands.md`.
8. Run `npm run workflow -- finalize` when the task is complete.
9. Call out assumptions, blockers, and follow-up risks explicitly.

## Rules

- do not overwrite user changes without approval
- prefer clarity over cleverness
- add or update tests when behavior changes
- keep the task brief current so another tool or agent can resume work without hidden context
- keep commands reproducible and easy to run locally
- record meaningful tradeoffs in `docs/ai/decisions.md`
- changes that require coordination with the private scanner repo must note the cross-repo dependency in the task brief — never attempt to modify the scanner from this repo
- **never commit private repo URLs, internal scanner paths, or proprietary logic to this public repo**

## Subagent model

- use the role definitions in `docs/ai/subagents/` only when the task benefits from role splitting
- split work by responsibility and file ownership
- planner produces the required artifacts before parallel work starts
- implementer, reviewer, and tester reference the same brief and linked spec or plan
- if multiple agents work in parallel, give each a disjoint write scope
- use `docs/ai/subagents/handoff-contract.md` for task handoffs

## Tool-specific adapters

- Antigravity: `.agent/`
- Cursor: `.cursor/rules/`
- OpenAI Codex: reads `AGENTS.md` natively; `.codex/config.toml`
- Claude Code: `CLAUDE.md`
- Gemini CLI: `GEMINI.md`
- GitHub Copilot: `.github/copilot-instructions.md`

If a tool-specific file conflicts with this file, update the adapter so the shared guidance stays aligned here.

## External agent skills

These plugins optimize how agents write code. Install them in your agent harness following `docs/ai/external-skills.md`.

| Skill | Purpose | Applies to |
|---|---|---|
| [Impeccable](https://github.com/pbakaus/impeccable) | Frontend design — 23 commands, 61 deterministic design rules, anti-pattern detection | Webview / UI work |
| [Ponytail](https://github.com/DietrichGebert/ponytail) | Clean code — YAGNI-first ladder, ~54% less code bloat | All code changes |
| [ECC](https://github.com/affaan-m/ECC) | Agent optimization — skills, instincts, memory, security, research-first | Agent behavior |

### Ponytail decision ladder (always active)

Before writing any code, evaluate this ladder top-down — stop at the first rung that holds:

1. Does this need to exist? → skip it (YAGNI)
2. Already in this codebase? → reuse, don't rewrite
3. Stdlib / language built-in? → use it
4. Native platform feature? → use it (e.g. `<input type="date">`, `vscode.workspace.fs`)
5. Already-installed dependency? → use it
6. One line solves it? → one line
7. Only then → write the minimum that works

**Never cut**: validation, error handling, security, accessibility.

### ECC research-first instinct

Research and plan before implementing. Read the code the change touches and trace the real flow before picking an approach. This aligns with the bootstrap protocol above.

### Impeccable (webview/UI work only)

When working on webview panels, sidebar UI, or any HTML/CSS/JS surfaces:
- Run `/impeccable audit` after UI changes
- Follow anti-patterns: no default fonts, no gray-on-color text, no card nesting, no bounce easing
- If `PRODUCT.md` and `DESIGN.md` don't exist, run `/impeccable init` first
