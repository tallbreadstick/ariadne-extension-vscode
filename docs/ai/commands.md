# Commands

Single source of truth for build, test, and workflow commands.

## Validation checks

- **Full check**: `npm run compile` (runs check-types + lint + esbuild)
- **Typecheck only**: `npx tsc --noEmit`
- **Lint only**: `npm run lint`

## Extension commands

- **Dev (watch)**: `npm run watch` (parallel esbuild + tsc watch)
- **Build**: `npm run compile`
- **Package**: `npx @vscode/vsce package`
- **Lint**: `npm run lint` (eslint src)
- **Typecheck**: `npm run check-types` (tsc --noEmit)
- **Compile tests**: `npm run compile-tests`
- **Test**: `npm test` (vscode-test)
- **Install deps**: `npm install`

## Agentic workflow commands

- `npm run workflow -- scaffold --slug <topic>` (create a task brief)
- `npm run workflow -- scaffold --slug <topic> --artifacts bundle --reason "<reason>"` (create task + spec + plan)
- `npm run workflow -- status` (show active task)
- `npm run workflow -- check` (validate task brief)
- `npm run workflow -- finalize` (archive completed task)
