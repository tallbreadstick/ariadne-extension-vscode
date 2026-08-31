# External Agent Skills

These plugins optimize how agents write code. They are referenced in `AGENTS.md` and `docs/ai/standards.md`.

## Recommended skills

### Ponytail — Clean Code

- **Repo**: [github.com/DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)
- **Purpose**: YAGNI-first decision ladder, reduces code bloat by ~54%
- **Applies to**: All code changes
- **Key rule**: Before writing any code, evaluate the decision ladder top-down — stop at the first rung that holds

### ECC — Agent Optimization

- **Repo**: [github.com/affaan-m/ECC](https://github.com/affaan-m/ECC)
- **Purpose**: Skills, instincts, memory, security, research-first approach
- **Applies to**: Agent behavior
- **Key rule**: Research and plan before implementing. Read the code the change touches and trace the real flow before picking an approach.

### Impeccable — Frontend Design

- **Repo**: [github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable)
- **Purpose**: 23 commands, 61 deterministic design rules, anti-pattern detection
- **Applies to**: Webview / UI work only
- **Key rule**: Run `/impeccable audit` after UI changes. No default fonts, no gray-on-color text, no card nesting, no bounce easing.

## Installation

Each skill is a set of instructions installed in the agent's harness (e.g., Antigravity skills directory, Cursor rules, Claude rules). Refer to each skill's repo README for installation instructions specific to your agent tool.

## When to apply

- **Ponytail**: Always. Every code change must pass the decision ladder.
- **ECC**: Always. Every task must start with research.
- **Impeccable**: Only when working on webview panels, sidebar UI, or HTML/CSS/JS surfaces.
