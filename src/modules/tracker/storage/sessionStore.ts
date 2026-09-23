/**
 * Session persistence layer for the Ariadne extension.
 *
 * Wraps the VS Code ExtensionContext state APIs to provide a
 * clean, type-safe interface for persisting lifecycle data:
 *
 * - **workspaceState** (per-project):
 *   - `SessionRecord`              — active (in-progress) session
 *   - `SessionRecord[]`            — completed sessions
 *   - `FindingLifecycleRecord[]`   — live finding lifecycle state
 *   - `SessionMeta`                — scan counter seed, session start time
 *
 * - **globalState** (cross-project):
 *   - `UserConfig` — notification preferences, etc.
 *
 * Write serialization: all writes go through `enqueuePersist()` to
 * prevent concurrent workspaceState updates from rapid onFindings
 * callbacks (the engine may emit results faster than VS Code can
 * flush to disk).
 *
 * ─────────────────────────────────────────────────────────────────────
 * USAGE (in extension.ts):
 *   const store = new SessionStore(context);
 *   await store.migrateFromLegacy();
 *   const session = store.loadActiveSession();
 *   const lifecycles = store.loadFindingLifecycles();
 *   await store.saveFindingLifecycles(updatedLifecycles);
 * ─────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { FindingLifecycleRecord, SessionRecord } from '../analysis/lifecycleTypes.js';
import type { TypeGraduationState } from '../analysis/commonVulnerabilities.js';
import type { SessionMeta, UserConfig } from './storageTypes.js';
import {
	WS_SCAN_SNAPSHOTS,
	WS_SESSION_META,
	WS_ACTIVE_SESSION,
	WS_COMPLETED_SESSIONS,
	WS_FINDING_LIFECYCLES,
	WS_SAVE_SCAN_STATE,
	WS_DISMISSED_NOTIFICATIONS,
	WS_EXPANDED_VULN_KEY,
	WS_GRADUATION_HISTORY,
	GL_USER_CONFIG,
} from './storageKeys.js';

// ── Default values ────────────────────────────────────────────────────

const DEFAULT_SESSION_META: SessionMeta = {
	sessionStartTime: Date.now(),
	totalScansCount: 0,
	scanIdSeed: 0,
	sessionIdSeed: 0,
};

const DEFAULT_USER_CONFIG: UserConfig = {
	notificationsEnabled: true,
};

/**
 * Tracks the save-triggered scan routing state.
 *
 * - `initialCheckpointDoneAt` — epoch ms when the first save-triggered
 *   scan result was processed. Null until that result arrives.
 * - `totalSaveScansThisSession` — count of settled save scans processed
 *   in the current activation.
 * - `totalSettledCancellations` — count of times the 2-second settlement
 *   window was cancelled by a tracked-file change during this activation.
 */
export interface SaveScanState {
	initialCheckpointDoneAt: number | null;
	totalSaveScansThisSession: number;
	totalSettledCancellations: number;
}

const DEFAULT_SAVE_SCAN_STATE: SaveScanState = {
	initialCheckpointDoneAt: null,
	totalSaveScansThisSession: 0,
	totalSettledCancellations: 0,
};

export const SESSION_EXPORT_FORMAT = 'ariadne-session-export' as const;
export const SESSION_EXPORT_VERSION = 1 as const;

/**
 * Versioned JSON snapshot of local workspace session tracking.
 * Does not include GitHub auth or global user preferences.
 */
export interface SessionDataExport {
	format: typeof SESSION_EXPORT_FORMAT;
	version: typeof SESSION_EXPORT_VERSION;
	exportedAt: string;
	activeSession: SessionRecord | null;
	completedSessions: SessionRecord[];
	findingLifecycles: FindingLifecycleRecord[];
	sessionMeta: SessionMeta;
	saveScanState: SaveScanState;
	graduationHistory: Record<string, TypeGraduationState>;
	dismissedNotifications: string[];
	pendingFinalizedSession: SessionRecord | null;
	expandedVulnKey?: string;
}

// ══════════════════════════════════════════════════════════════════════
// SESSION STORE
// ══════════════════════════════════════════════════════════════════════

export class SessionStore {

	/**
	 * Serial promise chain that ensures workspaceState writes complete
	 * in order. Each `enqueuePersist` call chains onto the previous one.
	 */
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly context: vscode.ExtensionContext) { }

	// ── Migration ─────────────────────────────────────────────────

	/**
	 * Clears legacy `ariadne.scanSnapshots` data if present.
	 *
	 * The old model stored an unbounded ScanSnapshot[] array.
	 * The new model uses FindingLifecycleRecord[] + SessionRecord.
	 * There is no migration path — the data models are fundamentally
	 * different.
	 */
	async migrateFromLegacy(): Promise<void> {
		const legacy = this.context.workspaceState.get(WS_SCAN_SNAPSHOTS);
		if (legacy !== undefined) {
			await this.context.workspaceState.update(WS_SCAN_SNAPSHOTS, undefined);
			console.log('[Ariadne Store] Cleared legacy scanSnapshots data.');
		}
	}

	// ── Active Session (workspaceState — per project) ─────────────

	/** Loads the active (in-progress) session, or null if none exists. */
	loadActiveSession(): SessionRecord | null {
		return this.context.workspaceState.get<SessionRecord>(
			WS_ACTIVE_SESSION,
			null as unknown as SessionRecord,
		) ?? null;
	}

	/** Persists the active session record. */
	async saveActiveSession(session: SessionRecord): Promise<void> {
		return this.enqueuePersist(() =>
			this.context.workspaceState.update(WS_ACTIVE_SESSION, session),
		);
	}

	/** Clears the active session (e.g. after finalization). */
	async clearActiveSession(): Promise<void> {
		return this.enqueuePersist(() =>
			this.context.workspaceState.update(WS_ACTIVE_SESSION, undefined),
		);
	}

	/**
	 * Clears ALL local session tracking for this workspace.
	 * Wipes active/completed sessions, finding lifecycles, graduation
	 * history, save-scan state, dismissed notifications, expanded-vuln
	 * UI state, session counters, and any pending finalized-session file.
	 * Does not touch GitHub auth or global user preferences.
	 */
	async clearAllLifecycleData(): Promise<void> {
		return this.enqueuePersist(async () => {
			await this.context.workspaceState.update(WS_ACTIVE_SESSION, undefined);
			await this.context.workspaceState.update(WS_COMPLETED_SESSIONS, undefined);
			await this.context.workspaceState.update(WS_FINDING_LIFECYCLES, undefined);
			await this.context.workspaceState.update(WS_GRADUATION_HISTORY, undefined);
			await this.context.workspaceState.update(WS_SAVE_SCAN_STATE, undefined);
			await this.context.workspaceState.update(WS_DISMISSED_NOTIFICATIONS, undefined);
			await this.context.workspaceState.update(WS_EXPANDED_VULN_KEY, undefined);
			await this.context.workspaceState.update(WS_SESSION_META, {
				...DEFAULT_SESSION_META,
				sessionStartTime: Date.now(),
			});
			this.deletePendingFinalizedSessionFile();
			console.log('[Ariadne Store] Cleared all local session tracking data.');
		});
	}

	/**
	 * Returns a JSON-serializable snapshot of local session tracking.
	 * Does not include GitHub auth or global user preferences.
	 */
	exportSessionSnapshot(): SessionDataExport {
		return {
			format: SESSION_EXPORT_FORMAT,
			version: SESSION_EXPORT_VERSION,
			exportedAt: new Date().toISOString(),
			activeSession: this.loadActiveSession(),
			completedSessions: [...this.loadCompletedSessions()],
			findingLifecycles: [...this.loadFindingLifecycles()],
			sessionMeta: { ...this.loadSessionMeta() },
			saveScanState: { ...this.loadSaveScanState() },
			graduationHistory: { ...this.loadGraduationHistory() },
			dismissedNotifications: [...this.loadDismissedNotifications()],
			pendingFinalizedSession: this.readPendingFinalizedSessionFile(),
			expandedVulnKey: this.loadExpandedVulnKey(),
		};
	}

	// ── Completed Sessions (workspaceState — per project) ─────────

	/** Loads all completed session records. */
	loadCompletedSessions(): SessionRecord[] {
		return this.context.workspaceState.get<SessionRecord[]>(
			WS_COMPLETED_SESSIONS,
			[],
		);
	}

	/** Appends or updates a completed session and persists immediately. */
	async appendCompletedSession(session: SessionRecord): Promise<void> {
		return this.enqueuePersist(async () => {
			const sessions = this.loadCompletedSessions();
			const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);
			if (existingIndex !== -1) {
				sessions[existingIndex] = session;
			} else {
				sessions.push(session);
			}
			await this.context.workspaceState.update(WS_COMPLETED_SESSIONS, sessions);
			console.log(
				`[Ariadne Store] Saved completed session ${session.sessionId} ` +
				`(${session.lifecycleSummaries.length} lifecycle summaries). ` +
				`Total completed: ${sessions.length}`,
			);
		});
	}

	/**
	 * Loads the most recent COMPLETED session record, gracefully skipping
	 * any sessions marked 'incomplete' (e.g. from power outages, crashes, or timeouts).
	 *
	 * Reference: Section 6.3 & 7, Step 7 — Ariadne Trends Framework
	 *
	 * @returns The latest completed SessionRecord, or null if no completed session exists.
	 */
	loadPriorCompletedSession(): SessionRecord | null {
		const sessions = this.loadCompletedSessions();
		for (let i = sessions.length - 1; i >= 0; i--) {
			if (sessions[i].status === 'completed') {
				return sessions[i];
			}
		}
		return null;
	}

	/**
	 * Loads the prior completed session before a given session ID.
	 * Useful for reproducible auditing, metrics verification, and testing.
	 *
	 * @param sessionId The reference session ID to search backwards from.
	 * @returns The preceding completed SessionRecord, or null if none exists.
	 */
	loadPriorCompletedSessionBefore(sessionId: string): SessionRecord | null {
		const sessions = this.loadCompletedSessions();
		const idx = sessions.findIndex(s => s.sessionId === sessionId);
		const endIndex = idx === -1 ? sessions.length - 1 : idx - 1;
		for (let i = endIndex; i >= 0; i--) {
			if (sessions[i].status === 'completed') {
				return sessions[i];
			}
		}
		return null;
	}

	/** Async wrapper for loadPriorCompletedSession(). */
	async getPriorCompletedSession(): Promise<SessionRecord | null> {
		return this.loadPriorCompletedSession();
	}

	// ── Synchronous Shutdown Persistence ──────────────────────────

	/** Returns the absolute file path used for synchronous shutdown snapshots. */
	getFinalizedSessionFilePath(): string {
		const dir = this.context.storageUri?.fsPath ?? this.context.globalStorageUri.fsPath;
		return path.join(dir, 'pending-finalized-session.json');
	}

	private readPendingFinalizedSessionFile(): SessionRecord | null {
		try {
			const filePath = this.getFinalizedSessionFilePath();
			if (!fs.existsSync(filePath)) {
				return null;
			}
			const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				return null;
			}
			if (typeof (parsed as { sessionId?: unknown }).sessionId !== 'string') {
				return null;
			}
			return parsed as SessionRecord;
		} catch (err) {
			console.error('[Ariadne Store] Failed to read pending finalized session:', err);
			return null;
		}
	}

	private deletePendingFinalizedSessionFile(): void {
		try {
			const filePath = this.getFinalizedSessionFilePath();
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (err) {
			console.error('[Ariadne Store] Failed to delete pending finalized session:', err);
		}
	}

	/**
	 * Synchronously persists a finalized session record to local disk.
	 *
	 * During deactivation, VS Code tears down internal IPC channels and
	 * cancels asynchronous workspaceState.update() promises. This method
	 * uses Node's native fs.writeFileSync to bypass IPC, completing in <1ms
	 * directly against the OS filesystem.
	 */
	saveFinalizedSessionSync(session: SessionRecord): void {
		try {
			const filePath = this.getFinalizedSessionFilePath();
			const dir = path.dirname(filePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
			console.log(
				`[Ariadne Store] Synchronously persisted finalized session ` +
				`${session.sessionId} (${session.status}) to ${filePath}`,
			);
		} catch (err) {
			console.error('[Ariadne Store] Failed to synchronously persist finalized session:', err);
		}
	}

	/**
	 * Recovers any pending finalized session from the shutdown file.
	 *
	 * Called during extension activation. If a pending file exists from a
	 * clean (or timed-out) deactivation, its contents are loaded into
	 * workspaceState (completedSessions) and the file is deleted.
	 */
	async recoverPendingFinalizedSession(): Promise<SessionRecord | null> {
		try {
			const filePath = this.getFinalizedSessionFilePath();
			if (!fs.existsSync(filePath)) {
				return null;
			}
			const raw = fs.readFileSync(filePath, 'utf8');
			const session = JSON.parse(raw) as SessionRecord;
			fs.unlinkSync(filePath);

			await this.appendCompletedSession(session);
			await this.clearActiveSession();
			console.log(
				`[Ariadne Store] Recovered pending finalized session ${session.sessionId} ` +
				`as '${session.status ?? 'completed'}'.`,
			);
			return session;
		} catch (err) {
			console.error('[Ariadne Store] Failed to recover pending finalized session:', err);
			return null;
		}
	}

	// ── Finding Lifecycles (workspaceState — per project) ─────────

	/** Loads the current finding lifecycle records. */
	loadFindingLifecycles(): FindingLifecycleRecord[] {
		return this.context.workspaceState.get<FindingLifecycleRecord[]>(
			WS_FINDING_LIFECYCLES,
			[],
		);
	}

	/** Persists updated finding lifecycle records. */
	async saveFindingLifecycles(lifecycles: FindingLifecycleRecord[]): Promise<void> {
		return this.enqueuePersist(async () => {
			await this.context.workspaceState.update(WS_FINDING_LIFECYCLES, lifecycles);
			console.log(
				`[Ariadne Store] Saved ${lifecycles.length} finding lifecycle(s).`,
			);
		});
	}

	// ── Graduation History (workspaceState — per project) ──────────

	/**
	 * Loads the per-type graduation history for Common Vulnerabilities.
	 * Returns an empty record if nothing has been persisted yet.
	 */
	loadGraduationHistory(): Record<string, TypeGraduationState> {
		return this.context.workspaceState.get<Record<string, TypeGraduationState>>(
			WS_GRADUATION_HISTORY,
			{},
		);
	}

	/** Persists updated graduation history. */
	async saveGraduationHistory(history: Record<string, TypeGraduationState>): Promise<void> {
		return this.enqueuePersist(async () => {
			await this.context.workspaceState.update(WS_GRADUATION_HISTORY, history);
			const typeCount = Object.keys(history).length;
			console.log(
				`[Ariadne Store] Saved graduation history (${typeCount} type(s)).`,
			);
		});
	}

	// ── Save Scan State (workspaceState — per project) ─────────────

	/** Loads the save-scan routing state for the current workspace. */
	loadSaveScanState(): SaveScanState {
		return this.context.workspaceState.get<SaveScanState>(
			WS_SAVE_SCAN_STATE,
			{ ...DEFAULT_SAVE_SCAN_STATE },
		);
	}

	/** Persists updated save-scan state. */
	async saveSaveScanState(state: SaveScanState): Promise<void> {
		return this.enqueuePersist(() =>
			this.context.workspaceState.update(WS_SAVE_SCAN_STATE, state),
		);
	}

	/** Clears the save-scan state (used by the debug reset command). */
	async clearSaveScanState(): Promise<void> {
		return this.enqueuePersist(() =>
			this.context.workspaceState.update(WS_SAVE_SCAN_STATE, undefined),
		);
	}

	// ── Session Metadata (workspaceState — per project) ───────────

	/**
	 * Loads session metadata for the current workspace.
	 * Returns sensible defaults if nothing has been persisted yet.
	 */
	loadSessionMeta(): SessionMeta {
		return this.context.workspaceState.get<SessionMeta>(
			WS_SESSION_META,
			{ ...DEFAULT_SESSION_META, sessionStartTime: Date.now() },
		);
	}

	/** Persists session metadata to workspaceState. */
	async saveSessionMeta(meta: SessionMeta): Promise<void> {
		await this.context.workspaceState.update(WS_SESSION_META, meta);
	}

	/**
	 * Atomically increments the scan ID seed and returns a new
	 * unique scan identifier (e.g. "scan-007").
	 *
	 * The seed is persisted so IDs continue across VS Code restarts.
	 */
	async nextScanId(): Promise<string> {
		const meta = this.loadSessionMeta();
		meta.scanIdSeed += 1;
		meta.totalScansCount += 1;
		await this.saveSessionMeta(meta);
		const id = `scan-${String(meta.scanIdSeed).padStart(3, '0')}`;
		console.log(`[Ariadne Store] Generated ${id} (total scans: ${meta.totalScansCount})`);
		return id;
	}

	/**
	 * Atomically increments the session ID seed and returns a new
	 * unique session identifier (e.g. "session-002").
	 *
	 * Uses a persistent counter — not dependent on async writes.
	 */
	nextSessionId(): string {
		const meta = this.loadSessionMeta();
		// Handle legacy SessionMeta that doesn't have sessionIdSeed yet
		meta.sessionIdSeed = (meta.sessionIdSeed ?? 0) + 1;
		// Synchronous-enough: saveSessionMeta is a direct workspaceState write
		void this.saveSessionMeta(meta);
		const id = `session-${String(meta.sessionIdSeed).padStart(3, '0')}`;
		console.log(`[Ariadne Store] Generated ${id}`);
		return id;
	}

	// ── User Config (globalState — cross-project) ─────────────────

	/**
	 * Loads global user preferences.
	 * Returns defaults if nothing has been persisted yet.
	 */
	loadUserConfig(): UserConfig {
		return this.context.globalState.get<UserConfig>(
			GL_USER_CONFIG,
			{ ...DEFAULT_USER_CONFIG },
		);
	}

	/** Persists global user preferences. */
	async saveUserConfig(config: UserConfig): Promise<void> {
		await this.context.globalState.update(GL_USER_CONFIG, config);
	}

	// ── Active Vulnerabilities UI (workspaceState — per project) ──

	/** Loads the expanded vulnerability card key for this workspace, if any. */
	loadExpandedVulnKey(): string | undefined {
		return this.context.workspaceState.get<string | undefined>(
			WS_EXPANDED_VULN_KEY,
			undefined,
		);
	}

	/** Persists or clears the expanded vulnerability card key for this workspace. */
	async saveExpandedVulnKey(key: string | undefined): Promise<void> {
		await this.context.workspaceState.update(WS_EXPANDED_VULN_KEY, key);
	}

	// ── Dismissed Notifications (workspaceState — per project) ──

	/**
	 * Loads the set of notification IDs the user has dismissed.
	 * Returns an empty array if none have been dismissed yet.
	 */
	loadDismissedNotifications(): string[] {
		return this.context.workspaceState.get<string[]>(
			WS_DISMISSED_NOTIFICATIONS,
			[],
		);
	}

	/**
	 * Marks a notification as dismissed by persisting its ID.
	 * Subsequent calls to `loadDismissedNotifications()` will include it.
	 */
	async dismissNotification(notificationId: string): Promise<void> {
		const dismissed = this.loadDismissedNotifications();
		if (!dismissed.includes(notificationId)) {
			dismissed.push(notificationId);
			await this.context.workspaceState.update(WS_DISMISSED_NOTIFICATIONS, dismissed);
			console.log(`[Ariadne Store] Dismissed notification: ${notificationId}`);
		}
	}

	// ── Write serialization ──────────────────────────────────────

	/**
	 * Enqueues a persistence operation onto the serial write chain.
	 *
	 * The onFindings callback can fire faster than workspaceState can
	 * flush. Without serialization, concurrent read-modify-write cycles
	 * can lose data. This chains each write onto the previous one.
	 */
	private enqueuePersist(fn: () => Promise<void> | Thenable<void>): Promise<void> {
		this.writeQueue = this.writeQueue.then(fn, fn);
		return this.writeQueue;
	}
}
