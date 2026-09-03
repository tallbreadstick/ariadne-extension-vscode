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

/**
 * Key for the persisted ScanSnapshot[] array.
 * @deprecated Legacy key — cleared on migration to lifecycle records.
 */
export const WS_SCAN_SNAPSHOTS = 'ariadne.scanSnapshots';

/** Key for the persisted SessionMeta object. */
export const WS_SESSION_META = 'ariadne.sessionMeta';

/** Key for the active (in-progress) SessionRecord. */
export const WS_ACTIVE_SESSION = 'ariadne.activeSession';

/** Key for the persisted completed SessionRecord[] array. */
export const WS_COMPLETED_SESSIONS = 'ariadne.completedSessions';

/** Key for the persisted FindingLifecycleRecord[] array. */
export const WS_FINDING_LIFECYCLES = 'ariadne.findingLifecycles';

/** Key for the persisted set of dismissed notification IDs. */
export const WS_DISMISSED_NOTIFICATIONS = 'ariadne.dismissedNotifications';

/** Key for the single expanded vulnerability card in the active-vulns panel. */
export const WS_EXPANDED_VULN_KEY = 'ariadne.expandedVulnKey';

// ── globalState keys (cross-project) ──────────────────────────────────

/** Key for the persisted UserConfig object. */
export const GL_USER_CONFIG = 'ariadne.userConfig';
