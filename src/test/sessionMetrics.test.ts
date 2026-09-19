import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type * as vscode from 'vscode';
import { buildSessionMetricsHtml } from '../modules/tracker/views/sessionMetrics.js';
import { toSessionMetrics, buildSessionAnalysis } from '../modules/tracker/analysis/snapshotAnalyzer.js';
import { computeCommonVulnerabilities, COMMON_VULN_POLICY } from '../modules/tracker/analysis/commonVulnerabilities.js';
import { SessionStore } from '../modules/tracker/storage/sessionStore.js';
import { startSession, finalizeSession } from '../modules/tracker/analysis/lifecycleEngine.js';
import { HOURLY_SCAN_INTERVAL_MS } from '../extension.js';
import type { SessionMetrics, CommonVulnerabilityItem } from '../modules/presentation/panelTypes.js';
import type { FindingLifecycleRecord, SessionRecord, FindingClassification } from '../modules/tracker/analysis/lifecycleTypes.js';

describe('Session Metrics UI & Startup Recovery Test Suite', () => {
	describe('1. Common Vulnerabilities Panel Empty State', () => {
		it('renders "Not enough session data yet" when totalSessionsAnalyzed < 3', () => {
			const metrics1: SessionMetrics = {
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

			const html1 = buildSessionMetricsHtml(metrics1);
			assert.ok(html1.includes('Not enough session data yet'));
			assert.ok(!html1.includes('No common vulnerabilities'));

			const metrics2: SessionMetrics = {
				...metrics1,
				totalSessionsAnalyzed: 2,
			};
			const html2 = buildSessionMetricsHtml(metrics2);
			assert.ok(html2.includes('Not enough session data yet'));
			assert.ok(!html2.includes('No common vulnerabilities'));
		});

		it('renders "No common vulnerabilities" when totalSessionsAnalyzed >= 3 and items is empty', () => {
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
				totalSessionsAnalyzed: 3,
			};

			const html = buildSessionMetricsHtml(metrics);
			assert.ok(html.includes('No common vulnerabilities'));
			assert.ok(!html.includes('Not enough session data yet'));
		});

		it('renders "No common vulnerabilities" when totalSessionsAnalyzed >= 3 and commonVulnerabilities is undefined', () => {
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
					totalInstanceCount: 1,
					activeFindingCount: 1,
				},
				{
					type: 'Path Traversal',
					cweId: 'CWE-22',
					sessionCount: 2,
					totalSessions: 2,
					totalInstanceCount: 1,
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
					totalInstanceCount: 1,
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

	describe('4. Common Vulnerabilities K=3 Policy & Sorting', () => {
		// Each session gets DIFFERENT fingerprints per finding so the new-instance
		// counting treats each session's finding as a genuinely new creation.
		function createMockSession(id: string, findings: Array<{ type: string; cweId: string; state: 'persisting' | 'resolved' }>): SessionRecord {
			const summaries: FindingLifecycleRecord[] = findings.map((f, i) => ({
				logicalFingerprint: `fp-${id}-${f.cweId}-${i}`,
				contentFingerprint: `content-${id}-${i}`,
				scopeFingerprint: `scope-${id}-${i}`,
				ruleId: `rule-${f.cweId}`,
				cweId: f.cweId,
				type: f.type,
				severity: 'high',
				instanceName: `inst-${i}`,
				filePath: `src/file-${i}.ts`,
				firstConfirmedAt: 1000,
				lastConfirmedAt: 2000,
				confirmationCount: 2,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: f.state === 'persisting' ? 1 : 0,
				isCommentedOut: false,
				lifecycleState: f.state,
			}));

			return {
				sessionId: id,
				status: 'completed',
				startedAt: 1000,
				endedAt: 2000,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: summaries,
			};
		}

		const activeFlcSql: FindingLifecycleRecord = {
			logicalFingerprint: 'fp-active-sql',
			contentFingerprint: 'content-sql',
			scopeFingerprint: 'scope-sql',
			ruleId: 'rule-CWE-89',
			cweId: 'CWE-89',
			type: 'SQL Injection',
			severity: 'high',
			instanceName: 'inst-sql',
			filePath: 'src/file.ts',
			firstConfirmedAt: 1000,
			lastConfirmedAt: 3000,
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

		it('requires K=3 sessions with NEW instances for a vulnerability to qualify as Common', () => {
			const session1 = createMockSession('s1', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'persisting' },
				{ type: 'Cross-Site Scripting', cweId: 'CWE-79', state: 'persisting' },
			]);
			const session2 = createMockSession('s2', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'persisting' },
			]);

			// After 2 sessions with different SQL Injection fingerprints, sessionCount = 2 (< 3)
			const commonAfter2 = computeCommonVulnerabilities(
				[session1, session2],
				null,
				[activeFlcSql],
				{},
			);
			assert.strictEqual(commonAfter2.size, 0, 'No common vulnerabilities when K=3 and only 2 sessions with new instances');

			// After 3rd session with a NEW SQL Injection fingerprint
			const session3 = createMockSession('s3', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'persisting' },
				{ type: 'Path Traversal', cweId: 'CWE-22', state: 'persisting' },
			]);
			const commonAfter3 = computeCommonVulnerabilities(
				[session1, session2, session3],
				null,
				[activeFlcSql],
				{},
			);
			assert.strictEqual(commonAfter3.size, 1);
			const sql = commonAfter3.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.sessionCount, 3);
			assert.strictEqual(sql?.activeFindingCount, 1);
		});

		it('sorts common vulnerabilities descending by totalInstanceCount then sessionCount', () => {
			const s1 = createMockSession('s1', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'persisting' },
				{ type: 'Cross-Site Scripting', cweId: 'CWE-79', state: 'persisting' },
				{ type: 'Path Traversal', cweId: 'CWE-22', state: 'resolved' },
			]);
			const s2 = createMockSession('s2', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'resolved' },
				{ type: 'Cross-Site Scripting', cweId: 'CWE-79', state: 'persisting' },
				{ type: 'Path Traversal', cweId: 'CWE-22', state: 'resolved' },
			]);
			const s3 = createMockSession('s3', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'persisting' },
				{ type: 'Cross-Site Scripting', cweId: 'CWE-79', state: 'persisting' },
				{ type: 'Path Traversal', cweId: 'CWE-22', state: 'resolved' },
			]);
			const s4 = createMockSession('s4', [
				{ type: 'Cross-Site Scripting', cweId: 'CWE-79', state: 'persisting' },
			]);

			const common = computeCommonVulnerabilities(
				[s1, s2, s3, s4],
				null,
				[activeFlcSql],
				{},
			);

			const list = Array.from(common.values());
			assert.strictEqual(list.length, 3);
			// Sort is by totalInstanceCount desc, then sessionCount desc, then alpha
			// XSS: 4 FLCs (one per session), sessionCount = 4
			// SQL: 3 FLCs + 1 active FLC = 1 totalInstance (only activeFlcSql), sessionCount = 3
			// Path Traversal: 3 FLCs, sessionCount = 3
			// All have different fingerprints per session so totalInstanceCount = number of FLCs
			// Since activeFlcSql is the only FLC passed in currentLifecycles, SQL has 1 instance
			// But XSS and Path Traversal FLCs are NOT in currentLifecycles → 0 instances
			// Actually totalInstanceCount comes from currentLifecycles filter, so only SQL = 1
			// 1st: SQL Injection (totalInstanceCount = 1)
			assert.strictEqual(list[0].type, 'SQL Injection');
			assert.strictEqual(list[0].totalInstanceCount, 1);
			assert.strictEqual(list[0].sessionCount, 3);
			// 2nd and 3rd: XSS and Path Traversal both have 0 instances
			// Tiebreak by sessionCount: XSS (4) > Path Traversal (3)
			assert.strictEqual(list[1].type, 'Cross-Site Scripting');
			assert.strictEqual(list[1].sessionCount, 4);
			assert.strictEqual(list[1].totalInstanceCount, 0);
			assert.strictEqual(list[2].type, 'Path Traversal');
			assert.strictEqual(list[2].sessionCount, 3);
			assert.strictEqual(list[2].totalInstanceCount, 0);
		});

		it('does NOT inflate session count when the same finding persists across hourly checkpoints', () => {
			// Same logicalFingerprint in all 3 milestones = 1 persisting finding
			const mockFinding = {
				logicalFingerprint: 'fp-sql-same',
				contentFingerprint: 'content-sql',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-CWE-89',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high' as const,
				instanceName: 'inst-sql',
				filePath: 'src/db.ts',
				occurrenceCount: 1,
			};

			const activeSession: SessionRecord = {
				sessionId: 'session-lab-persist',
				status: 'active',
				startedAt: 1000,
				endedAt: null,
				baselineCheckpoint: { timestamp: 1000, findings: [mockFinding] },
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [],
				hourlyCheckpoints: [
					{ timestamp: 2000, findings: [mockFinding] },
					{ timestamp: 3000, findings: [mockFinding] },
				],
			};

			const activeFLC: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-sql-same',
				contentFingerprint: 'content-sql',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-CWE-89',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high',
				instanceName: 'inst-sql',
				filePath: 'src/db.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 3000,
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

			const common = computeCommonVulnerabilities(
				[],
				activeSession,
				[activeFLC],
				{},
			);

			// Session-presence counting: same finding present in 3 milestones = sessionCount 3
			assert.strictEqual(common.size, 1, 'Same finding present in 3 milestones SHOULD reach K=3 with session-presence counting');
			const sql = common.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.sessionCount, 3);
			assert.strictEqual(sql?.totalInstanceCount, 1, 'Only 1 FLC instance despite 3 sessions');
			assert.strictEqual(sql?.activeFindingCount, 1);
		});

		it('qualifies when DIFFERENT fingerprints appear in hourly checkpoints', () => {
			// Three different SQL Injection findings in 3 hourly milestones
			const finding1 = {
				logicalFingerprint: 'fp-sql-1',
				contentFingerprint: 'content-sql',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-CWE-89',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high' as const,
				instanceName: 'inst-sql-1',
				filePath: 'src/db1.ts',
				occurrenceCount: 1,
			};
			const finding2 = {
				...finding1,
				logicalFingerprint: 'fp-sql-2',
				instanceName: 'inst-sql-2',
				filePath: 'src/db2.ts',
			};
			const finding3 = {
				...finding1,
				logicalFingerprint: 'fp-sql-3',
				instanceName: 'inst-sql-3',
				filePath: 'src/db3.ts',
			};

			const activeSession: SessionRecord = {
				sessionId: 'session-lab-new',
				status: 'active',
				startedAt: 1000,
				endedAt: null,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [],
				hourlyCheckpoints: [
					{ timestamp: 2000, findings: [finding1] },
					{ timestamp: 3000, findings: [finding1, finding2] },
				],
			};

			const activeFLCs: FindingLifecycleRecord[] = [finding1, finding2, finding3].map(f => ({
				logicalFingerprint: f.logicalFingerprint,
				contentFingerprint: f.contentFingerprint,
				scopeFingerprint: f.scopeFingerprint,
				ruleId: f.ruleId,
				cweId: f.cweId,
				type: f.type,
				severity: f.severity,
				instanceName: f.instanceName,
				filePath: f.filePath,
				firstConfirmedAt: 1000,
				lastConfirmedAt: 3000,
				confirmationCount: 2,
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
			}));

			const common = computeCommonVulnerabilities(
				[],
				activeSession,
				activeFLCs,
				{},
			);

			assert.strictEqual(common.size, 1);
			const sql = common.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.sessionCount, 3, 'Three distinct fingerprints across milestones = sessionCount 3');
			assert.strictEqual(sql?.activeFindingCount, 3);
		});
	});

	describe('5. Hourly Auto Full Scan Interval & Constants', () => {
		it('HOURLY_SCAN_INTERVAL_MS is configured to 60 minutes (3600000 ms)', () => {
			assert.strictEqual(HOURLY_SCAN_INTERVAL_MS, 60 * 60 * 1000);
		});

		it('COMMON_VULN_POLICY.K defaults to 3', () => {
			assert.strictEqual(COMMON_VULN_POLICY.K, 3);
		});
	});

	describe('6. Reintroduced Vulnerability Classification & Rendering', () => {
		it('places reintroduced finding exclusively under recurring and does not trigger blank improving trend', () => {
			const reintroducedPathFlc: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-path-reintroduced',
				contentFingerprint: 'content-path',
				scopeFingerprint: 'scope-path',
				ruleId: 'rule-path-traversal',
				cweId: 'CWE-22',
				type: 'Path Traversal',
				severity: 'high',
				instanceName: 'readFile',
				filePath: 'src/file.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 5000,
				confirmationCount: 3,
				missingSince: null,
				provisionalResolutionAt: 2000,
				durableResolutionAt: 3000,
				recurrenceCount: 1,
				lastRecurredAt: 5000,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 1,
				isCommentedOut: false,
				lifecycleState: 'recurring',
			};

			const classifications: FindingClassification[] = [
				{
					lifecycle: reintroducedPathFlc,
					status: 'recurring',
					previousOccurrenceCount: 0,
					currentOccurrenceCount: 1,
				},
			];

			const mockScan = {
				scan_id: 'scan-2',
				timestamp: 5000,
				vulnerabilities: [
					{
						id: 'vuln-path',
						rule_id: 'rule-path-traversal',
						cwe_id: 'CWE-22',
						owasp_category: 'A01:2021 - Broken Access Control',
						type: 'Path Traversal',
						severity: 'high' as const,
						message: 'Path Traversal',
						file_path: 'src/file.ts',
						line_number: 10,
						instances: [
							{
								name: 'readFile',
								kind: 'method' as const,
								occurrences: [],
							},
						],
					},
				],
			};

			const analysis = buildSessionAnalysis(classifications, mockScan, null);

			assert.strictEqual(analysis.recurringPatterns, 1, 'Should have 1 recurring pattern');
			assert.strictEqual(analysis.improvingTrends, 0, 'Should NOT have any improving trends');
			assert.strictEqual(analysis.persistingPatterns, 0, 'Should NOT have persisting patterns');

			const metrics = toSessionMetrics(analysis);
			assert.strictEqual(metrics.trends.recurringPatterns, 1);
			assert.strictEqual(metrics.trends.improvingTrends, 0);
			assert.strictEqual(metrics.trends.improvingItems, undefined);
			assert.ok(metrics.trends.recurringItems && metrics.trends.recurringItems.length === 1);
			assert.strictEqual(metrics.trends.recurringItems[0].type, 'Path Traversal');

			const html = buildSessionMetricsHtml(metrics);
			assert.ok(html.includes('Recurring Patterns'));
			assert.ok(html.includes('Path Traversal'));
			assert.ok(!html.includes('class="trend-sub-item trend-sub-placeholder"'), 'Should never render placeholder in sub-items');
			assert.ok(!html.includes('<span class="sub-label">—</span>'), 'Should not contain blank — label');
		});

		it('correctly reports improving trends when there is genuine partial progress (persisting + resolved)', () => {
			const resolvedFlc: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-sql-resolved',
				contentFingerprint: 'content-sql-1',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-sql',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high',
				instanceName: 'executeQuery1',
				filePath: 'src/db.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 2000,
				confirmationCount: 2,
				missingSince: 3000,
				provisionalResolutionAt: 3000,
				durableResolutionAt: 4000,
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 0,
				isCommentedOut: false,
				lifecycleState: 'resolved',
			};

			const persistingFlc: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-sql-persisting',
				contentFingerprint: 'content-sql-2',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-sql',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high',
				instanceName: 'executeQuery2',
				filePath: 'src/db.ts',
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

			const classifications: FindingClassification[] = [
				{
					lifecycle: resolvedFlc,
					status: 'resolved',
					previousOccurrenceCount: 1,
					currentOccurrenceCount: 0,
				},
				{
					lifecycle: persistingFlc,
					status: 'persisting',
					previousOccurrenceCount: 1,
					currentOccurrenceCount: 1,
				},
			];

			const mockScan = {
				scan_id: 'scan-3',
				timestamp: 5000,
				vulnerabilities: [
					{
						id: 'vuln-sql-2',
						rule_id: 'rule-sql',
						cwe_id: 'CWE-89',
						owasp_category: 'A03:2021 - Injection',
						type: 'SQL Injection',
						severity: 'high' as const,
						message: 'SQL Injection',
						file_path: 'src/db.ts',
						line_number: 20,
						instances: [
							{
								name: 'executeQuery2',
								kind: 'method' as const,
								occurrences: [],
							},
						],
					},
				],
			};

			const analysis = buildSessionAnalysis(classifications, mockScan, null);
			assert.strictEqual(analysis.resolvedThisSession, 1);
			assert.strictEqual(analysis.improvingTrends, 1);
			assert.strictEqual(analysis.persistingPatterns, 0);

			const metrics = toSessionMetrics(analysis);
			assert.strictEqual(metrics.trends.improvingTrends, 1);
			assert.ok(metrics.trends.improvingItems && metrics.trends.improvingItems.length === 1);
			assert.strictEqual(metrics.trends.improvingItems[0].type, 'SQL Injection');

			const html = buildSessionMetricsHtml(metrics);
			assert.ok(html.includes('Improving Trends'));
			assert.ok(html.includes('SQL Injection'));
			assert.ok(!html.includes('class="trend-sub-item trend-sub-placeholder"'));
		});

		it('ignores historical resolutions from prior sessions and does not trigger false improving trend on reintroduction', () => {
			const historicalResolvedFlc: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-sql-historical',
				contentFingerprint: 'content-sql-1',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-sql',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high',
				instanceName: 'executeQuery1',
				filePath: 'src/db.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 2000,
				confirmationCount: 2,
				missingSince: 3000,
				provisionalResolutionAt: 3000,
				durableResolutionAt: 4000, // Resolved at t=4000 in Session 1
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 0,
				isCommentedOut: false,
				lifecycleState: 'resolved',
			};

			const reintroducedPersistingFlc: FindingLifecycleRecord = {
				logicalFingerprint: 'fp-sql-reintroduced',
				contentFingerprint: 'content-sql-2',
				scopeFingerprint: 'scope-sql',
				ruleId: 'rule-sql',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high',
				instanceName: 'executeQuery2',
				filePath: 'src/db.ts',
				firstConfirmedAt: 10000,
				lastConfirmedAt: 15000,
				confirmationCount: 3,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				recurrenceCount: 1,
				lastRecurredAt: 10000,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 1,
				isCommentedOut: false,
				lifecycleState: 'persisting',
			};

			const classifications: FindingClassification[] = [
				{
					lifecycle: historicalResolvedFlc,
					status: 'resolved',
					previousOccurrenceCount: 1,
					currentOccurrenceCount: 0,
				},
				{
					lifecycle: reintroducedPersistingFlc,
					status: 'persisting',
					previousOccurrenceCount: 1,
					currentOccurrenceCount: 1,
				},
			];

			const mockScan = {
				scan_id: 'scan-current',
				timestamp: 15000,
				vulnerabilities: [
					{
						id: 'vuln-sql-reintroduced',
						rule_id: 'rule-sql',
						cwe_id: 'CWE-89',
						owasp_category: 'A03:2021 - Injection',
						type: 'SQL Injection',
						severity: 'high' as const,
						message: 'SQL Injection',
						file_path: 'src/db.ts',
						line_number: 20,
						instances: [
							{
								name: 'executeQuery2',
								kind: 'method' as const,
								occurrences: [],
							},
						],
					},
				],
			};

			// Active session started at t=10000 (after historical resolution at t=4000)
			const activeSessionStartedAt = 10000;
			const analysis = buildSessionAnalysis(
				classifications,
				mockScan,
				null,
				undefined,
				null,
				activeSessionStartedAt,
			);

			// Historical resolution should be excluded from this session
			assert.strictEqual(analysis.resolvedThisSession, 0, 'Prior session resolution must not count toward resolvedThisSession');
			assert.strictEqual(analysis.improvingTrends, 0, 'Prior session resolution must not pair with reintroduced finding to trigger improving');
			assert.strictEqual(analysis.persistingPatterns, 1, 'Reintroduced finding should remain persisting');

			const metrics = toSessionMetrics(analysis);
			assert.strictEqual(metrics.trends.resolvedThisSession, 0);
			assert.strictEqual(metrics.trends.improvingTrends, 0);
			assert.strictEqual(metrics.trends.persistingPatterns, 1);
		});

		it('formats improving progress delta cleanly without duplicate +- signs and matches header instance count', () => {
			const metrics: SessionMetrics = {
				critical: 0,
				high: 2,
				medium: 0,
				low: 0,
				trends: {
					persistingPatterns: 0,
					improvingTrends: 2, // 2 instances across improving items
					resolvedThisSession: 1,
					recurringPatterns: 0,
					improvingItems: [
						{
							type: 'SQL Injection',
							instances: 2,
							progressLabel: 'Some progress',
							progressDelta: '+2.00', // Already signed delta
						},
					],
				},
			};

			const html = buildSessionMetricsHtml(metrics);
			// Check that duplicate (+- or (++ does not occur
			assert.ok(!html.includes('(+-'), 'Should not contain (+- sign');
			assert.ok(!html.includes('(++'), 'Should not contain (++ sign');
			assert.ok(html.includes('Some progress (+2.00)'));
			assert.ok(html.includes('<span class="sub-label">SQL Injection</span>'));
			// Check that header instance count displays 2, matching instances
			assert.ok(html.includes('Instances :  <span style="color: var(--text); font-weight: 700;">2</span>'));
		});
	});

	describe('7. Common Vulnerabilities Prevention-Aware Counting & Graduation', () => {
		function makeFLC(overrides: Partial<FindingLifecycleRecord> & { logicalFingerprint: string; cweId: string; type: string }): FindingLifecycleRecord {
			return {
				contentFingerprint: 'c',
				scopeFingerprint: 's',
				ruleId: 'r',
				severity: 'high',
				instanceName: 'i',
				filePath: 'f.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 2000,
				confirmationCount: 2,
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
				...overrides,
			};
		}

		function makeSession(id: string, flcs: FindingLifecycleRecord[]): SessionRecord {
			return {
				sessionId: id,
				status: 'completed',
				startedAt: 1000,
				endedAt: 2000,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: flcs,
			};
		}

		it('does not graduate when all resolved but a new instance was created recently', () => {
			// 3 sessions each with a new SQL Injection fingerprint
			const s1 = makeSession('s1', [makeFLC({ logicalFingerprint: 'fp-1', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000 })]);
			const s2 = makeSession('s2', [makeFLC({ logicalFingerprint: 'fp-2', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000 })]);
			const s3 = makeSession('s3', [makeFLC({ logicalFingerprint: 'fp-3', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000 })]);

			// All resolved in current lifecycles
			const currentFLCs = [
				makeFLC({ logicalFingerprint: 'fp-1', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000, missingSince: 5000, currentOccurrenceCount: 0 }),
				makeFLC({ logicalFingerprint: 'fp-2', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000, missingSince: 5000, currentOccurrenceCount: 0 }),
				makeFLC({ logicalFingerprint: 'fp-3', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000, missingSince: 5000, currentOccurrenceCount: 0 }),
			];

			const gradHistory: Record<string, any> = {};
			const common = computeCommonVulnerabilities([s1, s2, s3], null, currentFLCs, gradHistory);

			// s3 has a new instance → only 0 consecutive sessions without new instances
			// Need G=2 clean sessions → NOT graduated
			assert.strictEqual(common.size, 1, 'Should still be Common — new instance in most recent session');
			const sql = common.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.sessionCount, 3);
		});

		it('graduates when all resolved AND no new instances for G=2 consecutive sessions', () => {
			// s1 has a new SQL Injection, s2 and s3 have none (clean)
			const s1 = makeSession('s1', [makeFLC({ logicalFingerprint: 'fp-1', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000 })]);
			const s2 = makeSession('s2', [makeFLC({ logicalFingerprint: 'fp-xss-1', cweId: 'CWE-79', type: 'XSS' })]);
			const s3 = makeSession('s3', [makeFLC({ logicalFingerprint: 'fp-xss-2', cweId: 'CWE-79', type: 'XSS' })]);
			const s4 = makeSession('s4', [makeFLC({ logicalFingerprint: 'fp-xss-3', cweId: 'CWE-79', type: 'XSS' })]);

			// SQL Injection needs K=3 to qualify. Only 1 session has it → NOT common, so cannot graduate.
			// Let's give it 3 sessions with new instances, then 2 clean sessions.
			const sq1 = makeSession('sq1', [makeFLC({ logicalFingerprint: 'fp-sq1', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000 })]);
			const sq2 = makeSession('sq2', [makeFLC({ logicalFingerprint: 'fp-sq2', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000 })]);
			const sq3 = makeSession('sq3', [makeFLC({ logicalFingerprint: 'fp-sq3', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000 })]);
			const clean1 = makeSession('clean1', [makeFLC({ logicalFingerprint: 'fp-other-1', cweId: 'CWE-79', type: 'XSS' })]);
			const clean2 = makeSession('clean2', [makeFLC({ logicalFingerprint: 'fp-other-2', cweId: 'CWE-79', type: 'XSS' })]);

			const currentFLCs = [
				makeFLC({ logicalFingerprint: 'fp-sq1', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000, missingSince: 5000, currentOccurrenceCount: 0 }),
				makeFLC({ logicalFingerprint: 'fp-sq2', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000, missingSince: 5000, currentOccurrenceCount: 0 }),
				makeFLC({ logicalFingerprint: 'fp-sq3', cweId: 'CWE-89', type: 'SQL Injection', durableResolutionAt: 5000, missingSince: 5000, currentOccurrenceCount: 0 }),
			];

			const gradHistory: Record<string, any> = {};
			const common = computeCommonVulnerabilities(
				[sq1, sq2, sq3, clean1, clean2],
				null,
				currentFLCs,
				gradHistory,
			);

			assert.strictEqual(common.size, 0, 'SQL Injection should have graduated');
			assert.ok(gradHistory['CWE-89::SQL Injection'], 'Graduation history should be recorded');
		});

		it('does NOT graduate when active instances remain even with no new instances for G sessions', () => {
			const sq1 = makeSession('sq1', [makeFLC({ logicalFingerprint: 'fp-sq1', cweId: 'CWE-89', type: 'SQL Injection' })]);
			const sq2 = makeSession('sq2', [makeFLC({ logicalFingerprint: 'fp-sq2', cweId: 'CWE-89', type: 'SQL Injection' })]);
			const sq3 = makeSession('sq3', [makeFLC({ logicalFingerprint: 'fp-sq3', cweId: 'CWE-89', type: 'SQL Injection' })]);
			// 2 clean sessions after
			const clean1 = makeSession('clean1', [makeFLC({ logicalFingerprint: 'fp-other-1', cweId: 'CWE-79', type: 'XSS' })]);
			const clean2 = makeSession('clean2', [makeFLC({ logicalFingerprint: 'fp-other-2', cweId: 'CWE-79', type: 'XSS' })]);

			// SQL Injection FLCs are NOT resolved (durableResolutionAt = null)
			const currentFLCs = [
				makeFLC({ logicalFingerprint: 'fp-sq1', cweId: 'CWE-89', type: 'SQL Injection' }),
				makeFLC({ logicalFingerprint: 'fp-sq2', cweId: 'CWE-89', type: 'SQL Injection' }),
				makeFLC({ logicalFingerprint: 'fp-sq3', cweId: 'CWE-89', type: 'SQL Injection' }),
			];

			const gradHistory: Record<string, any> = {};
			const common = computeCommonVulnerabilities(
				[sq1, sq2, sq3, clean1, clean2],
				null,
				currentFLCs,
				gradHistory,
			);

			assert.strictEqual(common.size, 1, 'Should still be Common — active instances prevent graduation');
			const sql = common.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.activeFindingCount, 3);
		});

		it('persisting finding DOES reach K=3 via session-presence but totalInstanceCount stays 1', () => {
			// Same fingerprint in all 3 completed sessions = same finding persisting
			const sameFLC = makeFLC({ logicalFingerprint: 'fp-persist', cweId: 'CWE-89', type: 'SQL Injection' });
			const s1 = makeSession('s1', [sameFLC]);
			const s2 = makeSession('s2', [sameFLC]);
			const s3 = makeSession('s3', [sameFLC]);

			const common = computeCommonVulnerabilities(
				[s1, s2, s3],
				null,
				[sameFLC],
				{},
			);

			// Session-presence counting: present in 3 sessions = sessionCount 3 = reaches K
			assert.strictEqual(common.size, 1, 'Persisting finding present in 3 sessions SHOULD reach K=3');
			const sql = common.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.sessionCount, 3);
			assert.strictEqual(sql?.totalInstanceCount, 1, 'Only 1 FLC despite 3 sessions');
		});

		it('recurring finding counts toward K via session-presence but totalInstanceCount stays 1', () => {
			// Same fingerprint appears in s1, disappears in s2, reappears in s3
			const recurrFLC = makeFLC({
				logicalFingerprint: 'fp-recurr',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				recurrenceCount: 1,
			});
			const s1 = makeSession('s1', [recurrFLC]);
			const s2 = makeSession('s2', []); // finding absent
			const s3 = makeSession('s3', [recurrFLC]); // same fingerprint reappears

			const common = computeCommonVulnerabilities(
				[s1, s2, s3],
				null,
				[recurrFLC],
				{},
			);

			// Session-presence: present in s1 and s3 = sessionCount 2 (< K=3) → NOT common
			assert.strictEqual(common.size, 0, 'Recurring finding present in 2 of 3 sessions should NOT reach K=3');
		});

		it('does NOT graduate when a persisting finding is finally resolved after G sessions of inaction', () => {
			// Session 1: SQL Injection created (persisting finding fp-sq1)
			const activeFLC = makeFLC({ logicalFingerprint: 'fp-sq1', cweId: 'CWE-89', type: 'SQL Injection' });
			const s1 = makeSession('s1', [activeFLC]);
			// Session 2: User did nothing, fp-sq1 remained active
			const s2 = makeSession('s2', [activeFLC]);
			// Session 3: User did nothing, fp-sq1 remained active
			const s3 = makeSession('s3', [activeFLC]);

			// Session 4 (active session): User finally resolves fp-sq1
			const resolvedFLC = makeFLC({
				logicalFingerprint: 'fp-sq1',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				durableResolutionAt: 5000,
				missingSince: 5000,
				currentOccurrenceCount: 0,
			});

			const gradHistory: Record<string, any> = {};
			const common = computeCommonVulnerabilities(
				[s1, s2, s3],
				null,
				[resolvedFLC],
				gradHistory,
			);

			// In s2 and s3, fp-sq1 was ACTIVE. Inaction while a bug is active does NOT count as probation.
			// Therefore, consecutive clean sessions = 0.
			assert.strictEqual(common.size, 1, 'Should NOT graduate immediately upon resolution without a post-fix probation period');
			const sql = common.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.activeFindingCount, 0, 'Active finding count is 0 (all resolved)');
			assert.strictEqual(gradHistory['CWE-89::SQL Injection'], undefined, 'Must not be recorded in graduation history');
		});

		it('graduates after G clean completed sessions following the fix', () => {
			const activeFLC = makeFLC({ logicalFingerprint: 'fp-sq1', cweId: 'CWE-89', type: 'SQL Injection' });
			const s1 = makeSession('s1', [activeFLC]);
			const s2 = makeSession('s2', [activeFLC]);
			const s3 = makeSession('s3', [activeFLC]);

			const resolvedFLC = makeFLC({
				logicalFingerprint: 'fp-sq1',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				durableResolutionAt: 5000,
				missingSince: 5000,
				currentOccurrenceCount: 0,
			});
			// Session 4: Fixed during session, finalized with resolvedFLC (clean at session end)
			const s4 = makeSession('s4', [resolvedFLC]);
			// Session 5: Clean session (all resolved, no new instances)
			const s5 = makeSession('s5', [resolvedFLC]);

			const gradHistory: Record<string, any> = {};
			const common = computeCommonVulnerabilities(
				[s1, s2, s3, s4, s5],
				null,
				[resolvedFLC],
				gradHistory,
			);

			// s4 and s5 both had all resolved and no new instances (2 clean completed sessions post-fix)
			assert.strictEqual(common.size, 0, 'Should graduate after G=2 clean completed sessions');
			assert.ok(gradHistory['CWE-89::SQL Injection']);
		});

		it('does NOT graduate if an hourly checkpoint within a completed session had the vulnerability active', () => {
			const activeFLC = makeFLC({ logicalFingerprint: 'fp-sq1', cweId: 'CWE-89', type: 'SQL Injection' });
			const s1 = makeSession('s1', [activeFLC]);
			const s2 = makeSession('s2', [activeFLC]);

			const resolvedFLC = makeFLC({
				logicalFingerprint: 'fp-sq1',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				durableResolutionAt: 5000,
				missingSince: 5000,
				currentOccurrenceCount: 0,
			});

			// Session 3 had an active hourly checkpoint before being resolved at session end
			const s3WithCheckpoint: SessionRecord = {
				...makeSession('s3', [resolvedFLC]),
				hourlyCheckpoints: [
					{
						timestamp: 2500,
						findings: [{
							logicalFingerprint: 'fp-sq1',
							contentFingerprint: 'c1',
							scopeFingerprint: 's1',
							ruleId: 'r1',
							cweId: 'CWE-89',
							type: 'SQL Injection',
							severity: 'high',
							instanceName: 'inst1',
							filePath: 'src/db.ts',
							occurrenceCount: 1,
						}],
					},
				],
			};

			// Session 4 is completely clean
			const s4 = makeSession('s4', [resolvedFLC]);

			const gradHistory: Record<string, any> = {};
			const common = computeCommonVulnerabilities(
				[s1, s2, s3WithCheckpoint, s4],
				null,
				[resolvedFLC],
				gradHistory,
			);

			// s3 had an active hourly checkpoint, so only s4 is clean (1 clean session < G=2)
			assert.strictEqual(common.size, 1, 'Should NOT graduate because s3 had an active hourly checkpoint');
			assert.strictEqual(gradHistory['CWE-89::SQL Injection'], undefined);
		});

		it('does NOT graduate when a new unique vulnerability is born in the active session and resolved within the same session', () => {
			// Prior completed sessions exist (e.g. s1, s2 with XSS only)
			const s1 = makeSession('s1', [makeFLC({ logicalFingerprint: 'fp-xss-1', cweId: 'CWE-79', type: 'XSS' })]);
			const s2 = makeSession('s2', [makeFLC({ logicalFingerprint: 'fp-xss-2', cweId: 'CWE-79', type: 'XSS' })]);

			const ldapFinding = {
				logicalFingerprint: 'fp-ldap-1',
				contentFingerprint: 'c-ldap',
				scopeFingerprint: 's-ldap',
				ruleId: 'r-ldap',
				cweId: 'CWE-90',
				type: 'LDAP Injection',
				severity: 'high' as const,
				instanceName: 'inst-ldap',
				filePath: 'src/ldap.ts',
				occurrenceCount: 1,
			};

			// Active session has 2 hourly checkpoints with LDAP Injection
			const activeSession: SessionRecord = {
				sessionId: 'session-active',
				status: 'active',
				startedAt: 1000,
				endedAt: null,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [],
				hourlyCheckpoints: [
					{ timestamp: 2000, findings: [ldapFinding] },
					{ timestamp: 3000, findings: [ldapFinding] },
				],
			};

			// Still within the same active session, LDAP Injection is resolved
			const resolvedLdapFLC = makeFLC({
				logicalFingerprint: 'fp-ldap-1',
				cweId: 'CWE-90',
				type: 'LDAP Injection',
				durableResolutionAt: 4000,
				missingSince: 4000,
				currentOccurrenceCount: 0,
			});

			const gradHistory: Record<string, any> = {};
			const common = computeCommonVulnerabilities(
				[s1, s2],
				activeSession,
				[resolvedLdapFLC],
				gradHistory,
			);

			// Reaches K=3 via 2 hourly checkpoints + live milestone
			assert.strictEqual(common.size, 1, 'Should stay on panel as All Resolved, not graduate immediately');
			const ldap = common.get('CWE-90::LDAP Injection');
			assert.ok(ldap);
			assert.strictEqual(ldap?.activeFindingCount, 0, 'Active finding count must be 0 (All Resolved)');
			assert.strictEqual(ldap?.sessionCount, 3, 'Present in 3 milestones of the active session');
			assert.strictEqual(gradHistory['CWE-90::LDAP Injection'], undefined, 'Must not be recorded in graduation history');
		});

		it('does NOT resurrect a graduated vulnerability as All Resolved in subsequent clean sessions', () => {
			// SQL Injection was introduced and resolved in s1, then s2 and s3 were clean probation sessions
			const resolvedSqlFLC = makeFLC({
				logicalFingerprint: 'fp-sql-1',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				firstConfirmedAt: 1000,
				durableResolutionAt: 1500,
				missingSince: 1500,
				currentOccurrenceCount: 0,
			});

			const s1 = makeSession('s1', [resolvedSqlFLC]);
			s1.startedAt = 1000;
			s1.endedAt = 2000;

			// s2 is clean probation session
			const s2: SessionRecord = {
				sessionId: 's2',
				status: 'completed',
				startedAt: 3000,
				endedAt: 4000,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [resolvedSqlFLC], // historical lifecycles are carried over
			};

			// s3 is clean probation session
			const s3: SessionRecord = {
				sessionId: 's3',
				status: 'completed',
				startedAt: 5000,
				endedAt: 6000,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [resolvedSqlFLC],
			};

			const gradHistory: Record<string, any> = {
				'CWE-89::SQL Injection': {
					graduatedAfterSessionIndex: 2,
				},
			};

			// Subsequent sessions s4, s5, s6 with the resolved FLC still in lifecycle store
			const s4: SessionRecord = {
				sessionId: 's4',
				status: 'completed',
				startedAt: 7000,
				endedAt: 8000,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [resolvedSqlFLC],
			};

			const s5: SessionRecord = {
				sessionId: 's5',
				status: 'completed',
				startedAt: 9000,
				endedAt: 10000,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [resolvedSqlFLC],
			};

			const s6: SessionRecord = {
				sessionId: 's6',
				status: 'completed',
				startedAt: 11000,
				endedAt: 12000,
				baselineCheckpoint: null,
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [resolvedSqlFLC],
			};

			const common = computeCommonVulnerabilities(
				[s1, s2, s3, s4, s5, s6],
				null,
				[resolvedSqlFLC],
				gradHistory,
			);

			// SQL Injection must NOT resurrect as "All Resolved"
			assert.strictEqual(common.has('CWE-89::SQL Injection'), false, 'Graduated type must not resurrect as All Resolved');
		});
	});
});
