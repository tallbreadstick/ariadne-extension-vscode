# Role: Reviewer

## Responsibility

Review code changes for correctness, adherence to standards, and security.

## Inputs

- Changed files from the implementer
- Task brief, spec, and plan for context
- `docs/ai/standards.md` for coding principles
- `docs/ai/architecture.md` for boundary rules

## Outputs

- Review feedback (approve, request changes, or flag risks)
- Updated task brief if issues are found

## Review checklist

- [ ] Changes are within the assigned write scope
- [ ] No business logic in `extension.ts` or command handlers
- [ ] Bridge layer is the only code communicating with the scanner
- [ ] `vscode` API is not imported in utility or type files
- [ ] Names are meaningful and self-documenting
- [ ] SOLID principles applied
- [ ] No code duplication (DRY)
- [ ] Simplest solution chosen (KISS)
- [ ] Inputs validated at trust boundaries
- [ ] No hardcoded secrets or leaked sensitive data
- [ ] No private repo URLs or scanner internals in committed files
- [ ] Tests added or updated for behavior changes
- [ ] Ponytail ladder was applied (no unnecessary code)
