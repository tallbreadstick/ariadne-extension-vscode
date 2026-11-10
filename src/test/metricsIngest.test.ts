import * as assert from 'assert';
import {
	aggregateCweCounts,
	buildSessionFinalizedPayload,
	countSeverity,
	toPublicLifecycleSummaries,
} from '../modules/tracker/ingest/metricsIngestPayload.js';
import type { FindingLifecycleRecord, SessionRecord } from '../modules/tracker/analysis/lifecycleTypes.js';

describe('metricsIngest', () => {
	it('strips identifying lifecycle fields from summaries', () => {
		const lc: FindingLifecycleRecord = {
			logicalFingerprint: 'secret',
			contentFingerprint: 'secret',
			scopeFingerprint: 'secret',
			ruleId: 'rule-1',
			cweId: 'CWE-89',
			type: 'SQL Injection',
			severity: 'high',
			instanceName: 'query',
			filePath: '/secret/path.java',
			firstConfirmedAt: 1,
			lastConfirmedAt: 2,
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
			lifecycleState: 'persisting',
		};
		const rows = toPublicLifecycleSummaries([lc]);
		assert.strictEqual(rows.length, 1);
		assert.strictEqual(rows[0].cweId, 'CWE-89');
		assert.strictEqual(rows[0].vulnerabilityType, 'SQL Injection');
		assert.strictEqual('filePath' in (rows[0] as object), false);
	});

	it('builds session_finalized envelope', () => {
		const session: SessionRecord = {
			sessionId: 'session-001',
			startedAt: 1_700_000_000_000,
			endedAt: 1_700_003_600_000,
			status: 'completed',
			baselineCheckpoint: { timestamp: 1_700_000_000_000, findings: [] },
			finalCheckpoint: null,
			lifecycleSummaries: [],
			finalScores: { f: 7, p: 6, t: 1 },
		};
		const body = buildSessionFinalizedPayload(session, '12345', '0.1.0', '1.107.0');
		assert.strictEqual(body.event, 'session_finalized');
		assert.strictEqual((body.session as { clientSessionId: string }).clientSessionId, 'session-001');
	});

	it('aggregates CWE counts from checkpoint findings', () => {
		const counts = aggregateCweCounts([
			{
				logicalFingerprint: 'a',
				contentFingerprint: '',
				scopeFingerprint: '',
				ruleId: 'r',
				cweId: 'CWE-89',
				type: 'SQLi',
				severity: 'high',
				instanceName: 'x',
				filePath: 'f',
				occurrenceCount: 2,
			},
			{
				logicalFingerprint: 'b',
				contentFingerprint: '',
				scopeFingerprint: '',
				ruleId: 'r',
				cweId: 'CWE-89',
				type: 'SQLi',
				severity: 'high',
				instanceName: 'y',
				filePath: 'f',
				occurrenceCount: 1,
			},
		]);
		assert.deepStrictEqual(counts, [{ cweId: 'CWE-89', count: 3 }]);
	});

	it('counts severities', () => {
		assert.deepStrictEqual(
			countSeverity([{ severity: 'high' }, { severity: 'low' }, { severity: 'high' }]),
			{ critical: 0, high: 2, medium: 0, low: 1 },
		);
	});
});
