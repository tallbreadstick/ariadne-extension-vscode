/**
 * Session persistence layer for the Ariadne extension.
 *
 * Wraps the VS Code ExtensionContext state APIs to provide a
 * clean, type-safe interface for persisting scan data:
 *
 * - **workspaceState** (per-project):
 *   - `ScanSnapshot[]` — full scan history, accumulated forever
 *   - `SessionMeta` — scan counter seed, session start time, totals
 *
 * - **globalState** (cross-project):
 *   - `UserConfig` — notification preferences, etc.
 *
 * ─────────────────────────────────────────────────────────────────────
 * USAGE (in extension.ts):
 *   const store = new SessionStore(context);
 *   const history = store.loadSnapshots();        // restore on activate
 *   await store.appendSnapshot(newSnapshot);       // after each scan
 *   const id = await store.nextScanId();           // "scan-007"
 * ─────────────────────────────────────────────────────────────────────
 */

import * as vscode from 'vscode';
import type { ScanSnapshot } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
import type { SessionMeta, UserConfig } from './storageTypes.js';
import {
	WS_SCAN_SNAPSHOTS,
	WS_SESSION_META,
	GL_USER_CONFIG,
} from './storageKeys.js';

// ── Default values ────────────────────────────────────────────────────

const DEFAULT_SESSION_META: SessionMeta = {
	sessionStartTime: Date.now(),
	totalScansCount: 0,
	scanIdSeed: 0,
};

const DEFAULT_USER_CONFIG: UserConfig = {
	notificationsEnabled: true,
};

// ══════════════════════════════════════════════════════════════════════
// SESSION STORE
// ══════════════════════════════════════════════════════════════════════

export class SessionStore {
	constructor(private readonly context: vscode.ExtensionContext) {}

	// ── Scan Snapshots (workspaceState — per project) ─────────────

	/**
	 * Loads all stored scan snapshots for the current workspace.
	 * Returns an empty array if no scans have been persisted yet.
	 */
	loadSnapshots(): ScanSnapshot[] {
		const snapshots = this.context.workspaceState.get<ScanSnapshot[]>(
			WS_SCAN_SNAPSHOTS,
			[],
		);
		if (snapshots.length > 0) {
			console.log(`[Ariadne Store] Loaded ${snapshots.length} stored snapshot(s)`);
		}
		return snapshots;
	}

	/**
	 * Appends a new snapshot to the stored history and persists
	 * immediately. The full array is re-written on each call.
	 */
	async appendSnapshot(snapshot: ScanSnapshot): Promise<void> {
		const snapshots = this.loadSnapshots();
		snapshots.push(snapshot);
		await this.context.workspaceState.update(WS_SCAN_SNAPSHOTS, snapshots);

		// Debug: count instances and occurrences for the log
		let totalInstances = 0;
		let totalOccurrences = 0;
		for (const v of snapshot.vulnerabilities) {
			totalInstances += v.instances.length;
			for (const inst of v.instances) {
				totalOccurrences += inst.occurrences.length;
			}
		}
		console.log(
			`[Ariadne Store] Saved ${snapshot.scan_id}: ` +
			`${snapshot.vulnerabilities.length} vulns, ` +
			`${totalInstances} instances, ` +
			`${totalOccurrences} occurrences — ` +
			`total stored: ${snapshots.length}`,
		);
	}

	/**
	 * Replaces the entire stored snapshot array.
	 * Useful for future clear/prune/archive operations.
	 */
	async replaceSnapshots(snapshots: ScanSnapshot[]): Promise<void> {
		await this.context.workspaceState.update(WS_SCAN_SNAPSHOTS, snapshots);
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
}
