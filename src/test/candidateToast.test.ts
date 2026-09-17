import * as assert from 'assert';
import {
	processObservation,
} from '../modules/tracker/analysis/lifecycleEngine.js';
import {
	buildSessionAnalysis,
} from '../modules/tracker/analysis/snapshotAnalyzer.js';
import {
	formatNewCandidateMessage,
} from '../modules/tracker/analysis/candidateToasts.js';
import type {
	ObservedFinding,
	FindingClassification,
} from '../modules/tracker/analysis/lifecycleTypes.js';
import type { ScanSnapshot } from '../modules/feedback/vulnerability_results/vulnerabilityTypes.js';

function createMockObserved(
	type: string,
	cweId: string,
	filePath: string,
	line: number,
	logicalFingerprint?: string,
): ObservedFinding {
	return {
		logicalFingerprint: logicalFingerprint ?? `${filePath}:${line}:${type}`,
		contentFingerprint: 'content-fp',
		scopeFingerprint: 'scope-fp',
		ruleId: 'TEST_RULE',
		cweId,
		type,
		severity: 'high',
		instanceName: 'testVar',
		filePath,
		occurrenceCount: 1,
		lineNumber: line,
		endLine: line,
	};
}

function createEmptySnapshot(): ScanSnapshot {
	return {
		scan_id: 'scan-1',
		timestamp: Date.now(),
		vulnerabilities: [],
	};
}

describe('Candidate State Toast — Commit 1: New Vulnerability → Candidate', () => {

	describe('1. Lifecycle previousState tracking', () => {
		it('marks newly introduced findings with previousState = undefined and status = candidate', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const result = processObservation([finding], [], Date.now(), true);

			assert.strictEqual(result.classifications.length, 1);
			const c = result.classifications[0];
			assert.strictEqual(c.status, 'candidate');
			assert.strictEqual(c.previousState, undefined, 'Newly introduced finding should have previousState undefined');
		});

		it('preserves previousState on subsequent settled observations', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const t0 = 1_000_000;
			// Step 1: None -> Candidate
			const step1 = processObservation([finding], [], t0, true);
			assert.strictEqual(step1.classifications[0].status, 'candidate');
			assert.strictEqual(step1.classifications[0].previousState, undefined);

			// Step 2: Observation on next save scan.
			// confirmationCount increases to 1 -> transitions to 'active'
			const t1 = t0 + 10_000;
			const step2 = processObservation([finding], step1.lifecycles, t1, true);
			assert.strictEqual(step2.classifications[0].status, 'active');
			assert.strictEqual(step2.classifications[0].previousState, 'candidate', 'Previous state should be candidate');
		});
	});

	describe('2. buildSessionAnalysis newCandidateFindings collection', () => {
		it('collects newly introduced candidate findings when not in initial checkpoint', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const obsResult = processObservation([finding], [], Date.now(), true);

			const analysis = buildSessionAnalysis(
				obsResult.classifications,
				createEmptySnapshot(),
				null,
				obsResult.lifecycles,
				null,
				{ isInitialCheckpoint: false },
			);

			assert.ok(analysis.newCandidateFindings);
			assert.strictEqual(analysis.newCandidateFindings.length, 1);
			assert.strictEqual(analysis.newCandidateFindings[0].lifecycle.type, 'SQL Injection');
		});

		it('suppresses newCandidateFindings during the initial session checkpoint', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const obsResult = processObservation([finding], [], Date.now(), true);

			const analysis = buildSessionAnalysis(
				obsResult.classifications,
				createEmptySnapshot(),
				null,
				obsResult.lifecycles,
				null,
				{ isInitialCheckpoint: true },
			);

			assert.ok(analysis.newCandidateFindings);
			assert.strictEqual(analysis.newCandidateFindings.length, 0, 'Should not toast on initial baseline load');
		});

		it('does not include findings that were already active or persisting as new candidates', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const t0 = 1_000_000;
			const step1 = processObservation([finding], [], t0, true);
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);

			const analysis = buildSessionAnalysis(
				step2.classifications,
				createEmptySnapshot(),
				null,
				step2.lifecycles,
				null,
				{ isInitialCheckpoint: false },
			);

			assert.strictEqual(analysis.newCandidateFindings?.length ?? 0, 0, 'Existing active finding should not be in newCandidateFindings');
		});
	});

	describe('3. formatNewCandidateMessage formatting', () => {
		it('returns empty string when classifications list is empty', () => {
			assert.strictEqual(formatNewCandidateMessage([]), '');
		});

		it('formats single new vulnerability candidate correctly', () => {
			const finding = createMockObserved('Hardcoded Credentials', 'CWE-798', 'AuthController.java', 37);
			const obs = processObservation([finding], [], Date.now(), true);

			const msg = formatNewCandidateMessage(obs.classifications);
			assert.strictEqual(
				msg,
				'Ariadne: A new vulnerability has been detected (Hardcoded Credentials). Checking validity...',
			);
		});

		it('formats multiple new vulnerabilities correctly', () => {
			const f1 = createMockObserved('Hardcoded Credentials', 'CWE-798', 'Auth.java', 10);
			const f2 = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 20);
			const obs = processObservation([f1, f2], [], Date.now(), true);

			const msg = formatNewCandidateMessage(obs.classifications);
			assert.strictEqual(
				msg,
				'Ariadne: 2 new vulnerabilities detected (Hardcoded Credentials, SQL Injection). Checking validity...',
			);
		});

		it('truncates to summary when more than 3 distinct types are detected', () => {
			const f1 = createMockObserved('Type A', 'CWE-1', 'A.java', 1);
			const f2 = createMockObserved('Type B', 'CWE-2', 'B.java', 2);
			const f3 = createMockObserved('Type C', 'CWE-3', 'C.java', 3);
			const f4 = createMockObserved('Type D', 'CWE-4', 'D.java', 4);
			const obs = processObservation([f1, f2, f3, f4], [], Date.now(), true);

			const msg = formatNewCandidateMessage(obs.classifications);
			assert.strictEqual(
				msg,
				'Ariadne: 4 new vulnerabilities detected (Type A, Type B, Type C and 1 more). Checking validity...',
			);
		});
	});
});
