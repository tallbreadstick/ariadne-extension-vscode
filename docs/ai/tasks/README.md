# Tasks

Active task briefs live in this directory. Completed briefs are moved to `archive/`.

## Naming

Files are named `YYYY-MM-DD-slug.md` (e.g. `2026-09-01-fix-bridge-parsing.md`).

## Lifecycle

1. `npm run workflow -- scaffold --slug <topic>` creates a new brief from `TEMPLATE.md`
2. Agent fills in the brief fields during implementation
3. `npm run workflow -- check` validates required fields
4. `npm run workflow -- finalize` archives completed briefs to `archive/`

## Required fields

- **status**: `todo` | `in progress` | `completed`
- **next action**: Free-text description of the next step
