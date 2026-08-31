# Engineering Standards

These rules apply across the repository unless a more specific file says otherwise.

## Change style

- prefer small, reviewable changes over broad rewrites
- optimize for clarity over cleverness
- favor explicit names and predictable structure
- avoid unnecessary dependencies
- leave short comments only where intent is not obvious

## Safety

- do not overwrite user changes without approval
- avoid unrelated edits while solving the current task
- call out assumptions when repository context is incomplete
- document follow-up risks when the change is incomplete
- **never commit private repo URLs, internal scanner paths, or proprietary logic** — this is a public repo

## Coding principles

These are the team's core coding principles. All code produced by agents must follow them.

### Clean Code and meaningful names

- **Self-documenting code**: write code that communicates its purpose through clear logic and naming. Minimize comments — prefer purposeful names that make the code self-explanatory.
- **Purposeful names**: use meaningful variable, function, and class names that express intent and usage. Well-named constructs eliminate the need for explanatory comments.
- **Simplicity**: keep code as simple as possible. Simple, clear code is inherently more maintainable than complex code laden with comments.

### SOLID

- **Single Responsibility (SRP)**: each module, class, or function has one reason to change. One file per provider/command handler when practical.
- **Open/Closed (OCP)**: entities are open for extension, closed for modification. Design with interfaces and abstractions that allow new behavior without altering existing code.
- **Liskov Substitution (LSP)**: subclasses must be substitutable for their base classes without breaking behavior.
- **Interface Segregation (ISP)**: prefer smaller, focused interfaces over large general-purpose ones. Clients should not depend on methods they don't use.
- **Dependency Inversion (DIP)**: depend on abstractions, not concretions. High-level modules should not depend on low-level modules directly.

### DRY (Don't Repeat Yourself)

- every piece of knowledge has a single, unambiguous representation in the codebase
- extract shared logic into reusable utilities or services
- if you find yourself copying code, refactor into a shared function or module

### KISS (Keep It Simple, Stupid)

- strive for the simplest solution that works
- complexity complicates maintenance, understanding, and extension
- favor straightforward approaches over clever abstractions

### Comments policy

- **minimize comments** — prefer self-documenting code through clear naming and structure
- comments are acceptable for explaining **why** a non-obvious decision was made, but not **what** the code does
- comments tend to become outdated; purposeful names and clean structure convey lasting clarity
- doc comments (`/** */` in TS, `///` in Rust) are required for public API surfaces

## Security principles

Security is integrated throughout the development lifecycle, not bolted on after.

### Secure by Design

- integrate security considerations from the earliest stages of design
- validate all inputs at trust boundaries (user input, scanner output, API responses)
- apply the principle of least privilege — request only the VSCode permissions the extension actually needs
- fail securely — errors should not expose internal state, file paths, or sensitive information

### OWASP awareness

- stay informed about [OWASP Top 10](https://owasp.org/www-project-top-ten/) risks
- for the extension: guard against injection in webview content, validate scanner output before rendering, sanitize user-configurable paths
- for any network calls: validate URLs, enforce HTTPS, handle redirects safely

### Data protection

- do not log or display sensitive file contents unnecessarily
- if the extension stores settings or scan results, use VSCode's secure storage APIs where appropriate
- respect user privacy — do not transmit file contents or scan results to external services without explicit user consent
- adhere to privacy laws applicable to the user's jurisdiction

### Security culture

- treat security findings from the scanner as first-class results
- when introducing dependencies, verify they are actively maintained and have no known critical vulnerabilities
- flag potential security implications in task briefs and code reviews
- if a change introduces a new trust boundary, document it in `docs/ai/architecture.md`

## Quality

- add or update tests when behavior changes
- keep documentation aligned with architecture or workflow changes
- record meaningful technical tradeoffs in `docs/ai/decisions.md`
- prefer reproducible commands that work for a teammate on a fresh machine

## Git conventions

### Commit message format

```text
<type>: <short summary>
```

- **Subject line**: max 72 characters, lowercase type prefix, imperative mood ("add feature" not "added feature")
- **Body** (optional): wrap at 72 characters, explain **what** changed and **why**, not **how**
- **Footer** (optional): reference issues (`Fixes #123`, `Closes #456`, `Related to #789`)

### Commit types

| Type | When to use |
|---|---|
| `feature` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation updates |
| `style` | Code style changes (formatting, no logic changes) |
| `refactor` | Code restructuring (no behavior changes) |
| `test` | Adding or modifying tests |
| `chore` | Maintenance (dependencies, configs, etc.) |
| `perf` | Performance improvements |
| `ci` | Changes to CI/CD workflows |

### Branching

- Branch names use the pattern: `<category>/<short-description>`
- Categories: `feature/`, `fix/`, `docs/`, `tech/`, `refactor/`
- Use kebab-case for the description: `feature/code-lens-provider`, `fix/hover-crash`
- Keep branches short-lived — merge or rebase frequently

### General git rules

- write atomic commits — each commit should represent one logical change
- do not mix unrelated changes in a single commit
- do not commit generated files (`dist/`, `node_modules/`, `.vsix`)
- do not commit secrets, API keys, or private repo URLs
- prefer incremental commits over a single large commit when the work has distinct logical steps
- squash fixup commits before merging to main

## Workflow artifacts

- create or update a task brief in `docs/ai/tasks/` for every non-trivial change
- create or update matching files in `docs/specs/` and `docs/plans/` before implementation when the work changes behavior, architecture, workflow, or spans multiple steps
- keep the task brief current with status, next action, and blockers

## TypeScript conventions

### Folder structure

```text
src/
  extension.ts                    # activate / deactivate entrypoint
  modules/
    core/                         # Binary resolution (ariadneExecutable.ts)
    detection/
      bridge/                     # TS ↔ scanner IPC (iostream, messages, convert, documentEvents)
    presentation/
      AriadneViewProvider.ts      # Base webview view provider
      panelTypes.ts               # Presentation-layer vulnerability type
      severityColors.ts           # Severity → color mapping
      diagnostics/                # DiagnosticManager, HoverProvider, finding types
      views/                      # Active Vulnerabilities panel HTML builder
    feedback/
      auth/                       # GitHub OAuth service, token storage, Copilot quota
      llm_request/                # Copilot client manager, payload serialization, LLM client, response parsing
      llm_feedback/               # Feedback types
      settings/                   # Extension settings (Copilot model options)
      views/                      # Feedback panel, sign-in panel, terms of use panel HTML
      vulnerability_results/      # VulnerabilityMetadata, 3-layer hierarchy types, adapter
    tracker/
      analysis/                   # Snapshot analyzer, session metrics types
      storage/                    # SessionStore (workspaceState persistence)
      views/                      # Session Metrics panel, status bar, toast notifications
    rules/                        # .ariadne rule file diagnostics
  test/                           # Test files
```

### Rules

- no business logic in `extension.ts` or command handlers — delegate to a service or module
- bridge layer (`src/modules/detection/bridge/`) is the **only** code that spawns or communicates with the scanner
- keep `vscode` API usage in `src/modules/` — utility functions and types must be framework-free
- one file per provider / command handler when practical

### Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Provider file | PascalCase | `DiagnosticManager.ts` |
| Command handler | camelCase | `scanWorkspace.ts` |
| Type file | PascalCase or camelCase | `panelTypes.ts`, `diagnosticTypes.ts` |
| Utility file | camelCase | `formatDetection.ts` |
| Test file | match source + `.test.ts` | `convert.test.ts` |
| View builder | camelCase | `activeVulnerabilities.ts` |
| Service class | PascalCase | `GitHubAuthService.ts` |

## Cross-repo rules

- This repo does **not** contain scanner / rule logic — that lives in the private Rust repo.
- If a feature requires scanner-side changes, create a task brief here noting the dependency. The user will coordinate with the private repo separately.
- The bridge layer defines the **contract** between the two repos. Any change to the bridge message format must be coordinated.
- Do not reference the private repo's URL, module names, or internal logic in any committed file.

## External skill compliance

The following agent skills are recommended for this project. If installed in your agent harness, follow their guidance:

- **Ponytail**: Apply the YAGNI-first decision ladder before writing new code. Prefer reusing existing code, stdlib, and platform features over adding dependencies or writing new abstractions. Never cut validation, error handling, or security.
- **ECC**: Research and plan before implementing. Use structured skills for complex tasks. Follow security instincts (no hardcoded secrets, audit dependencies, validate inputs).
- **Impeccable** (webview/UI work only): Run `/impeccable audit` after UI changes. Follow the anti-pattern list (no default fonts, no gray-on-color, no card nesting, no bounce easing).

## Definition of done

- code changes are complete
- required task briefs, specs, and plans were created or updated
- docs were updated when needed
- validation was run, or the blocker was explained
- remaining risks or next steps were called out
- Ponytail ladder was applied (no unnecessary code or dependencies)
- coding principles compliance: names are meaningful, SOLID applied, no duplication (DRY), simplest solution chosen (KISS)
- security review: no hardcoded secrets, inputs validated at trust boundaries, no sensitive data leaked
