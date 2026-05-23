/**
 * Storage key constants for the Ariadne session persistence layer.
 *
 * workspaceState keys are scoped per VS Code workspace folder —
 * each project gets its own independent scan history.
 *
 * globalState keys are shared across all workspaces — used for
 * user preferences that apply everywhere.
 */

// ── workspaceState keys (per-project) ─────────────────────────────────

/** Key for the persisted ScanSnapshot[] array. */
export const WS_SCAN_SNAPSHOTS = 'ariadne.scanSnapshots';

/** Key for the persisted SessionMeta object. */
export const WS_SESSION_META = 'ariadne.sessionMeta';

/** Key for the persisted set of dismissed notification IDs. */
export const WS_DISMISSED_NOTIFICATIONS = 'ariadne.dismissedNotifications';

// ── globalState keys (cross-project) ──────────────────────────────────

/** Key for the persisted UserConfig object. */
export const GL_USER_CONFIG = 'ariadne.userConfig';
