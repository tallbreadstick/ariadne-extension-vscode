import * as assert from 'assert';
import {
	buildAbruptSessionDiagnostics,
	buildAbruptSessionHtml,
} from '../modules/tracker/views/abruptSessionPanel.js';
import {
	DEFAULT_AUTO_SCAN_INTERVAL_MINUTES,
	MIN_AUTO_SCAN_INTERVAL_MINUTES,
	MAX_AUTO_SCAN_INTERVAL_MINUTES,
	getAutoScanIntervalMinutes,
	getAutoScanIntervalMs,
} from '../modules/feedback/settings/extensionSettings.js';
import type { FindingLifecycleRecord, SessionRecord } from '../modules/tracker/analysis/lifecycleTypes.js';

describe('Abrupt Close Recovery & Auto-Scan Settings Test Suite', () => {
	describe('1. Abrupt Session Diagnostics Builder', () => {
		const mockSession: SessionRecord = {
			sessionId: 'session-abrupt-001',
			startedAt: 10000,
			endedAt: null,
			status: 'incomplete',
			baselineCheckpoint: null,
			finalCheckpoint: null,
			lifecycleSummaries: [],
			hourlyCheckpoints: [
				{
					timestamp: 16000,
					findings: [],
				},
			],
		};

		const mockLifecycles: FindingLifecycleRecord[] = [
			{
				logicalFingerprint: 'fp-1',
				contentFingerprint: 'c1',
				scopeFingerprint: 's1',
				ruleId: 'RULE-1',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'critical',
				instanceName: 'query',
				filePath: 'src/db.ts',
				firstConfirmedAt: 11000,
				lastConfirmedAt: 15000,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 1,
				confirmationCount: 3,
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				isCommentedOut: false,
				lifecycleState: 'persisting',
			},
			{
				logicalFingerprint: 'fp-2',
				contentFingerprint: 'c2',
				scopeFingerprint: 's2',
				ruleId: 'RULE-2',
				cweId: 'CWE-79',
				type: 'Cross-Site Scripting',
				severity: 'high',
				instanceName: 'render',
				filePath: 'src/view.ts',
				firstConfirmedAt: 12000,
				lastConfirmedAt: 12000,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 1,
				confirmationCount: 1,
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				isCommentedOut: false,
				lifecycleState: 'active',
			},
			{
				// Resolved finding (should be excluded from active count)
				logicalFingerprint: 'fp-3',
				contentFingerprint: 'c3',
				scopeFingerprint: 's3',
				ruleId: 'RULE-3',
				cweId: 'CWE-22',
				type: 'Path Traversal',
				severity: 'medium',
				instanceName: 'path',
				filePath: 'src/file.ts',
				firstConfirmedAt: 10500,
				lastConfirmedAt: 13000,
				missingSince: 14000,
				provisionalResolutionAt: 14500,
				durableResolutionAt: 15000,
				baselineOccurrenceCount: 1,
				currentOccurrenceCount: 0,
				confirmationCount: 2,
				recurrenceCount: 0,
				lastRecurredAt: null,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
				isCommentedOut: false,
				lifecycleState: 'resolved',
			},
		];

		it('constructs diagnostic metadata matching unfinalized session state', () => {
			const recoveredAt = 25000;
			const diag = buildAbruptSessionDiagnostics(mockSession, mockLifecycles, recoveredAt);

			assert.strictEqual(diag.sessionId, 'session-abrupt-001');
			assert.strictEqual(diag.status, 'incomplete');
			assert.strictEqual(diag.startedAt, 10000);
			assert.strictEqual(diag.recoveredAt, 25000);
			assert.strictEqual(diag.estimatedDurationMs, 15000);
			assert.strictEqual(diag.hourlyCheckpointsCount, 1);
			assert.strictEqual(diag.activeFindingCount, 2);
			assert.strictEqual(diag.persistingFindingCount, 1);
			assert.strictEqual(diag.findingsBySeverity.critical, 1);
			assert.strictEqual(diag.findingsBySeverity.high, 1);
			assert.strictEqual(diag.findingsBySeverity.medium, 0);
			assert.strictEqual(diag.findingsBySeverity.low, 0);
			assert.strictEqual(diag.vulnerabilityTypes.length, 2);
			assert.ok(diag.trendsImpact.includes('withheld from your trend baseline'));
		});

		it('builds diagnostic HTML containing session and vulnerability details', () => {
			const diag = buildAbruptSessionDiagnostics(mockSession, mockLifecycles, 25000);
			const html = buildAbruptSessionHtml(diag);

			assert.ok(html.includes('session-abrupt-001'));
			assert.ok(html.includes('SQL Injection'));
			assert.ok(html.includes('CWE-89'));
			assert.ok(html.includes('Cross-Site Scripting'));
			assert.ok(html.includes('CWE-79'));
			assert.ok(html.includes('Incomplete'));
			assert.ok(html.includes('1 completed'));
			assert.ok(html.includes('Copy Diagnostics JSON'));
		});
	});

	describe('2. Auto-Scan Settings & Intervals', () => {
		it('defines valid policy defaults and boundaries', () => {
			assert.strictEqual(DEFAULT_AUTO_SCAN_INTERVAL_MINUTES, 60);
			assert.strictEqual(MIN_AUTO_SCAN_INTERVAL_MINUTES, 5);
			assert.strictEqual(MAX_AUTO_SCAN_INTERVAL_MINUTES, 180);
		});

		it('reads default auto-scan interval when configuration is unset', () => {
			const min = getAutoScanIntervalMinutes();
			const ms = getAutoScanIntervalMs();
			assert.strictEqual(min, 60);
			assert.strictEqual(ms, 60 * 60 * 1000);
		});
	});
});
