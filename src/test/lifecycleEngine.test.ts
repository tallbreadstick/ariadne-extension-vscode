import * as assert from 'assert';
import {
	processObservation,
	classifyFinding,
} from '../modules/tracker/analysis/lifecycleEngine.js';
import type {
	FindingLifecycleRecord,
	ObservedFinding,
} from '../modules/tracker/analysis/lifecycleTypes.js';
import { LIFECYCLE_POLICY } from '../modules/tracker/analysis/lifecycleTypes.js';

function createMockFinding(overrides: Partial<ObservedFinding> = {}): ObservedFinding {
	return {
		logicalFingerprint: 'sha256:logical_abc123',
		contentFingerprint: 'sha256:content_def456',
		scopeFingerprint: 'sha256:scope_ghi789',
		ruleId: 'rule-sql-injection',
		cweId: 'CWE-89',
		type: 'SQL Injection',
		severity: 'high',
		instanceName: 'executeQuery',
		filePath: '/workspace/src/db.ts',
		occurrenceCount: 2,
		...overrides,
	};
}

describe('Lifecycle Engine Test Suite', () => {
	const t0 = 1_000_000;

	describe('1. Candidate State on First Sight', () => {
		it('starts newly observed findings as candidate with confirmationCount 0', () => {
			const finding = createMockFinding();
			const result = processObservation([finding], [], t0, true);

			assert.strictEqual(result.lifecycles.length, 1);
			const lc = result.lifecycles[0];

			assert.strictEqual(lc.logicalFingerprint, finding.logicalFingerprint);
			assert.strictEqual(lc.confirmationCount, 0);
			assert.strictEqual(lc.baselineOccurrenceCount, 2);
			assert.strictEqual(lc.currentOccurrenceCount, 2);
			assert.strictEqual(lc.missingSince, null);
			assert.strictEqual(lc.provisionalResolutionAt, null);
			assert.strictEqual(lc.durableResolutionAt, null);
			assert.strictEqual(lc.recurrenceCount, 0);
			assert.strictEqual(lc.inSessionToggleCount, 0);
			assert.strictEqual(lc.identicalRestorationCount, 0);

			assert.strictEqual(result.classifications.length, 1);
			assert.strictEqual(result.classifications[0].status, 'candidate');
			assert.strictEqual(lc.lifecycleState, 'candidate');
		});

		it('remains candidate in unsettled observation (live scan)', () => {
			const finding = createMockFinding();
			const result = processObservation([finding], [], t0, false);

			assert.strictEqual(result.lifecycles.length, 1);
			assert.strictEqual(result.lifecycles[0].confirmationCount, 0);
			assert.strictEqual(result.classifications[0].status, 'candidate');
		});
	});

	describe('2. Transition: Candidate -> Active', () => {
		it('transitions from candidate to active on first settled confirmation', () => {
			const finding = createMockFinding();

			// Observation 1: initial detection -> candidate
			const step1 = processObservation([finding], [], t0, false);
			assert.strictEqual(step1.classifications[0].status, 'candidate');
			assert.strictEqual(step1.lifecycles[0].confirmationCount, 0);

			// Observation 2: first settled confirmation (isSettled: true)
			const t1 = t0 + 5_000;
			const step2 = processObservation([finding], step1.lifecycles, t1, true);

			assert.strictEqual(step2.lifecycles[0].confirmationCount, 1);
			assert.strictEqual(step2.lifecycles[0].lastConfirmedAt, t1);
			assert.strictEqual(step2.classifications[0].status, 'active');
			assert.strictEqual(step2.lifecycles[0].lifecycleState, 'active');
		});

		it('remains active on subsequent settled confirmation if duration < 30s', () => {
			const finding = createMockFinding();
			const step1 = processObservation([finding], [], t0, true);
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);

			// 2 confirmations, but observedAge = 10s < 30s
			assert.strictEqual(step2.lifecycles[0].confirmationCount, 1);
			const step3 = processObservation([finding], step2.lifecycles, t0 + 20_000, true);

			assert.strictEqual(step3.lifecycles[0].confirmationCount, 2);
			assert.strictEqual(step3.classifications[0].status, 'active');
		});
	});

	describe('3. Transition: Active -> Persisting', () => {
		it('transitions to persisting when duration >= 30,000ms and confirmations >= 2', () => {
			const finding = createMockFinding();

			// Step 1: Initial candidate at t0
			const step1 = processObservation([finding], [], t0, true);

			// Step 2: Settled confirmation at t0 + 10s -> confirmationCount = 1
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);
			assert.strictEqual(step2.lifecycles[0].confirmationCount, 1);
			assert.strictEqual(step2.classifications[0].status, 'active');

			// Step 3: Settled confirmation at t0 + 35s (observedAge = 35s >= 30s) -> confirmationCount = 2
			const tFinal = t0 + 35_000;
			const step3 = processObservation([finding], step2.lifecycles, tFinal, true);

			assert.strictEqual(step3.lifecycles[0].confirmationCount, 2);
			assert.strictEqual(step3.classifications[0].status, 'persisting');
			assert.strictEqual(step3.lifecycles[0].lifecycleState, 'persisting');
		});

		it('does not transition to persisting if age >= 30s but confirmations < 2', () => {
			const finding = createMockFinding();
			const step1 = processObservation([finding], [], t0, false); // confirmationCount = 0

			// 35s later, 1 settled confirmation
			const step2 = processObservation([finding], step1.lifecycles, t0 + 35_000, true);
			assert.strictEqual(step2.lifecycles[0].confirmationCount, 1);
			assert.strictEqual(step2.classifications[0].status, 'active');
		});
	});

	describe('4. Transition: Active -> Improving', () => {
		it('transitions to improving when active and occurrence count drops below baseline', () => {
			const finding1 = createMockFinding({ occurrenceCount: 4 });
			const step1 = processObservation([finding1], [], t0, true);
			const step2 = processObservation([finding1], step1.lifecycles, t0 + 10_000, true);
			assert.strictEqual(step2.classifications[0].status, 'active');

			// Same finding with occurrences decreased from 4 to 2
			const findingDecreased = createMockFinding({ occurrenceCount: 2 });
			const step3 = processObservation([findingDecreased], step2.lifecycles, t0 + 20_000, true);

			assert.strictEqual(step3.classifications[0].status, 'improving');
			assert.strictEqual(step3.lifecycles[0].lifecycleState, 'improving');
			assert.strictEqual(step3.lifecycles[0].currentOccurrenceCount, 2);
			assert.strictEqual(step3.lifecycles[0].baselineOccurrenceCount, 4);
		});
	});

	describe('5. Absence, Grace Period, and Resolution', () => {
		it('records missingSince on first absence and respects 5s grace period', () => {
			const finding = createMockFinding();
			const step1 = processObservation([finding], [], t0, true);
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);

			// Finding is missing at t0 + 15_000
			const tAbsent1 = t0 + 15_000;
			const stepAbsent1 = processObservation([], step2.lifecycles, tAbsent1, true);

			const lc = stepAbsent1.lifecycles[0];
			assert.strictEqual(lc.missingSince, tAbsent1);
			assert.strictEqual(lc.provisionalResolutionAt, null);
			assert.strictEqual(lc.durableResolutionAt, null);

			// Still missing at tAbsent1 + 3s (< 5s grace period)
			const tAbsent2 = tAbsent1 + 3_000;
			const stepAbsent2 = processObservation([], stepAbsent1.lifecycles, tAbsent2, true);
			assert.strictEqual(stepAbsent2.lifecycles[0].provisionalResolutionAt, null);
		});

		it('marks provisional resolution after grace period exceeds 5,000ms', () => {
			const finding = createMockFinding();
			const step1 = processObservation([finding], [], t0, true);
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);

			const tAbsent1 = t0 + 15_000;
			processObservation([], step2.lifecycles, tAbsent1, true);

			// Now 6s after initial absence (> 5s grace period)
			const tAbsentProvisional = tAbsent1 + 6_000;
			const stepProvisional = processObservation([], step2.lifecycles, tAbsentProvisional, true);

			const lc = stepProvisional.lifecycles[0];
			assert.strictEqual(lc.provisionalResolutionAt, tAbsentProvisional);
			assert.strictEqual(lc.currentOccurrenceCount, 0);
			assert.strictEqual(lc.durableResolutionAt, null);
		});

		it('confirms durable resolution on subsequent settled observation', () => {
			const finding = createMockFinding();
			const step1 = processObservation([finding], [], t0, true);
			const step2 = processObservation([finding], step1.lifecycles, t0 + 10_000, true);

			const tAbsent1 = t0 + 15_000;
			processObservation([], step2.lifecycles, tAbsent1, true);

			// Provisional resolution at tAbsent1 + 6s
			const tAbsent2 = tAbsent1 + 6_000;
			processObservation([], step2.lifecycles, tAbsent2, true);

			// Subsequent settled observation at tAbsent2 + 5s -> durable resolution
			const tDurable = tAbsent2 + 5_000;
			const stepDurable = processObservation([], step2.lifecycles, tDurable, true);

			const lc = stepDurable.lifecycles[0];
			assert.strictEqual(lc.durableResolutionAt, tDurable);
			assert.strictEqual(stepDurable.classifications[0].status, 'resolved');
			assert.strictEqual(lc.lifecycleState, 'resolved');
		});
	});

	describe('6. Reappearance and Recurrence', () => {
		it('transitions to recurring when a durably resolved finding reappears', () => {
			const finding = createMockFinding();
			const lifecycles: FindingLifecycleRecord[] = [];

			// Setup active -> provisional -> durable resolution
			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);
			processObservation([], lifecycles, t0 + 15_000, true);
			processObservation([], lifecycles, t0 + 21_000, true); // provisional
			processObservation([], lifecycles, t0 + 27_000, true); // durable resolved
			assert.strictEqual(lifecycles[0].durableResolutionAt, t0 + 27_000);

			// Now finding returns at t0 + 40_000 with changed content (genuine edit)
			const returningFinding = createMockFinding({
				contentFingerprint: 'sha256:content_modified_999',
				occurrenceCount: 3,
			});

			const stepReappear = processObservation([returningFinding], lifecycles, t0 + 40_000, true);

			const lc = stepReappear.lifecycles[0];
			assert.strictEqual(lc.recurrenceCount, 1);
			assert.strictEqual(lc.durableResolutionAt, null);
			assert.strictEqual(lc.provisionalResolutionAt, null);
			assert.strictEqual(lc.missingSince, null);
			assert.strictEqual(lc.baselineOccurrenceCount, 3);
			assert.strictEqual(stepReappear.classifications[0].status, 'recurring');
			assert.strictEqual(lc.lifecycleState, 'recurring');
		});
	});

	describe('7. Identical Restoration & In-Session Toggle Handling', () => {
		it('increments identicalRestorationCount and inSessionToggleCount when identical content/scope return', () => {
			const finding = createMockFinding({
				contentFingerprint: 'sha256:same_content_111',
				scopeFingerprint: 'sha256:same_scope_222',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);

			// Absence -> provisional resolution
			processObservation([], lifecycles, t0 + 15_000, true);
			processObservation([], lifecycles, t0 + 22_000, true);
			assert.strictEqual(lifecycles[0].provisionalResolutionAt, t0 + 22_000);

			// Reappears with IDENTICAL content and scope
			const identicalFinding = createMockFinding({
				contentFingerprint: 'sha256:same_content_111',
				scopeFingerprint: 'sha256:same_scope_222',
			});

			processObservation([identicalFinding], lifecycles, t0 + 30_000, true);

			const lc = lifecycles[0];
			assert.strictEqual(lc.identicalRestorationCount, 1);
			assert.strictEqual(lc.inSessionToggleCount, 1);
			assert.strictEqual(lc.provisionalResolutionAt, null);
		});

		it('increments identicalRestorationCount, inSessionToggleCount, and recurrenceCount on identical return after durable resolution', () => {
			const finding = createMockFinding({
				contentFingerprint: 'sha256:same_content_111',
				scopeFingerprint: 'sha256:same_scope_222',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);

			// Absence -> provisional -> durable
			processObservation([], lifecycles, t0 + 15_000, true);
			processObservation([], lifecycles, t0 + 22_000, true); // provisional
			processObservation([], lifecycles, t0 + 28_000, true); // durable
			assert.strictEqual(lifecycles[0].durableResolutionAt, t0 + 28_000);

			// Reappears with IDENTICAL content and scope
			const identicalFinding = createMockFinding({
				contentFingerprint: 'sha256:same_content_111',
				scopeFingerprint: 'sha256:same_scope_222',
			});

			processObservation([identicalFinding], lifecycles, t0 + 35_000, true);

			const lc = lifecycles[0];
			assert.strictEqual(lc.identicalRestorationCount, 1);
			assert.strictEqual(lc.inSessionToggleCount, 1);
			assert.strictEqual(lc.recurrenceCount, 1);
			assert.strictEqual(lc.durableResolutionAt, null);
		});

		it('does NOT increment identical restoration counts when content fingerprint changed', () => {
			const finding = createMockFinding({
				contentFingerprint: 'sha256:original_content',
				scopeFingerprint: 'sha256:original_scope',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);
			processObservation([], lifecycles, t0 + 15_000, true);
			processObservation([], lifecycles, t0 + 22_000, true);

			// Reappears with DIFFERENT content
			const modifiedFinding = createMockFinding({
				contentFingerprint: 'sha256:new_content_fixed',
				scopeFingerprint: 'sha256:original_scope',
			});

			processObservation([modifiedFinding], lifecycles, t0 + 30_000, true);

			const lc = lifecycles[0];
			assert.strictEqual(lc.identicalRestorationCount, 0);
			assert.strictEqual(lc.inSessionToggleCount, 0);
		});
	});

	describe('8. Observation Gating (isSettled: false vs true)', () => {
		it('unsettled live scans do not advance confirmations, absence, or durable resolution', () => {
			const finding = createMockFinding();
			const lifecycles: FindingLifecycleRecord[] = [];

			// Observation 1: unsettled
			processObservation([finding], lifecycles, t0, false);
			assert.strictEqual(lifecycles[0].confirmationCount, 0);

			// Observation 2: unsettled 10s later
			processObservation([finding], lifecycles, t0 + 10_000, false);
			assert.strictEqual(lifecycles[0].confirmationCount, 0); // Still 0!

			// First settled scan
			processObservation([finding], lifecycles, t0 + 12_000, true);
			assert.strictEqual(lifecycles[0].confirmationCount, 1);

			// Unsettled absence (e.g. typing or commenting out line)
			processObservation([], lifecycles, t0 + 15_000, false);
			assert.strictEqual(lifecycles[0].missingSince, null); // Did not set missingSince!

			// Settled absence
			processObservation([], lifecycles, t0 + 16_000, true);
			assert.strictEqual(lifecycles[0].missingSince, t0 + 16_000);

			// Unsettled scan after grace period does not trigger provisional or durable resolution
			processObservation([], lifecycles, t0 + 25_000, false);
			assert.strictEqual(lifecycles[0].provisionalResolutionAt, null);
		});
	});

	describe('9. Direct classifyFinding Unit Verification', () => {
		it('returns correct state for all lifecycle variations', () => {
			const baseRecord: FindingLifecycleRecord = {
				logicalFingerprint: 'fp1',
				contentFingerprint: 'cp1',
				scopeFingerprint: 'sp1',
				ruleId: 'r1',
				cweId: 'CWE-89',
				type: 'SQL Injection',
				severity: 'high',
				instanceName: 'query',
				filePath: 'a.ts',
				firstConfirmedAt: 1000,
				lastConfirmedAt: 2000,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				baselineOccurrenceCount: 2,
				currentOccurrenceCount: 2,
				confirmationCount: 0,
				recurrenceCount: 0,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
			};

			// Candidate: confirmationCount = 0
			assert.strictEqual(classifyFinding(baseRecord, 2000), 'candidate');

			// Active: confirmationCount >= 1, age < 30s
			const activeRecord = { ...baseRecord, confirmationCount: 1 };
			assert.strictEqual(classifyFinding(activeRecord, 2000), 'active');

			// Persisting: confirmationCount >= 2, age >= 30s
			const persistingRecord = { ...baseRecord, confirmationCount: 2 };
			assert.strictEqual(classifyFinding(persistingRecord, 1000 + 30_000), 'persisting');

			// Improving: current < baseline
			const improvingRecord = { ...baseRecord, confirmationCount: 1, currentOccurrenceCount: 1 };
			assert.strictEqual(classifyFinding(improvingRecord, 2000), 'improving');

			// Resolved: durableResolutionAt !== null
			const resolvedRecord = { ...baseRecord, durableResolutionAt: 5000, missingSince: 3000 };
			assert.strictEqual(classifyFinding(resolvedRecord, 6000), 'resolved');

			// Recurring: recurrenceCount >= 1 and active
			const recurringRecord = { ...baseRecord, confirmationCount: 1, recurrenceCount: 1 };
			assert.strictEqual(classifyFinding(recurringRecord, 2000), 'recurring');
		});
	});
});
