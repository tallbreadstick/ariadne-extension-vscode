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

	describe('4. Common Vulnerabilities K=3 Policy & Sorting', () => {
		function createMockSession(id: string, findings: Array<{ type: string; cweId: string; state: 'persisting' | 'resolved' }>): SessionRecord {
			const summaries: FindingLifecycleRecord[] = findings.map((f, i) => ({
				logicalFingerprint: `fp-${id}-${i}`,
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
			logicalFingerprint: 'fp-sql',
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

		it('requires K=3 sessions for a vulnerability to qualify as Common', () => {
			const session1 = createMockSession('s1', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'persisting' },
				{ type: 'Cross-Site Scripting', cweId: 'CWE-79', state: 'persisting' },
			]);
			const session2 = createMockSession('s2', [
				{ type: 'SQL Injection', cweId: 'CWE-89', state: 'persisting' },
			]);

			// After 2 sessions, SQL Injection has sessionCount = 2 (< 3)
			const commonAfter2 = computeCommonVulnerabilities(
				[session1, session2],
				null,
				[activeFlcSql],
				{},
			);
			assert.strictEqual(commonAfter2.size, 0, 'No common vulnerabilities when K=3 and only 2 sessions observed');

			// After 3rd session where SQL Injection appears again
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

		it('sorts common vulnerabilities descending by activeFindingCount then sessionCount', () => {
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
			// 1st: SQL Injection (active = 1) -> prioritized over 0-active items
			assert.strictEqual(list[0].type, 'SQL Injection');
			assert.strictEqual(list[0].activeFindingCount, 1);
			assert.strictEqual(list[0].sessionCount, 3);
			// 2nd: XSS (active = 0, sessionCount = 4)
			assert.strictEqual(list[1].type, 'Cross-Site Scripting');
			assert.strictEqual(list[1].sessionCount, 4);
			assert.strictEqual(list[1].activeFindingCount, 0);
			// 3rd: Path Traversal (active = 0, sessionCount = 3)
			assert.strictEqual(list[2].type, 'Path Traversal');
			assert.strictEqual(list[2].sessionCount, 3);
			assert.strictEqual(list[2].activeFindingCount, 0);
		});

		it('qualifies common vulnerabilities using hourly checkpoints in active session without session rollover', () => {
			const mockFinding = {
				logicalFingerprint: 'fp-sql',
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
				sessionId: 'session-lab-1',
				status: 'active',
				startedAt: 1000,
				endedAt: null,
				baselineCheckpoint: {
					timestamp: 1000,
					findings: [mockFinding],
				},
				finalCheckpoint: null,
				priorCompletedSessionId: null,
				trendComparisonByKey: null,
				lifecycleSummaries: [],
				hourlyCheckpoints: [
					// Hour 1 checkpoint
					{
						timestamp: 2000,
						findings: [mockFinding],
					},
					// Hour 2 checkpoint
					{
						timestamp: 3000,
						findings: [mockFinding],
					},
				],
			};

			// Active session with 2 hourly checkpoints + current active state = 3 observation milestones!
			const common = computeCommonVulnerabilities(
				[], // 0 completed sessions
				activeSession,
				[activeFlcSql],
				{},
			);

			assert.strictEqual(common.size, 1);
			const sql = common.get('CWE-89::SQL Injection');
			assert.ok(sql);
			assert.strictEqual(sql?.sessionCount, 3, 'SQL Injection reaches sessionCount 3 across hourly checkpoints');
			assert.strictEqual(sql?.activeFindingCount, 1);
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
});
