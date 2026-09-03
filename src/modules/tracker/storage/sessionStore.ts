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

import * as vscode from 'vscode';
import type { FindingLifecycleRecord, SessionRecord } from '../analysis/lifecycleTypes.js';
import type { SessionMeta, UserConfig } from './storageTypes.js';
import {
	WS_SCAN_SNAPSHOTS,
	WS_SESSION_META,
	WS_ACTIVE_SESSION,
	WS_COMPLETED_SESSIONS,
	WS_FINDING_LIFECYCLES,
	WS_DISMISSED_NOTIFICATIONS,
	WS_EXPANDED_VULN_KEY,
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

// ══════════════════════════════════════════════════════════════════════
// SESSION STORE
// ══════════════════════════════════════════════════════════════════════

export class SessionStore {

	/**
	 * Serial promise chain that ensures workspaceState writes complete
	 * in order. Each `enqueuePersist` call chains onto the previous one.
	 */
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly context: vscode.ExtensionContext) {}

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
	 * Clears ALL lifecycle data for a clean slate.
	 * Wipes: active session, completed sessions, finding lifecycles,
	 * and resets the session ID seed.
	 */
	async clearAllLifecycleData(): Promise<void> {
		return this.enqueuePersist(async () => {
			await this.context.workspaceState.update(WS_ACTIVE_SESSION, undefined);
			await this.context.workspaceState.update(WS_COMPLETED_SESSIONS, undefined);
			await this.context.workspaceState.update(WS_FINDING_LIFECYCLES, undefined);
			const meta = this.loadSessionMeta();
			meta.sessionIdSeed = 0;
			await this.saveSessionMeta(meta);
			console.log('[Ariadne Store] Cleared all lifecycle data.');
		});
	}

	// ── Completed Sessions (workspaceState — per project) ─────────

	/** Loads all completed session records. */
	loadCompletedSessions(): SessionRecord[] {
		return this.context.workspaceState.get<SessionRecord[]>(
			WS_COMPLETED_SESSIONS,
			[],
		);
	}

	/** Appends a completed session and persists immediately. */
	async appendCompletedSession(session: SessionRecord): Promise<void> {
		return this.enqueuePersist(async () => {
			const sessions = this.loadCompletedSessions();
			sessions.push(session);
			await this.context.workspaceState.update(WS_COMPLETED_SESSIONS, sessions);
			console.log(
				`[Ariadne Store] Saved completed session ${session.sessionId} ` +
				`(${session.lifecycleSummaries.length} lifecycle summaries). ` +
				`Total completed: ${sessions.length}`,
			);
		});
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
