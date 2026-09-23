import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type * as vscode from 'vscode';
import { SessionStore } from '../modules/tracker/storage/sessionStore.js';
import { startSession, finalizeSession } from '../modules/tracker/analysis/lifecycleEngine.js';
import type { FindingLifecycleRecord } from '../modules/tracker/analysis/lifecycleTypes.js';
import {
	GL_USER_CONFIG,
	WS_ACTIVE_SESSION,
	WS_COMPLETED_SESSIONS,
	WS_DISMISSED_NOTIFICATIONS,
	WS_EXPANDED_VULN_KEY,
	WS_FINDING_LIFECYCLES,
	WS_GRADUATION_HISTORY,
	WS_SAVE_SCAN_STATE,
	WS_SESSION_META,
} from '../modules/tracker/storage/storageKeys.js';

function createMockContext(tempDir: string): {
	context: vscode.ExtensionContext;
	workspaceState: Record<string, unknown>;
	globalState: Record<string, unknown>;
} {
	const workspaceState: Record<string, unknown> = {};
	const globalState: Record<string, unknown> = {};
	const context = {
		storageUri: { fsPath: tempDir },
		globalStorageUri: { fsPath: tempDir },
		workspaceState: {
			get: <T>(key: string, defaultValue?: T): T => {
				return (workspaceState[key] !== undefined ? workspaceState[key] : defaultValue) as T;
			},
			update: async (key: string, value: unknown): Promise<void> => {
				if (value === undefined) {
					delete workspaceState[key];
				} else {
					workspaceState[key] = value;
				}
			},
			keys: (): readonly string[] => Object.keys(workspaceState),
		},
		globalState: {
			get: <T>(key: string, defaultValue?: T): T => {
				return (globalState[key] !== undefined ? globalState[key] : defaultValue) as T;
			},
			update: async (key: string, value: unknown): Promise<void> => {
				if (value === undefined) {
					delete globalState[key];
				} else {
					globalState[key] = value;
				}
			},
			keys: (): readonly string[] => Object.keys(globalState),
			setKeysForSync: () => undefined,
		},
	} as unknown as vscode.ExtensionContext;
	return { context, workspaceState, globalState };
}

function stubLifecycle(): FindingLifecycleRecord {
	return {
		logicalFingerprint: 'fp-1',
		contentFingerprint: 'content-1',
		scopeFingerprint: 'scope-1',
		ruleId: 'rule-sql',
		cweId: 'CWE-89',
		type: 'SQL Injection',
		severity: 'high',
		instanceName: 'executeQuery',
		filePath: '/workspace/src/db.java',
		lifecycleState: 'persisting',
		firstConfirmedAt: 1000,
		lastConfirmedAt: 2000,
		missingSince: null,
		provisionalResolutionAt: null,
		durableResolutionAt: null,
		baselineOccurrenceCount: 1,
		currentOccurrenceCount: 1,
		confirmationCount: 2,
		recurrenceCount: 0,
		lastRecurredAt: null,
		inSessionToggleCount: 0,
		identicalRestorationCount: 0,
	};
}

describe('SessionStore export and full wipe', () => {
	let tempDir: string;
	let store: SessionStore;
	let workspaceState: Record<string, unknown>;
	let globalState: Record<string, unknown>;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-session-store-'));
		const mock = createMockContext(tempDir);
		workspaceState = mock.workspaceState;
		globalState = mock.globalState;
		store = new SessionStore(mock.context);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	async function seedSessionData(): Promise<void> {
		const active = startSession('session-002', 2000);
		const completed = finalizeSession(startSession('session-001', 1000), [], 1500, 'completed');
		await store.saveActiveSession(active);
		await store.appendCompletedSession(completed);
		await store.saveFindingLifecycles([stubLifecycle()]);
		await store.saveGraduationHistory({ 'CWE-89': { graduatedAfterSessionIndex: 0 } });
		await store.saveSaveScanState({
			initialCheckpointDoneAt: 1234,
			totalSaveScansThisSession: 3,
			totalSettledCancellations: 1,
		});
		await store.saveSessionMeta({
			sessionStartTime: 111,
			totalScansCount: 9,
			scanIdSeed: 9,
			sessionIdSeed: 2,
		});
		await store.dismissNotification('toast-1');
		await store.saveExpandedVulnKey('CWE-89');
		await store.saveUserConfig({ notificationsEnabled: false });
		store.saveFinalizedSessionSync(completed);
	}

	it('exports all workspace session tracking fields in a versioned snapshot', async () => {
		await seedSessionData();

		const snapshot = store.exportSessionSnapshot();

		assert.strictEqual(snapshot.format, 'ariadne-session-export');
		assert.strictEqual(snapshot.version, 1);
		assert.ok(typeof snapshot.exportedAt === 'string' && snapshot.exportedAt.length > 0);
		assert.strictEqual(snapshot.activeSession?.sessionId, 'session-002');
		assert.strictEqual(snapshot.completedSessions.length, 1);
		assert.strictEqual(snapshot.completedSessions[0].sessionId, 'session-001');
		assert.strictEqual(snapshot.findingLifecycles.length, 1);
		assert.strictEqual(snapshot.findingLifecycles[0].cweId, 'CWE-89');
		assert.strictEqual(snapshot.sessionMeta.sessionIdSeed, 2);
		assert.strictEqual(snapshot.saveScanState.totalSaveScansThisSession, 3);
		assert.deepStrictEqual(snapshot.graduationHistory, {
			'CWE-89': { graduatedAfterSessionIndex: 0 },
		});
		assert.deepStrictEqual(snapshot.dismissedNotifications, ['toast-1']);
		assert.strictEqual(snapshot.pendingFinalizedSession?.sessionId, 'session-001');
		assert.strictEqual(snapshot.expandedVulnKey, 'CWE-89');
	});

	it('does not include GitHub auth or mutate storage when exporting', async () => {
		await seedSessionData();
		const beforeKeys = Object.keys(workspaceState).sort();

		store.exportSessionSnapshot();

		assert.deepStrictEqual(Object.keys(workspaceState).sort(), beforeKeys);
		assert.ok(fs.existsSync(store.getFinalizedSessionFilePath()));
	});

	it('clears every workspace session record and the pending finalized file', async () => {
		await seedSessionData();

		await store.clearAllLifecycleData();

		assert.strictEqual(store.loadActiveSession(), null);
		assert.deepStrictEqual(store.loadCompletedSessions(), []);
		assert.deepStrictEqual(store.loadFindingLifecycles(), []);
		assert.deepStrictEqual(store.loadGraduationHistory(), {});
		assert.deepStrictEqual(store.loadDismissedNotifications(), []);
		assert.strictEqual(store.loadExpandedVulnKey(), undefined);
		assert.deepStrictEqual(store.loadSaveScanState(), {
			initialCheckpointDoneAt: null,
			totalSaveScansThisSession: 0,
			totalSettledCancellations: 0,
		});
		const meta = store.loadSessionMeta();
		assert.strictEqual(meta.totalScansCount, 0);
		assert.strictEqual(meta.scanIdSeed, 0);
		assert.strictEqual(meta.sessionIdSeed, 0);
		assert.ok(!fs.existsSync(store.getFinalizedSessionFilePath()));
		assert.strictEqual(workspaceState[WS_ACTIVE_SESSION], undefined);
		assert.strictEqual(workspaceState[WS_COMPLETED_SESSIONS], undefined);
		assert.strictEqual(workspaceState[WS_FINDING_LIFECYCLES], undefined);
		assert.strictEqual(workspaceState[WS_GRADUATION_HISTORY], undefined);
		assert.strictEqual(workspaceState[WS_SAVE_SCAN_STATE], undefined);
		assert.strictEqual(workspaceState[WS_DISMISSED_NOTIFICATIONS], undefined);
		assert.strictEqual(workspaceState[WS_EXPANDED_VULN_KEY], undefined);
		assert.ok(workspaceState[WS_SESSION_META] !== undefined);
	});

	it('leaves global user config intact after a full session wipe', async () => {
		await seedSessionData();

		await store.clearAllLifecycleData();

		assert.deepStrictEqual(store.loadUserConfig(), { notificationsEnabled: false });
		assert.deepStrictEqual(globalState[GL_USER_CONFIG], { notificationsEnabled: false });
	});

	it('exports empty defaults after a full wipe', async () => {
		await seedSessionData();
		await store.clearAllLifecycleData();

		const snapshot = store.exportSessionSnapshot();
		assert.strictEqual(snapshot.activeSession, null);
		assert.deepStrictEqual(snapshot.completedSessions, []);
		assert.deepStrictEqual(snapshot.findingLifecycles, []);
		assert.strictEqual(snapshot.pendingFinalizedSession, null);
		assert.strictEqual(snapshot.expandedVulnKey, undefined);
	});
});
