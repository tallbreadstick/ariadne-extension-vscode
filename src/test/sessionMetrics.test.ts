import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type * as vscode from 'vscode';
import { buildSessionMetricsHtml } from '../modules/tracker/views/sessionMetrics.js';
import { toSessionMetrics, buildSessionAnalysis } from '../modules/tracker/analysis/snapshotAnalyzer.js';
import { computeCommonVulnerabilities } from '../modules/tracker/analysis/commonVulnerabilities.js';
import { SessionStore } from '../modules/tracker/storage/sessionStore.js';
import { startSession, finalizeSession } from '../modules/tracker/analysis/lifecycleEngine.js';
import type { SessionMetrics, CommonVulnerabilityItem } from '../modules/presentation/panelTypes.js';
import type { FindingLifecycleRecord } from '../modules/tracker/analysis/lifecycleTypes.js';

describe('Session Metrics UI & Startup Recovery Test Suite', () => {
	describe('1. Common Vulnerabilities Panel Empty State', () => {
		it('renders "Not enough session data yet" when totalSessionsAnalyzed < 2', () => {
			const metrics: SessionMetrics = {
				critical: 1,
				high: 2,
				medium: 0,
				low: 0,
				trends: {
					persistingPatterns: 1,
					improvingTrends: 0,
					resolvedThisSession: 0,
					recurringPatterns: 0,
				},
				commonVulnerabilities: [],
				totalSessionsAnalyzed: 1,
			};

			const html = buildSessionMetricsHtml(metrics);
			assert.ok(html.includes('Not enough session data yet'));
			assert.ok(!html.includes('No common vulnerabilities'));
		});

		it('renders "No common vulnerabilities" when totalSessionsAnalyzed >= 2 and items is empty', () => {
			const metrics: SessionMetrics = {
				critical: 1,
				high: 2,
				medium: 0,
				low: 0,
				trends: {
					persistingPatterns: 1,
					improvingTrends: 0,
					resolvedThisSession: 0,
					recurringPatterns: 0,
				},
				commonVulnerabilities: [],
				totalSessionsAnalyzed: 2,
			};

			const html = buildSessionMetricsHtml(metrics);
			assert.ok(html.includes('No common vulnerabilities'));
			assert.ok(!html.includes('Not enough session data yet'));
		});

		it('renders "No common vulnerabilities" when totalSessionsAnalyzed >= 2 and commonVulnerabilities is undefined', () => {
			const metrics: SessionMetrics = {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0,
				trends: {
					persistingPatterns: 0,
					improvingTrends: 0,
					resolvedThisSession: 0,
					recurringPatterns: 0,
				},
				commonVulnerabilities: undefined,
				totalSessionsAnalyzed: 3,
			};

			const html = buildSessionMetricsHtml(metrics);
			assert.ok(html.includes('No common vulnerabilities'));
			assert.ok(!html.includes('Not enough session data yet'));
		});

		it('renders common vulnerability cards when items are provided', () => {
			const items: CommonVulnerabilityItem[] = [
				{
					type: 'SQL Injection',
					cweId: 'CWE-89',
					sessionCount: 2,
					totalSessions: 2,
					activeFindingCount: 1,
				},
				{
					type: 'Path Traversal',
					cweId: 'CWE-22',
					sessionCount: 2,
					totalSessions: 2,
					activeFindingCount: 0,
				},
			];

			const metrics: SessionMetrics = {
				critical: 1,
				high: 0,
				medium: 0,
				low: 0,
				trends: {
					persistingPatterns: 1,
					improvingTrends: 0,
					resolvedThisSession: 0,
					recurringPatterns: 0,
				},
				commonVulnerabilities: items,
				totalSessionsAnalyzed: 2,
			};

			const html = buildSessionMetricsHtml(metrics);
			assert.ok(html.includes('SQL Injection'));
			assert.ok(html.includes('CWE-89'));
			assert.ok(html.includes('1 active'));
			assert.ok(html.includes('Path Traversal'));
			assert.ok(html.includes('CWE-22'));
			assert.ok(html.includes('all resolved'));
			assert.ok(!html.includes('No common vulnerabilities'));
			assert.ok(!html.includes('Not enough session data yet'));
		});
	});

	describe('2. toSessionMetrics Adapter', () => {
		it('preserves explicit totalSessionsAnalyzed', () => {
			const analysis = buildSessionAnalysis(
				[],
				{ scan_id: '1', timestamp: 1000, vulnerabilities: [] },
				null,
			);

			const metrics = toSessionMetrics(analysis, undefined, 4);
			assert.strictEqual(metrics.totalSessionsAnalyzed, 4);
		});

		it('extracts totalSessions from commonVulns when totalSessionsAnalyzed is not explicitly given', () => {
			const analysis = buildSessionAnalysis(
				[],
				{ scan_id: '1', timestamp: 1000, vulnerabilities: [] },
				null,
			);

			const commonMap = new Map([
				['CWE-89::SQL Injection', {
					type: 'SQL Injection',
					cweId: 'CWE-89',
					sessionCount: 2,
					totalSessions: 3,
					isGraduated: false,
					totalRecurrences: 0,
					activeFindingCount: 1,
				}],
			]);

			const metrics = toSessionMetrics(analysis, commonMap);
			assert.strictEqual(metrics.totalSessionsAnalyzed, 3);
			assert.strictEqual(metrics.commonVulnerabilities?.length, 1);
			assert.strictEqual(metrics.commonVulnerabilities[0].type, 'SQL Injection');
		});
	});

	describe('3. Reopening Session 2 after Finalized Session 1', () => {
		let tempDir: string;
		let mockContext: vscode.ExtensionContext;
		let storageState: Record<string, unknown>;

		beforeEach(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-reopen-'));
			storageState = {};
			mockContext = {
				storageUri: { fsPath: tempDir } as any,
				globalStorageUri: { fsPath: tempDir } as any,
				workspaceState: {
					get: <T>(key: string, defaultValue?: T): T => {
						return (storageState[key] !== undefined ? storageState[key] : defaultValue) as T;
					},
					update: (key: string, value: unknown): Thenable<void> => {
						storageState[key] = value;
						return Promise.resolve();
					},
					keys: (): readonly string[] => Object.keys(storageState),
				},
				globalState: {
					get: <T>(key: string, defaultValue?: T): T => {
						return (storageState[key] !== undefined ? storageState[key] : defaultValue) as T;
					},
					update: (key: string, value: unknown): Thenable<void> => {
						storageState[key] = value;
						return Promise.resolve();
					},
					keys: (): readonly string[] => Object.keys(storageState),
					setKeysForSync: () => {},
				},
			} as any;
		});

		afterEach(() => {
			try {
				fs.rmSync(tempDir, { recursive: true, force: true });
			} catch {
				// Cleanup best-effort
			}
		});

		it('pulls prior completed session 1 and renders baseline trends and common vulnerabilities on reopen', async () => {
			const store = new SessionStore(mockContext);

			// Session 1: completed with 1 resolved SQL injection and 1 persisting Path Traversal
			const session1 = startSession('session-001', 1000, null);
			const flcSql: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-sql',
				contentFingerprint: 'content-sql',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-sql',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high',
				instanceName: 'executeQuery',
				filePath: 'src/db.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 1000,
				confirmationCount: 2,
				missingSince: 2000,
				provisionalResolutionAt: 2000,
				durableResolutionAt: 5000,
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 0,
				isCommentedOut: false,
				lifecycleState: 'resolved',
			};
			const flcPath: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-path',
				contentFingerprint: 'content-path',
				scopeFingerprint: 'scope-path',
				ruleId: 'rule-path',
				cweId: 'CWE-22',
				type: 'Path Traversal',
				severity: 'medium',
				instanceName: 'readFile',
				filePath: 'src/file.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 5000,
				confirmationCount: 3,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 1,
				isCommentedOut: false,
				lifecycleState: 'persisting',
			};

			const lifecycles = [flcSql, flcPath];
			const finalizedSession1 = finalizeSession(session1, lifecycles, 6000, 'completed');
			await store.appendCompletedSession(finalizedSession1);
			await store.saveFindingLifecycles(lifecycles);

			// ── Reopen VS Code (Simulating Session 2 startup) ───────────────
			const storeReopened = new SessionStore(mockContext);
			const prior = storeReopened.loadPriorCompletedSession();
			assert.ok(prior, 'Prior completed session should be found on reopen');
			assert.strictEqual(prior.sessionId, 'session-001');
			assert.strictEqual(prior.status, 'completed');
			assert.strictEqual(prior.finalScores?.f, 5); // 1 resolved out of 2 = 5.00

			const restoredLifecycles = storeReopened.loadFindingLifecycles();
			assert.strictEqual(restoredLifecycles.length, 2);

			const completedSessions = storeReopened.loadCompletedSessions();
			assert.strictEqual(completedSessions.length, 1);

			// Compute Common Vulnerabilities on Session 2 startup (activeSession is null before first save)
			const graduationHistory = storeReopened.loadGraduationHistory();
			const commonVulns = computeCommonVulnerabilities(
				completedSessions,
				null,
				restoredLifecycles,
				graduationHistory,
			);

			// Because only 1 session is completed and activeSession is null, totalSessions = 1 (< 2)
			const totalSessionsAnalyzed = completedSessions.length;
			assert.strictEqual(totalSessionsAnalyzed, 1);

			// Construct SessionMetrics as extension.ts buildCurrentSessionMetrics does
			const metrics: SessionMetrics = {
				critical: 0,
				high: 0,
				medium: 1,
				low: 0,
				trends: {
					persistingPatterns: 1,
					improvingTrends: 0,
					resolvedThisSession: 1,
					recurringPatterns: 0,
					fixScore: prior.finalScores?.f,
					persistenceScore: prior.finalScores?.p,
					trendScore: prior.finalScores?.t,
				},
				commonVulnerabilities: commonVulns.size > 0 ? Array.from(commonVulns.values()) : undefined,
				totalSessionsAnalyzed,
			};

			const html = buildSessionMetricsHtml(metrics);

			// Assert UI contains the restored metrics rather than blank/zeros
			assert.ok(html.includes('Medium Issues'));
			assert.ok(html.includes('<span>1</span>')); // 1 medium issue
			assert.ok(html.includes('Persisting Patterns'));
			assert.ok(html.includes('Resolved'));
			assert.ok(html.includes('Not enough session data yet')); // totalSessions = 1
		});
	});
});
