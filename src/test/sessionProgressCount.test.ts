import * as assert from 'node:assert';
import { countLiveSessionProgress } from '../modules/tracker/analysis/lifecycleEngine.js';
import type {
	FindingLifecycleRecord,
	ObservedFinding,
} from '../modules/tracker/analysis/lifecycleTypes.js';

function createMockFinding(
	overrides: Partial<ObservedFinding> = {},
): ObservedFinding {
	return {
		logicalFingerprint: overrides.logicalFingerprint ?? 'fp-default-1',
		contentFingerprint: overrides.contentFingerprint ?? 'content-1',
		scopeFingerprint: overrides.scopeFingerprint ?? 'scope-1',
		ruleId: overrides.ruleId ?? 'hardcoded-credentials',
		cweId: overrides.cweId ?? 'CWE-798',
		type: overrides.type ?? 'Hardcoded Credentials',
		severity: overrides.severity ?? 'high',
		instanceName: overrides.instanceName ?? 'dbPassword',
		filePath: overrides.filePath ?? '/src/Config.java',
		occurrenceCount: overrides.occurrenceCount ?? 1,
		lineNumber: overrides.lineNumber ?? 10,
		endLine: overrides.endLine ?? 10,
	};
}

function createMockLifecycle(
	finding: ObservedFinding,
	overrides: Partial<FindingLifecycleRecord> = {},
): FindingLifecycleRecord {
	return {
		logicalFingerprint: finding.logicalFingerprint,
		contentFingerprint: finding.contentFingerprint,
		scopeFingerprint: finding.scopeFingerprint,
		ruleId: finding.ruleId,
		cweId: finding.cweId,
		type: finding.type,
		severity: finding.severity,
		instanceName: finding.instanceName,
		filePath: finding.filePath,
		firstConfirmedAt: 1000,
		lastConfirmedAt: 1000,
		confirmationCount: 1,
		missingSince: null,
		postGraceAbsenceCount: 0,
		provisionalResolutionAt: null,
		durableResolutionAt: null,
		recurrenceCount: 0,
		lastRecurredAt: null,
		identicalRestorationCount: 0,
		inSessionToggleCount: 0,
		lastLineNumber: finding.lineNumber,
		lastEndLine: finding.endLine,
		baselineOccurrenceCount: 1,
		currentOccurrenceCount: 1,
		...overrides,
	};
}

describe('Session Progress Count & Fingerprint Mutation (Bug Fix Verification)', () => {
	it('keeps resolvedCount at 0 and maintains baseline total on steady state', () => {
		const findings: ObservedFinding[] = Array.from({ length: 11 }, (_, i) =>
			createMockFinding({
				logicalFingerprint: `fp-${i}`,
				instanceName: `var_${i}`,
				lineNumber: 10 + i,
			}),
		);
		const lifecycles = findings.map((f) => createMockLifecycle(f));
		const baselineFps = findings.map((f) => f.logicalFingerprint);
		const liveFps = new Set(baselineFps);

		const progress = countLiveSessionProgress(
			liveFps,
			lifecycles,
			baselineFps,
			1000,
			findings,
		);

		assert.strictEqual(progress.resolvedCount, 0, 'No issues should be resolved on steady state');
		assert.strictEqual(progress.totalSessionIssues, 11, 'Total issues must match baseline size of 11');
		assert.strictEqual(progress.confirmingCount, 0);
	});

	it('does NOT falsely count an issue as resolved when editing characters in its value (e.g. admin123 -> admin1234)', () => {
		// 11 initial baseline findings
		const findings: ObservedFinding[] = Array.from({ length: 11 }, (_, i) =>
			createMockFinding({
				logicalFingerprint: `fp-${i}`,
				instanceName: i === 0 ? 'dbPassword' : `var_${i}`,
				lineNumber: 10 + i,
			}),
		);
		const lifecycles = findings.map((f) => createMockLifecycle(f));
		const baselineFps = findings.map((f) => f.logicalFingerprint);

		// User edits "admin123" to "admin1234" on finding 0 (dbPassword).
		// Its fingerprint mutates from fp-0 to fp-0-mutated.
		const liveFindings: ObservedFinding[] = [
			createMockFinding({
				logicalFingerprint: 'fp-0-mutated',
				instanceName: 'dbPassword',
				lineNumber: 10,
				contentFingerprint: 'content-admin1234',
			}),
			...findings.slice(1),
		];
		const liveFps = new Set(liveFindings.map((f) => f.logicalFingerprint));

		const progress = countLiveSessionProgress(
			liveFps,
			lifecycles,
			baselineFps,
			1000,
			liveFindings,
		);

		// MUST NOT jump to 1 of 12!
		assert.strictEqual(
			progress.resolvedCount,
			0,
			'Mutated fingerprint on edited value must NOT be counted as resolved',
		);
		assert.strictEqual(
			progress.totalSessionIssues,
			11,
			'Total session issues must remain 11, not inflate to 12',
		);
	});

	it('does NOT accumulate phantom resolved counts on successive keystrokes (e.g. admin1234 -> admin12345)', () => {
		const findings: ObservedFinding[] = Array.from({ length: 11 }, (_, i) =>
			createMockFinding({
				logicalFingerprint: `fp-${i}`,
				instanceName: i === 0 ? 'dbPassword' : `var_${i}`,
				lineNumber: 10 + i,
			}),
		);
		const lifecycles = findings.map((f) => createMockLifecycle(f));
		const baselineFps = findings.map((f) => f.logicalFingerprint);

		// Next keystroke: fp-0-mutated-2
		const liveFindings: ObservedFinding[] = [
			createMockFinding({
				logicalFingerprint: 'fp-0-mutated-2',
				instanceName: 'dbPassword',
				lineNumber: 10,
				contentFingerprint: 'content-admin12345',
			}),
			...findings.slice(1),
		];
		const liveFps = new Set(liveFindings.map((f) => f.logicalFingerprint));

		const progress = countLiveSessionProgress(
			liveFps,
			lifecycles,
			baselineFps,
			1000,
			liveFindings,
		);

		assert.strictEqual(progress.resolvedCount, 0);
		assert.strictEqual(progress.totalSessionIssues, 11);
	});

	it('correctly increments resolvedCount when the finding is actually removed', () => {
		const findings: ObservedFinding[] = Array.from({ length: 11 }, (_, i) =>
			createMockFinding({
				logicalFingerprint: `fp-${i}`,
				instanceName: i === 0 ? 'dbPassword' : `var_${i}`,
				lineNumber: 10 + i,
			}),
		);
		const lifecycles = findings.map((f) => createMockLifecycle(f));
		const baselineFps = findings.map((f) => f.logicalFingerprint);

		// Finding 0 (dbPassword) is completely removed / fixed!
		const liveFindings: ObservedFinding[] = findings.slice(1);
		const liveFps = new Set(liveFindings.map((f) => f.logicalFingerprint));

		const progress = countLiveSessionProgress(
			liveFps,
			lifecycles,
			baselineFps,
			1000,
			liveFindings,
		);

		assert.strictEqual(progress.resolvedCount, 1, 'Removed issue must be counted as resolved');
		assert.strictEqual(progress.totalSessionIssues, 11, 'Total issues remains 11 (10 live + 1 resolved)');
		assert.strictEqual(progress.confirmingCount, 1, 'Absence begins confirmation');
	});

	it('does NOT count a commented-out finding as resolved', () => {
		const findings: ObservedFinding[] = Array.from({ length: 11 }, (_, i) =>
			createMockFinding({
				logicalFingerprint: `fp-${i}`,
				instanceName: i === 0 ? 'dbPassword' : `var_${i}`,
				lineNumber: 10 + i,
			}),
		);
		const lifecycles = findings.map((f, i) =>
			createMockLifecycle(f, {
				isCommentedOut: i === 0,
			}),
		);
		const baselineFps = findings.map((f) => f.logicalFingerprint);

		// Finding 0 is commented out, missing from live scan
		const liveFindings: ObservedFinding[] = findings.slice(1);
		const liveFps = new Set(liveFindings.map((f) => f.logicalFingerprint));

		const progress = countLiveSessionProgress(
			liveFps,
			lifecycles,
			baselineFps,
			1000,
			liveFindings,
		);

		assert.strictEqual(progress.resolvedCount, 0, 'Commented-out finding must NOT count as resolved');
		assert.strictEqual(progress.totalSessionIssues, 11);
	});

	it('handles multiple sinks in the same method without cross-resolving or colliding', () => {
		const sink85 = createMockFinding({
			logicalFingerprint: 'fp-sink-85',
			type: 'Path Traversal',
			cweId: 'CWE-22',
			instanceName: 'submitReview',
			lineNumber: 85,
			endLine: 85,
		});
		const sink92 = createMockFinding({
			logicalFingerprint: 'fp-sink-92',
			type: 'Path Traversal',
			cweId: 'CWE-22',
			instanceName: 'submitReview',
			lineNumber: 92,
			endLine: 92,
		});
		const lifecycles = [
			createMockLifecycle(sink85),
			createMockLifecycle(sink92),
		];
		const baselineFps = [sink85.logicalFingerprint, sink92.logicalFingerprint];

		// Case A: User edits sink 85 (mutating its fingerprint). Both sinks are still present.
		const sink85Edited = createMockFinding({
			logicalFingerprint: 'fp-sink-85-edited',
			type: 'Path Traversal',
			cweId: 'CWE-22',
			instanceName: 'submitReview',
			lineNumber: 85,
			endLine: 85,
		});
		const liveFindingsA = [sink85Edited, sink92];
		const progressA = countLiveSessionProgress(
			new Set(liveFindingsA.map((f) => f.logicalFingerprint)),
			lifecycles,
			baselineFps,
			1000,
			liveFindingsA,
		);
		assert.strictEqual(progressA.resolvedCount, 0, 'Editing sink 85 must not resolve it');
		assert.strictEqual(progressA.totalSessionIssues, 2);

		// Case B: User fixes sink 85 (only sink 92 remains in live scan).
		const liveFindingsB = [sink92];
		const progressB = countLiveSessionProgress(
			new Set(liveFindingsB.map((f) => f.logicalFingerprint)),
			lifecycles,
			baselineFps,
			1000,
			liveFindingsB,
		);
		assert.strictEqual(progressB.resolvedCount, 1, 'Fixing sink 85 must resolve exactly 1 sink');
		assert.strictEqual(progressB.totalSessionIssues, 2);
	});

	it('does NOT count cast / type conversion as resolved when modifying variable name (e.g. record -> recordd)', () => {
		const castFinding = createMockFinding({
			logicalFingerprint: 'fp-cast-record',
			type: 'Incorrect Type Conversion or Cast',
			cweId: 'CWE-704',
			instanceName: 'record',
			lineNumber: 25,
			endLine: 25,
			scopeFingerprint: 'scope-process-method',
		});
		const otherFinding = createMockFinding({
			logicalFingerprint: 'fp-other',
			type: 'SQL Injection',
			cweId: 'CWE-89',
			instanceName: 'query',
			lineNumber: 40,
			endLine: 40,
		});

		const lifecycles = [
			createMockLifecycle(castFinding),
			createMockLifecycle(otherFinding),
		];
		const baselineFindings = [castFinding, otherFinding];
		const baselineFps = baselineFindings.map((f) => f.logicalFingerprint);

		// User renames "record" to "recordd" on the same line (line 25).
		// Fingerprint changes to "fp-cast-recordd" and instanceName becomes "recordd".
		const castEdited = createMockFinding({
			logicalFingerprint: 'fp-cast-recordd',
			type: 'Incorrect Type Conversion or Cast',
			cweId: 'CWE-704',
			instanceName: 'recordd',
			lineNumber: 25,
			endLine: 25,
			scopeFingerprint: 'scope-process-method',
		});
		const liveFindings = [castEdited, otherFinding];

		const progress = countLiveSessionProgress(
			new Set(liveFindings.map((f) => f.logicalFingerprint)),
			lifecycles,
			baselineFps,
			1000,
			liveFindings,
			baselineFindings,
		);

		assert.strictEqual(
			progress.resolvedCount,
			0,
			'Renaming/modifying field or variable on the same line must NOT count as resolved',
		);
		assert.strictEqual(
			progress.totalSessionIssues,
			2,
			'Total session issues must not inflate',
		);
	});
});
