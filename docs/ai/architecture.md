# Architecture Notes

Current system shape, module boundaries, and conventions.

## System overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                    VSCode Extension Host                         │
│                                                                  │
│  ┌─────────────────┐   ┌────────────────────────────────────┐   │
│  │  Commands        │   │  Presentation Layer                │   │
│  │  & Palette       │   │  (DiagnosticManager, HoverProvider,│   │
│  │  (extension.ts)  │   │   ActiveVulns panel, Decorations)  │   │
│  └────────┬─────────┘   └──────────┬───────────────────────┘   │
│           │                        │                            │
│  ┌────────┴────────────────────────┴───────────────────────┐   │
│  │       Feedback Layer (Module 3)                          │   │
│  │  auth/ — GitHub OAuth for Copilot access                 │   │
│  │  llm_request/ — prompt serialization, LLM client,        │   │
│  │                  response parsing                         │   │
│  │  views/ — feedback panel, sign-in panel, terms of use     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │       Tracker Layer (Module 4)                            │   │
│  │  analysis/ — snapshot analyzer, session metrics           │   │
│  │  storage/ — SessionStore (workspaceState persistence)     │   │
│  │  views/ — session metrics panel, status bar, toasts       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │       Bridge Layer (detection/bridge/)                    │   │
│  │   iostream.ts    — spawn + manage ariadne session process │   │
│  │   messages.ts    — IPC message contract (AriadneMessage)  │   │
│  │   convert.ts     — scanner output → TS types              │   │
│  │   fingerprint.ts — sent-buffer queue + finding hashes     │   │
│  │   documentEvents — VS Code events → IPC messages          │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │ newline-delimited JSON over stdin/stdout
                           ▼
            ┌──────────────────────────────┐
            │   Scanner Core (private)     │
            │   Rust + Tree-sitter         │
            │   (already integrated)       │
            └──────────────────────────────┘
```

## Module map

| Module | Path | Responsibility |
|---|---|---|
| Core | `src/modules/core/` | Binary resolution (`ariadneExecutable.ts`) |
| Bridge | `src/modules/detection/bridge/` | Spawn scanner, serialize/deserialize IPC messages, convert results to TS types, derive finding fingerprints from queued sent buffers |
| Presentation | `src/modules/presentation/` | AriadneViewProvider, severity colors, panel type definitions |
| Diagnostics | `src/modules/presentation/diagnostics/` | DiagnosticManager (inline squiggles + decorations), HoverProvider, finding types |
| Active Vulns | `src/modules/presentation/views/` | Active Vulnerabilities webview panel HTML builder |
| Feedback Auth | `src/modules/feedback/auth/` | GitHub OAuth service, token storage, Copilot quota checking |
| LLM Request | `src/modules/feedback/llm_request/` | Copilot client manager, payload serialization, LLM call, response parsing, error sanitization |
| LLM Feedback | `src/modules/feedback/llm_feedback/` | Feedback types |
| Feedback Views | `src/modules/feedback/views/` | Feedback panel, sign-in panel, terms of use panel HTML builders |
| Feedback Settings | `src/modules/feedback/settings/` | Extension settings (Copilot model options) |
| Vuln Types | `src/modules/feedback/vulnerability_results/` | VulnerabilityMetadata, 3-layer hierarchy types, toFlatMetadata adapter |
| Tracker Analysis | `src/modules/tracker/analysis/` | Snapshot analyzer, session metrics computation |
| Tracker Storage | `src/modules/tracker/storage/` | SessionStore (workspaceState persistence) |
| Tracker Views | `src/modules/tracker/views/` | Session Metrics panel, status bar item, notification toasts |
| Rules | `src/modules/rules/` | `.ariadne` rule file diagnostics and language support |

## Boundaries

- **Extension ↔ Scanner**: Newline-delimited JSON over stdin/stdout via `child_process.spawn`. Already integrated via the bridge layer.
- **VSCode API**: only in `src/modules/` — never in `src/utils/` or `src/types/`.
- **Cross-repo**: scanner core is a private Rust repo. This repo treats it as an opaque external dependency.
- **Privacy**: no private repo URLs, scanner internals, or proprietary rule logic in committed files.
- **LLM boundary**: Extension → GitHub Copilot SDK → Copilot API. Requests contain vulnerability metadata + active file content. No source code leaves the user's machine except the active file sent for LLM context.

## Data flow

```text
User opens/edits .java file
    │
    ▼
documentEvents.ts captures VS Code events
    │
    ▼
Sends IPC message (OpenFile/UpdateFile/Analyze) to Rust engine via iostream.ts
    │
    ▼
Rust scanner: AST parse → rule match → taint analysis → findings aggregation
    │
    ▼
Engine emits VulnerabilityMetadata[] as JSON on stdout
    │
    ▼
iostream.ts parses JSON lines → session.onFindings() callback
    │
    ├──→ fingerprint.ts hashes findings against the queued sent-buffer snapshot
    │     (counts only in logs; hashes are not persisted in this phase)
    ├──→ convert.ts → metadataToVulnerability() → Active Vulnerabilities panel
    ├──→ convert.ts → groupFindingsByFile() → DiagnosticManager (squiggles + decorations)
    ├──→ convert.ts → metadataToScanSnapshot() → SessionStore → snapshotAnalyzer
    │                                                            → Session Metrics panel
    │                                                            → Status bar update
    │                                                            → Toast notifications
    └──→ User clicks "Ask Ariadne" → serializePayload → callLLM → parseResponse → Feedback panel
```

## IPC message protocol

Messages sent from TypeScript → Rust (defined in `messages.ts` / `messages.rs`):

| Message | Fields | Trigger |
|---|---|---|
| `Init` | `root: string` | Extension activation |
| `OpenFile` | `path, content` | File opened in editor |
| `UpdateFile` | `path, edits: TextEdit[]` | File edited (debounced 300–500ms) |
| `CloseFile` | `path` | File closed |
| `CreateFile` | `path, content` | File created in workspace |
| `DeleteFile` | `path` | File deleted |
| `RenameFile` | `old_path, new_path` | File renamed |
| `Analyze` | `path: string \| null` | Triggered after every mutation event |
| `ReloadRules` | `overlays: Record<string, string>` | Rule file changed |

Response from Rust → TypeScript: `VulnerabilityMetadata[]` as a JSON array on stdout.
