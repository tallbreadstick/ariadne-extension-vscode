import * as assert from 'assert';
import {
	processObservation,
} from '../modules/tracker/analysis/lifecycleEngine.js';
import {
	buildSessionAnalysis,
} from '../modules/tracker/analysis/snapshotAnalyzer.js';
import {
	formatNewCandidateMessage,
	formatAbsentCandidateMessage,
	determinePrioritizedToast,
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

		it('includes newCandidateFindings during the initial session checkpoint', () => {
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
			assert.strictEqual(analysis.newCandidateFindings.length, 1, 'Should include candidate findings on initial checkpoint');
			assert.strictEqual(analysis.newCandidateFindings[0].lifecycle.type, 'SQL Injection');
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
				'Ariadne: 1 new vulnerability detected — verification in progress...',
			);
		});

		it('formats multiple new vulnerabilities correctly', () => {
			const f1 = createMockObserved('Hardcoded Credentials', 'CWE-798', 'Auth.java', 10);
			const f2 = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 20);
			const obs = processObservation([f1, f2], [], Date.now(), true);

			const msg = formatNewCandidateMessage(obs.classifications);
			assert.strictEqual(
				msg,
				'Ariadne: 2 new vulnerabilities detected — verification in progress...',
			);
		});
	});

	describe('4. Commit 2: Previously detected vulnerability → Candidate on absence', () => {
		it('detects transition to Candidate when an active vulnerability is no longer detected', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const t0 = 1_000_000;

			// Step 1: None -> Candidate
			const step1 = processObservation([finding], [], t0, true);
			// Step 2: Candidate -> Active
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);
			assert.strictEqual(step2.classifications[0].status, 'active');

			// Step 3: Finding disappears in settled scan -> transitions to Candidate
			const step3 = processObservation([], step2.lifecycles, t0 + 20_000, true);
			assert.strictEqual(step3.classifications[0].status, 'candidate');
			assert.strictEqual(step3.classifications[0].previousState, 'active');

			const analysis = buildSessionAnalysis(
				step3.classifications,
				createEmptySnapshot(),
				null,
				step3.lifecycles,
				null,
				{ isInitialCheckpoint: false },
			);

			assert.ok(analysis.absentCandidateFindings);
			assert.strictEqual(analysis.absentCandidateFindings.length, 1);
			assert.strictEqual(analysis.absentCandidateFindings[0].lifecycle.type, 'SQL Injection');
			assert.strictEqual(analysis.absentCandidateFindings[0].previousState, 'active');
		});

		it('does NOT repeatedly trigger absentCandidateFindings on subsequent scans while remaining absent', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const t0 = 1_000_000;

			const step1 = processObservation([finding], [], t0, true);
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);

			// First absence: Active -> Candidate (triggers toast)
			const step3 = processObservation([], step2.lifecycles, t0 + 20_000, true);
			const analysis1 = buildSessionAnalysis(step3.classifications, createEmptySnapshot(), null, step3.lifecycles);
			assert.strictEqual(analysis1.absentCandidateFindings?.length, 1);

			// Second absence: Candidate -> Candidate (previousState is now 'candidate')
			const step4 = processObservation([], step3.lifecycles, t0 + 25_000, true);
			const analysis2 = buildSessionAnalysis(step4.classifications, createEmptySnapshot(), null, step4.lifecycles);
			assert.strictEqual(
				analysis2.absentCandidateFindings?.length ?? 0,
				0,
				'Must not re-trigger toast while finding remains in Candidate state',
			);
		});

		it('detects transition to Candidate from persisting and recurring states', () => {
			const finding = createMockObserved('Command Injection', 'CWE-78', 'Exec.java', 50);
			const t0 = 1_000_000;

			// Step 1: None -> Candidate
			const step1 = processObservation([finding], [], t0, true);
			// Step 2: Confirmation 1
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);
			// Step 3: Confirmation 2 + duration >= 30s -> Persisting
			const step3 = processObservation([finding], step2.lifecycles, t0 + 35_000, true);
			assert.strictEqual(step3.classifications[0].status, 'persisting');

			// Absence scan: Persisting -> Candidate
			const step4 = processObservation([], step3.lifecycles, t0 + 40_000, true);
			assert.strictEqual(step4.classifications[0].status, 'candidate');
			assert.strictEqual(step4.classifications[0].previousState, 'persisting');

			const analysis = buildSessionAnalysis(step4.classifications, createEmptySnapshot(), null, step4.lifecycles);
			assert.strictEqual(analysis.absentCandidateFindings?.length, 1);
			assert.strictEqual(analysis.absentCandidateFindings[0].lifecycle.type, 'Command Injection');
		});

		it('formats single absent candidate finding with user-focused fixed wording', () => {
			const finding = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const t0 = 1_000_000;
			const step1 = processObservation([finding], [], t0, true);
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);
			const step3 = processObservation([], step2.lifecycles, t0 + 20_000, true);

			const msg = formatAbsentCandidateMessage(step3.classifications);
			assert.strictEqual(
				msg,
				'Ariadne: 1 issue fixed — resolution status is being processed...',
			);
		});

		it('formats multiple absent candidate findings with count', () => {
			const f1 = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const f2 = createMockObserved('Cross-Site Scripting', 'CWE-79', 'Web.java', 20);
			const t0 = 1_000_000;

			const step1 = processObservation([f1, f2], [], t0, true);
			const step2 = processObservation([f1, f2], step1.lifecycles, t0 + 10_000, true);
			// Both removed
			const step3 = processObservation([], step2.lifecycles, t0 + 20_000, true);

			const msg = formatAbsentCandidateMessage(step3.classifications);
			assert.strictEqual(
				msg,
				'Ariadne: 2 issues fixed — resolution status is being processed...',
			);
		});

		it('returns empty string when absent classifications list is empty', () => {
			assert.strictEqual(formatAbsentCandidateMessage([]), '');
		});
	});

	describe('5. Robust back-to-back Candidate transitions across scans', () => {
		it('accurately triggers toast on successive scans when removing vulnerabilities one by one', () => {
			const vuln1 = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const vuln2 = createMockObserved('Command Injection', 'CWE-78', 'Exec.java', 20);
			const t0 = 1_000_000;

			// Scan 1 (baseline): Both vulnerabilities detected
			const scan1 = processObservation([vuln1, vuln2], [], t0, true);
			// Scan 2 (confirmation): Both confirmed active
			const scan2 = processObservation([vuln1, vuln2], scan1.lifecycles, t0 + 10_000, true);
			assert.strictEqual(scan2.classifications.length, 2);

			// Scan 3: Remove vuln1 only (vuln2 remains)
			const scan3 = processObservation([vuln2], scan2.lifecycles, t0 + 20_000, true);
			const analysis3 = buildSessionAnalysis(scan3.classifications, createEmptySnapshot(), null, scan3.lifecycles);
			assert.strictEqual(analysis3.absentCandidateFindings?.length, 1, 'Scan 3 should detect vuln1 absent');
			assert.strictEqual(analysis3.absentCandidateFindings[0].lifecycle.type, 'SQL Injection');
			const msg3 = formatAbsentCandidateMessage(analysis3.absentCandidateFindings);
			assert.strictEqual(msg3, 'Ariadne: 1 issue fixed — resolution status is being processed...');

			// Scan 4 (just 5 seconds later in same cycle): Remove vuln2 as well
			const scan4 = processObservation([], scan3.lifecycles, t0 + 25_000, true);
			const analysis4 = buildSessionAnalysis(scan4.classifications, createEmptySnapshot(), null, scan4.lifecycles);
			assert.strictEqual(analysis4.absentCandidateFindings?.length, 1, 'Scan 4 must detect vuln2 absent without being suppressed by previous toast');
			assert.strictEqual(analysis4.absentCandidateFindings[0].lifecycle.type, 'Command Injection');
			const msg4 = formatAbsentCandidateMessage(analysis4.absentCandidateFindings);
			assert.strictEqual(msg4, 'Ariadne: 1 issue fixed — resolution status is being processed...');

			// Scan 5: No changes (both still absent)
			const scan5 = processObservation([], scan4.lifecycles, t0 + 30_000, true);
			const analysis5 = buildSessionAnalysis(scan5.classifications, createEmptySnapshot(), null, scan5.lifecycles);
			assert.strictEqual(analysis5.absentCandidateFindings?.length ?? 0, 0, 'Scan 5 must NOT re-toast absent candidates');
		});

		it('triggers absent Candidate toast when removing a vulnerability that was still in Candidate state', () => {
			const finding = createMockObserved('Hardcoded Credentials', 'CWE-798', 'Auth.java', 15);
			const t0 = 1_000_000;

			// Scan 1: Newly introduced (Candidate state, not yet active)
			const scan1 = processObservation([finding], [], t0, true);
			assert.strictEqual(scan1.classifications[0].status, 'candidate');

			// Scan 2: Immediately removed in next scan
			const scan2 = processObservation([], scan1.lifecycles, t0 + 10_000, true);
			assert.strictEqual(scan2.classifications[0].status, 'candidate');
			assert.strictEqual(scan2.classifications[0].isAbsentCandidate, true);

			const analysis = buildSessionAnalysis(scan2.classifications, createEmptySnapshot(), null, scan2.lifecycles);
			assert.strictEqual(analysis.absentCandidateFindings?.length, 1, 'Should trigger absent Candidate toast even if previously Candidate');
			assert.strictEqual(analysis.absentCandidateFindings[0].lifecycle.type, 'Hardcoded Credentials');
		});

		it('accurately triggers new Candidate toast on successive scans when introducing vulnerabilities one by one', () => {
			const vuln1 = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const vuln2 = createMockObserved('XSS', 'CWE-79', 'Web.java', 20);
			const t0 = 1_000_000;

			// Initial session established with no vulnerabilities
			const scan1 = processObservation([], [], t0, true);

			// Scan 2: Add vuln1
			const scan2 = processObservation([vuln1], scan1.lifecycles, t0 + 10_000, true);
			const analysis2 = buildSessionAnalysis(scan2.classifications, createEmptySnapshot(), null, scan2.lifecycles, null, { isInitialCheckpoint: false });
			assert.strictEqual(analysis2.newCandidateFindings?.length, 1);
			assert.strictEqual(analysis2.newCandidateFindings[0].lifecycle.type, 'SQL Injection');

			// Scan 3 (5 seconds later): Add vuln2 as well
			const scan3 = processObservation([vuln1, vuln2], scan2.lifecycles, t0 + 15_000, true);
			const analysis3 = buildSessionAnalysis(scan3.classifications, createEmptySnapshot(), null, scan3.lifecycles, null, { isInitialCheckpoint: false });
			assert.strictEqual(analysis3.newCandidateFindings?.length, 1, 'Scan 3 must detect vuln2 as new candidate');
			assert.strictEqual(analysis3.newCandidateFindings[0].lifecycle.type, 'XSS');

			// Scan 4: Both still present, no new vulnerabilities
			const scan4 = processObservation([vuln1, vuln2], scan3.lifecycles, t0 + 20_000, true);
			const analysis4 = buildSessionAnalysis(scan4.classifications, createEmptySnapshot(), null, scan4.lifecycles, null, { isInitialCheckpoint: false });
			assert.strictEqual(analysis4.newCandidateFindings?.length ?? 0, 0, 'Scan 4 must not re-trigger new candidate toast');
		});

		it('supports full back-and-forth cycles (add -> remove -> restore -> remove)', () => {
			const vuln = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const t0 = 1_000_000;

			// 1. Add
			const s1 = processObservation([vuln], [], t0, true);
			assert.strictEqual(s1.classifications[0].isNewCandidate, true);

			// 2. Confirm
			const s2 = processObservation([vuln], s1.lifecycles, t0 + 10_000, true);

			// 3. Remove -> absent candidate
			const s3 = processObservation([], s2.lifecycles, t0 + 20_000, true);
			assert.strictEqual(s3.classifications[0].isAbsentCandidate, true);

			// 4. Restore -> reappears
			const s4 = processObservation([vuln], s3.lifecycles, t0 + 30_000, true);
			assert.strictEqual(s4.classifications[0].isAbsentCandidate, undefined);

			// 5. Remove again -> absent candidate triggers again!
			const s5 = processObservation([], s4.lifecycles, t0 + 40_000, true);
			assert.strictEqual(s5.classifications[0].isAbsentCandidate, true);
			const analysis5 = buildSessionAnalysis(s5.classifications, createEmptySnapshot(), null, s5.lifecycles);
			assert.strictEqual(analysis5.absentCandidateFindings?.length, 1);
		});
	});

	describe('3. Non-Invasive Persisting Transitions & Priority Gating', () => {
		it('flags isNewPersisting on first graduation to persisting, but not on steady-state saves', () => {
			const vuln = createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10);
			const t0 = 1_000_000;

			// Observation 1: t0 (candidate)
			const s1 = processObservation([vuln], [], t0, true);
			assert.strictEqual(s1.classifications[0].status, 'candidate');
			assert.strictEqual(s1.classifications[0].isNewPersisting, undefined);

			// Observation 2: t0 + 10s (active, 1 confirmation)
			const s2 = processObservation([vuln], s1.lifecycles, t0 + 10_000, true);
			assert.strictEqual(s2.classifications[0].status, 'active');
			assert.strictEqual(s2.classifications[0].isNewPersisting, undefined);

			// Observation 3: t0 + 35s (duration >= 30s, confirmations >= 2 -> graduates to persisting)
			const s3 = processObservation([vuln], s2.lifecycles, t0 + 35_000, true);
			assert.strictEqual(s3.classifications[0].status, 'persisting');
			assert.strictEqual(s3.classifications[0].isNewPersisting, true, 'Must flag isNewPersisting on initial graduation');

			const analysis3 = buildSessionAnalysis(s3.classifications, createEmptySnapshot(), null, s3.lifecycles);
			assert.strictEqual(analysis3.newPersistingFindings?.length, 1);

			// Observation 4: t0 + 45s (still persisting in steady state)
			const s4 = processObservation([vuln], s3.lifecycles, t0 + 45_000, true);
			assert.strictEqual(s4.classifications[0].status, 'persisting');
			assert.strictEqual(s4.classifications[0].isNewPersisting, undefined, 'Must NOT flag isNewPersisting in steady state');

			const analysis4 = buildSessionAnalysis(s4.classifications, createEmptySnapshot(), null, s4.lifecycles);
			assert.strictEqual(analysis4.newPersistingFindings?.length ?? 0, 0, 'newPersistingFindings must be empty in steady state');
		});

		it('suppresses repeating persisting toasts in milestones mode when findings are steady-state', () => {
			const analysis = {
				...buildSessionAnalysis([], createEmptySnapshot(), null, []),
				persistingPatterns: 3,
				newPersistingFindings: [], // steady-state
			};

			// Default 'milestones' mode: no toast for steady state!
			const plan = determinePrioritizedToast(analysis, 'milestones');
			assert.strictEqual(plan, null, 'Must not fire persisting toast in milestones mode without newly persisting findings');

			// 'all' mode: legacy cooldown-based toast allowed
			const planAll = determinePrioritizedToast(analysis, 'all');
			assert.ok(planAll);
			assert.strictEqual(planAll.type, 'persisting');
			assert.ok(planAll.message.includes('3 issues are still persisting'));
		});

		it('fires persisting toast in milestones mode when newly persisting findings exist', () => {
			const dummyClassification: FindingClassification = {
				...processObservation([createMockObserved('SQL Injection', 'CWE-89', 'Db.java', 10)], [], 1000, true).classifications[0],
				status: 'persisting',
				isNewPersisting: true,
			};

			const analysis = {
				...buildSessionAnalysis([], createEmptySnapshot(), null, []),
				persistingPatterns: 1,
				newPersistingFindings: [dummyClassification],
			};

			const plan = determinePrioritizedToast(analysis, 'milestones');
			assert.ok(plan);
			assert.strictEqual(plan.type, 'persisting');
			assert.strictEqual(plan.severity, 'warning');
			assert.ok(plan.message.includes('1 issue is still persisting'));
		});

		it('suppresses all toasts when notification level is quiet', () => {
			const analysis = {
				...buildSessionAnalysis([], createEmptySnapshot(), null, []),
				recurringPatterns: 2,
				resolvedThisSession: 1,
				persistingPatterns: 5,
			};

			const plan = determinePrioritizedToast(analysis, 'quiet');
			assert.strictEqual(plan, null, 'Quiet mode must return null for all toasts');
		});

		it('prioritizes absent candidate (fix applied) over steady-state persisting issues', () => {
			const dummyAbsent: FindingClassification = {
				...processObservation([createMockObserved('XSS', 'CWE-79', 'Web.java', 20)], [], 1000, true).classifications[0],
				status: 'candidate',
				isAbsentCandidate: true,
			};

			const analysis = {
				...buildSessionAnalysis([], createEmptySnapshot(), null, []),
				persistingPatterns: 4, // 4 other issues persisting
				absentCandidateFindings: [dummyAbsent],
			};

			const plan = determinePrioritizedToast(analysis, 'milestones');
			assert.ok(plan);
			assert.strictEqual(plan.type, 'absentCandidate', 'Should show fix applied toast rather than persisting toast');
			assert.ok(plan.message.includes('1 issue fixed — resolution status is being processed...'));
		});

		it('prioritizes recurring alert over candidate transitions', () => {
			const dummyAbsent: FindingClassification = {
				...processObservation([createMockObserved('XSS', 'CWE-79', 'Web.java', 20)], [], 1000, true).classifications[0],
				status: 'recurring',
			};

			const analysis = {
				...buildSessionAnalysis([], createEmptySnapshot(), null, []),
				recurringPatterns: 1,
				absentCandidateFindings: [dummyAbsent],
			};

			const plan = determinePrioritizedToast(analysis, 'milestones');
			assert.ok(plan);
			assert.strictEqual(plan.type, 'recurring', 'Recurring pattern must take precedence as a warning');
			assert.strictEqual(plan.severity, 'warning');
		});
	});
});
