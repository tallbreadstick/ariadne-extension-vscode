/**
 * Types for the Ariadne session persistence layer.
 *
 * SessionMeta is stored per-workspace (workspaceState) and tracks
 * cumulative scan statistics across VS Code restarts.
 *
 * UserConfig is stored globally (globalState) and holds cross-project
 * user preferences.
 */

/**
 * Per-workspace session metadata persisted across VS Code restarts.
 *
 * Stored in workspaceState so each project maintains its own
 * independent scan history and counters.
 */
export interface SessionMeta {
	/** Epoch ms of the first scan ever recorded in this workspace. */
	sessionStartTime: number;
	/** Total number of scans performed in this workspace (all time). */
	totalScansCount: number;
	/** Auto-increment seed for generating unique scan IDs. */
	scanIdSeed: number;
}

/**
 * Global user preferences shared across all workspaces.
 *
 * Stored in globalState so settings apply everywhere regardless
 * of which project is open.
 */
export interface UserConfig {
	/** Whether VS Code toast notifications are enabled for scan events. */
	notificationsEnabled: boolean;
}
