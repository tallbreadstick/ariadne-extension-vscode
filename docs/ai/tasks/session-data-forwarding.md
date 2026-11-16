# Task: Session Data Forwarding

**Slug**: session-data-forwarding  
**Status**: completed  
**Created**: 2026-11-16  
**Completed**: 2026-11-16  

## Summary

Implemented session data forwarding that captures the full session export snapshot along with user interaction counters and asynchronously POSTs it to a configured collection server endpoint whenever the user saves or closes the editor.

## Implementation details

- **Module**: [sessionForwarder.ts](file:///home/tallbreadstick/Projects/VSCode/ariadne-extension-vscode/src/modules/tracker/ingest/sessionForwarder.ts)
  - `SessionForwarder` tracks counts for:
    - `explainVulnerabilityCount`: Recorded whenever `ariadne-extension-vscode.openFeedbackPanel` is invoked.
    - `auditGraphOpenCount`: Recorded whenever `toggle-tree-view` or `ariadne-extension-vscode.toggleTreeView` is triggered.
    - `fileLocationOpenCount`: Recorded whenever `goto-line` message from a card is handled.
  - Combines `store.exportSessionSnapshot()` with interaction counts into a versioned payload format (`ariadne-session-forward`, version 1).
  - 1-minute debounce on file save (`scheduleForward`) to prevent spamming the endpoint.
  - Immediate dispatch on editor deactivation (`forwardNow`).
  - Completely non-blocking async network I/O with error boundary (non-fatal `console.warn` on failure).
- **Wiring**: [extension.ts](file:///home/tallbreadstick/Projects/VSCode/ariadne-extension-vscode/src/extension.ts)
  - Initialized in `activate()`.
  - Save hook registered in `registerDocumentEvents` (`onSaveTrigger`).
  - Close hook registered at top of `deactivationHandler`.
  - Feature counts hooked in command handlers and panel message listeners.

## Endpoint configuration

The forwarder shares configuration with the existing metrics ingest system:
- **Setting**: `ariadne.metricsIngest.baseUrl`
- **Default / Hypothetical placeholder**: `https://127.0.0.1:8080`
- **Target URL**: `<baseUrl>/v1/session-forward`
- **Authentication**: `ariadne.metricsIngest.apiKey` (or secret storage `ariadne.metricsIngestApiKey`)
- **Self-signed TLS**: `ariadne.metricsIngest.trustLocalTls`
- **Specification doc**: [session-forward-payload-spec.md](file:///home/tallbreadstick/Projects/VSCode/ariadne-extension-vscode/docs/specs/session-forward-payload-spec.md)

