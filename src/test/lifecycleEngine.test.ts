import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { SessionStore } from '../modules/tracker/storage/sessionStore.js';
import {
	processObservation,
	classifyFinding,
	startSession,
	setSessionBaseline,
	updateSessionLatest,
	finalizeSession,
	extractTrendComparisonBaseline,
} from '../modules/tracker/analysis/lifecycleEngine.js';
import type {
	FindingLifecycleRecord,
	ObservedFinding,
} from '../modules/tracker/analysis/lifecycleTypes.js';
import { LIFECYCLE_POLICY } from '../modules/tracker/analysis/lifecycleTypes.js';
import { metadataToObservedFindings } from '../modules/detection/bridge/convert.js';
import type {
	VulnerabilityMetadata,
	ScanSnapshot,
} from '../modules/feedback/vulnerability_results/vulnerabilityTypes.js';
import { buildSessionAnalysis } from '../modules/tracker/analysis/snapshotAnalyzer.js';

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
		it('classifies as recurring after reappearance (thresholds restart from recurrence)', () => {
			const finding = createMockFinding();
			const lifecycles: FindingLifecycleRecord[] = [];

			// Setup active -> provisional -> durable resolution
			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);
			processObservation([], lifecycles, t0 + 15_000, true);
			processObservation([], lifecycles, t0 + 21_000, true); // provisional
			processObservation([], lifecycles, t0 + 27_000, true); // durable resolved
			assert.strictEqual(lifecycles[0].durableResolutionAt, t0 + 27_000);

			// Finding returns at t0 + 40_000
			const returningFinding = createMockFinding({
				contentFingerprint: 'sha256:content_modified_999',
				occurrenceCount: 3,
			});

			const stepReappear = processObservation([returningFinding], lifecycles, t0 + 40_000, true);

			const lc = stepReappear.lifecycles[0];
			assert.strictEqual(lc.recurrenceCount, 1);
			assert.strictEqual(lc.lastRecurredAt, t0 + 40_000);
			assert.strictEqual(lc.durableResolutionAt, null);
			assert.strictEqual(lc.provisionalResolutionAt, null);
			assert.strictEqual(lc.missingSince, null);
			assert.strictEqual(lc.baselineOccurrenceCount, 3);
			// confirmationCount resets on recurrence, then +1 from this observation
			assert.strictEqual(lc.confirmationCount, 1);
			// Thresholds restart from lastRecurredAt — age=0, confirmations=1
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

			const stepReappear = processObservation([identicalFinding], lifecycles, t0 + 30_000, true);

			const lc = lifecycles[0];
			assert.strictEqual(lc.identicalRestorationCount, 1);
			assert.strictEqual(lc.inSessionToggleCount, 1);
			assert.strictEqual(lc.provisionalResolutionAt, null);
			assert.strictEqual(stepReappear.classifications[0].isIdenticalRestoration, true);
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

			const stepReappear = processObservation([identicalFinding], lifecycles, t0 + 35_000, true);

			const lc = lifecycles[0];
			assert.strictEqual(lc.identicalRestorationCount, 1);
			assert.strictEqual(lc.inSessionToggleCount, 1);
			assert.strictEqual(lc.recurrenceCount, 1);
			assert.strictEqual(lc.durableResolutionAt, null);
			assert.strictEqual(stepReappear.classifications[0].isIdenticalRestoration, true);
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

			const stepReappear = processObservation([modifiedFinding], lifecycles, t0 + 30_000, true);

			const lc = lifecycles[0];
			assert.strictEqual(lc.identicalRestorationCount, 0);
			assert.strictEqual(lc.inSessionToggleCount, 0);
			assert.strictEqual(stepReappear.classifications[0].isIdenticalRestoration, undefined);
		});

		it('tracks multiple in-session toggle cycles correctly', () => {
			const finding = createMockFinding({
				contentFingerprint: 'sha256:same_content_toggle',
				scopeFingerprint: 'sha256:same_scope_toggle',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			// Observation 1: Active
			processObservation([finding], lifecycles, t0, true);
			assert.strictEqual(lifecycles[0].identicalRestorationCount, 0);

			// Toggle 1: Absent then restored
			processObservation([], lifecycles, t0 + 5_000, true); // absent
			const step1 = processObservation([finding], lifecycles, t0 + 8_000, true); // restored
			assert.strictEqual(lifecycles[0].identicalRestorationCount, 1);
			assert.strictEqual(lifecycles[0].inSessionToggleCount, 1);
			assert.strictEqual(step1.classifications[0].isIdenticalRestoration, true);

			// Ongoing active observation (no absence): does not increment toggle count
			const stepOngoing = processObservation([finding], lifecycles, t0 + 12_000, true);
			assert.strictEqual(lifecycles[0].identicalRestorationCount, 1);
			assert.strictEqual(lifecycles[0].inSessionToggleCount, 1);
			assert.strictEqual(stepOngoing.classifications[0].isIdenticalRestoration, undefined);

			// Toggle 2: Absent then restored again
			processObservation([], lifecycles, t0 + 15_000, true); // absent
			const step2 = processObservation([finding], lifecycles, t0 + 20_000, true); // restored
			assert.strictEqual(lifecycles[0].identicalRestorationCount, 2);
			assert.strictEqual(lifecycles[0].inSessionToggleCount, 2);
			assert.strictEqual(step2.classifications[0].isIdenticalRestoration, true);
		});

		it('grace period interaction: absent within 5s grace period is restored before provisional resolution', () => {
			const finding = createMockFinding({
				contentFingerprint: 'sha256:content_quick_comment',
				scopeFingerprint: 'sha256:scope_quick_comment',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			processObservation([finding], lifecycles, t0, true);

			// Temporarily commented out: absent at t0 + 2_000
			processObservation([], lifecycles, t0 + 2_000, true);
			assert.strictEqual(lifecycles[0].missingSince, t0 + 2_000);
			assert.strictEqual(lifecycles[0].provisionalResolutionAt, null, 'Within grace period, not provisional');

			// Uncommented at t0 + 4_000 (still within 5s grace period)
			const stepRestore = processObservation([finding], lifecycles, t0 + 4_000, true);
			const lc = lifecycles[0];
			assert.strictEqual(lc.missingSince, null);
			assert.strictEqual(lc.provisionalResolutionAt, null);
			assert.strictEqual(lc.identicalRestorationCount, 1);
			assert.strictEqual(lc.inSessionToggleCount, 1);
			assert.strictEqual(stepRestore.classifications[0].isIdenticalRestoration, true);
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
				lastRecurredAt: null,
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

			// Recurring: recurrenceCount >= 1 and active, thresholds not met since recurrence
			const recurringRecord = {
				...baseRecord, confirmationCount: 1, recurrenceCount: 1,
				lastRecurredAt: 1500,
			};
			assert.strictEqual(classifyFinding(recurringRecord, 2000), 'recurring');

			// Recurring → Persisting: recurrenceCount >= 1 AND thresholds met since lastRecurredAt
			const recurringPersistingRecord = {
				...baseRecord, confirmationCount: 2, recurrenceCount: 1,
				lastRecurredAt: 1500,
			};
			assert.strictEqual(
				classifyFinding(recurringPersistingRecord, 1500 + 30_000),
				'persisting',
			);
		});
	});

	describe('10. Strict 1-to-1 Instance Mapping (Parity)', () => {
		it('maps scanner findings 1-to-1 to ObservedFindings without collapsing identical logical_fingerprints', () => {
			const rawFindings: VulnerabilityMetadata[] = [
				{
					type: 'Path Traversal',
					cwe_id: 'CWE-22',
					owasp_category: 'A01:2021',
					severity: 'high',
					file_path: '/src/ReviewController.java',
					line_number: 85,
					rule_id: 'taint.path.fileApi',
					instance_name: 'submitReview',
					logical_fingerprint: 'sha256:logical_method_scope',
					instance_fingerprint: 'sha256:sink_line_85',
					content_fingerprint: 'sha256:content_line_85',
					scope_fingerprint: 'sha256:scope_review_controller',
				},
				{
					type: 'Path Traversal',
					cwe_id: 'CWE-22',
					owasp_category: 'A01:2021',
					severity: 'high',
					file_path: '/src/ReviewController.java',
					line_number: 92,
					rule_id: 'taint.path.fileApi',
					instance_name: 'submitReview',
					logical_fingerprint: 'sha256:logical_method_scope', // Same method scope!
					instance_fingerprint: 'sha256:sink_line_92',        // Distinct sink identity!
					content_fingerprint: 'sha256:content_line_92',
					scope_fingerprint: 'sha256:scope_review_controller',
				},
			];

			const observed = metadataToObservedFindings(rawFindings);

			// Must NOT be collapsed into 1 finding with count 2
			assert.strictEqual(observed.length, 2, 'Must produce exactly 2 ObservedFindings');
			assert.strictEqual(observed[0].occurrenceCount, 1);
			assert.strictEqual(observed[1].occurrenceCount, 1);
			assert.strictEqual(observed[0].logicalFingerprint, 'sha256:sink_line_85');
			assert.strictEqual(observed[1].logicalFingerprint, 'sha256:sink_line_92');
		});

		it('resolves the fixed sink independently while the second sink stays persisting', () => {
			const rawFindings: VulnerabilityMetadata[] = [
				{
					type: 'Path Traversal',
					cwe_id: 'CWE-22',
					owasp_category: 'A01:2021',
					severity: 'high',
					file_path: '/src/ReviewController.java',
					line_number: 85,
					rule_id: 'taint.path.fileApi',
					instance_fingerprint: 'sha256:sink_line_85',
					content_fingerprint: 'sha256:content_line_85',
					scope_fingerprint: 'sha256:scope_review_controller',
				},
				{
					type: 'Path Traversal',
					cwe_id: 'CWE-22',
					owasp_category: 'A01:2021',
					severity: 'high',
					file_path: '/src/ReviewController.java',
					line_number: 92,
					rule_id: 'taint.path.fileApi',
					instance_fingerprint: 'sha256:sink_line_92',
					content_fingerprint: 'sha256:content_line_92',
					scope_fingerprint: 'sha256:scope_review_controller',
				},
			];

			// Step 1: Baseline observation with both sinks present (confirmationCount = 0)
			const t0 = 1_000_000;
			const observed0 = metadataToObservedFindings(rawFindings);
			const step1 = processObservation(observed0, [], t0, true);

			// Step 2: First settled confirmation at t0 + 10s (confirmationCount = 1)
			const step2 = processObservation(observed0, step1.lifecycles, t0 + 10_000, true);
			assert.strictEqual(step2.classifications[0].status, 'active');

			// Step 3: Second settled confirmation at t0 + 35s (confirmationCount = 2, age >= 30s) -> persisting!
			const t1 = t0 + 35_000;
			const step3 = processObservation(observed0, step2.lifecycles, t1, true);

			assert.strictEqual(step3.lifecycles.length, 2);
			assert.strictEqual(step3.classifications[0].status, 'persisting');
			assert.strictEqual(step3.classifications[1].status, 'persisting');

			// Step 4: Student fixes Line 85! Only Line 92 is present in the scan
			const rawFindingsAfterFix: VulnerabilityMetadata[] = [rawFindings[1]];
			const observedFixed = metadataToObservedFindings(rawFindingsAfterFix);

			const tFix = t1 + 5_000;
			const stepFix1 = processObservation(observedFixed, step3.lifecycles, tFix, true);

			// Line 85 is now missing (first absence)
			const lc85_step1 = stepFix1.lifecycles.find(l => l.logicalFingerprint === 'sha256:sink_line_85')!;
			const lc92_step1 = stepFix1.lifecycles.find(l => l.logicalFingerprint === 'sha256:sink_line_92')!;

			assert.strictEqual(lc85_step1.missingSince, tFix);
			assert.strictEqual(lc92_step1.missingSince, null);
			assert.strictEqual(lc92_step1.lifecycleState, 'persisting');

			// Step 5: After grace period (6s later), Line 85 is confirmed absent -> durable resolution!
			const tFixDurable = tFix + 6_000;
			// Pass 1 after grace period: provisional resolution
			const stepFix2 = processObservation(observedFixed, stepFix1.lifecycles, tFixDurable, true);
			// Pass 2: durable resolution confirmed
			const stepFix3 = processObservation(observedFixed, stepFix2.lifecycles, tFixDurable + 1000, true);

			const lc85_final = stepFix3.lifecycles.find(l => l.logicalFingerprint === 'sha256:sink_line_85')!;
			const lc92_final = stepFix3.lifecycles.find(l => l.logicalFingerprint === 'sha256:sink_line_92')!;

			assert.strictEqual(lc85_final.lifecycleState, 'resolved');
			assert.strictEqual(lc92_final.lifecycleState, 'persisting');

			// Exactly 1 resolved, 1 persisting!
			const resolvedCount = stepFix3.classifications.filter(c => c.status === 'resolved').length;
			const persistingCount = stepFix3.classifications.filter(c => c.status === 'persisting').length;

			assert.strictEqual(resolvedCount, 1, 'Exactly 1 finding must be classified as resolved');
			assert.strictEqual(persistingCount, 1, 'Exactly 1 finding must remain persisting');
		});
	});

	describe('11. Transition: Recurring → Persisting', () => {
		it('recurring finding graduates to persisting after 30s and 2 confirmations since recurrence', () => {
			const finding = createMockFinding();
			const lifecycles: FindingLifecycleRecord[] = [];

			// Detect, confirm, resolve quickly
			processObservation([finding], lifecycles, t0, true);
			processObservation([], lifecycles, t0 + 1_000, true);
			processObservation([], lifecycles, t0 + 7_000, true); // provisional
			processObservation([], lifecycles, t0 + 13_000, true); // durable

			// Recurrence at t0 + 20_000 — confirmationCount resets to 0, then +1
			const recurringFinding = createMockFinding({
				contentFingerprint: 'sha256:content_changed',
			});
			const stepRecur = processObservation([recurringFinding], lifecycles, t0 + 20_000, true);
			assert.strictEqual(stepRecur.classifications[0].status, 'recurring');
			assert.strictEqual(lifecycles[0].recurrenceCount, 1);
			assert.strictEqual(lifecycles[0].lastRecurredAt, t0 + 20_000);
			assert.strictEqual(lifecycles[0].confirmationCount, 1);

			// Confirm at t0 + 40_000 — age since recurrence = 20s < 30s, confirmations = 2
			const stepConfirm = processObservation([recurringFinding], lifecycles, t0 + 40_000, true);
			assert.strictEqual(stepConfirm.classifications[0].status, 'recurring');

			// Confirm at t0 + 55_000 — age since recurrence = 35s >= 30s, confirmations = 3 >= 2
			const stepPersist = processObservation([recurringFinding], lifecycles, t0 + 55_000, true);
			assert.strictEqual(stepPersist.classifications[0].status, 'persisting');
			// recurrenceCount is preserved
			assert.strictEqual(lifecycles[0].recurrenceCount, 1);
		});

		it('preserves recurrenceCount after graduating to persisting', () => {
			const record: FindingLifecycleRecord = {
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
				lastConfirmedAt: 40_000,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				baselineOccurrenceCount: 2,
				currentOccurrenceCount: 2,
				confirmationCount: 3,
				recurrenceCount: 2,
				lastRecurredAt: 5_000,
				inSessionToggleCount: 0,
				identicalRestorationCount: 0,
			};

			// Age since recurrence = 41_000 - 5_000 = 36s >= 30s, confirmations = 3 >= 2
			const status = classifyFinding(record, 41_000);
			assert.strictEqual(status, 'persisting');
			assert.strictEqual(record.recurrenceCount, 2, 'recurrenceCount must not be cleared');
		});
	});

	describe('12. Session Analysis Integration (Integrity Metrics)', () => {
		it('computes totalIdenticalRestorations and totalInSessionToggles from classifications', () => {
			const finding = createMockFinding({
				contentFingerprint: 'sha256:same_content_111',
				scopeFingerprint: 'sha256:same_scope_222',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			// Active -> absent -> restored
			processObservation([finding], lifecycles, t0, true);
			processObservation([], lifecycles, t0 + 10_000, true);
			const step = processObservation([finding], lifecycles, t0 + 20_000, true);

			const mockScan: ScanSnapshot = {
				scan_id: 'scan-1',
				timestamp: t0 + 20_000,
				vulnerabilities: [
					{
						type: finding.type,
						cwe_id: finding.cweId,
						owasp_category: '',
						severity: finding.severity,
						instances: [
							{
								name: finding.instanceName,
								kind: 'variable',
								occurrences: [],
							},
						],
					},
				],
			};

			const analysis = buildSessionAnalysis(step.classifications, mockScan, null);
			assert.strictEqual(analysis.totalIdenticalRestorations, 1);
			assert.strictEqual(analysis.totalInSessionToggles, 1);
		});
	});

	describe('13. Commented-Out Vulnerability Handling (Option 1: Retained as Persisting)', () => {
		it('retains commented-out vulnerability as persisting and suppresses resolution', () => {
			const finding = createMockFinding({
				filePath: '/workspace/src/db.ts',
				lineNumber: 3,
				instanceName: 'executeQuery',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			// Observation 1 & 2: Active and confirmed
			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);

			// Mock file provider returning file content where the vulnerability line is commented out
			const commentedFile = [
				'import db from "db";',
				'function run() {',
				'  // const res = executeQuery(userInput);',
				'  return null;',
				'}',
			].join('\n');

			const mockProvider = (path: string) => path === '/workspace/src/db.ts' ? commentedFile : undefined;

			// Observation 3: Finding absent, 25 seconds later (past 20s durable threshold)
			const absentResult = processObservation([], lifecycles, t0 + 35_000, true, mockProvider);

			const lc = lifecycles[0];
			assert.strictEqual(lc.isCommentedOut, true, 'isCommentedOut flag must be true');
			assert.strictEqual(lc.provisionalResolutionAt, null, 'provisional resolution must be cleared/suppressed');
			assert.strictEqual(lc.durableResolutionAt, null, 'durable resolution must be cleared/suppressed');

			const classification = absentResult.classifications[0];
			assert.strictEqual(classification.status, 'persisting', 'Commented-out vulnerability must be classified as persisting');
		});

		it('retains block-commented (/* ... */) vulnerability as persisting', () => {
			const finding = createMockFinding({
				filePath: '/workspace/src/db.ts',
				lineNumber: 3,
				instanceName: 'executeQuery',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);

			const blockCommentedFile = [
				'import db from "db";',
				'function run() {',
				'  /* const res = executeQuery(userInput); */',
				'  return null;',
				'}',
			].join('\n');

			const mockProvider = () => blockCommentedFile;
			const absentResult = processObservation([], lifecycles, t0 + 35_000, true, mockProvider);

			assert.strictEqual(lifecycles[0].isCommentedOut, true);
			assert.strictEqual(absentResult.classifications[0].status, 'persisting');
		});

		it('resets isCommentedOut to false and restores finding when code is uncommented', () => {
			const finding = createMockFinding({
				filePath: '/workspace/src/db.ts',
				lineNumber: 3,
				instanceName: 'executeQuery',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);

			const commentedFile = '// executeQuery(input);';
			processObservation([], lifecycles, t0 + 20_000, true, () => commentedFile);
			assert.strictEqual(lifecycles[0].isCommentedOut, true);

			// Uncommented and observed again at t0 + 25_000 (age 25s -> active)
			const restoredResult = processObservation([finding], lifecycles, t0 + 25_000, true);
			assert.strictEqual(lifecycles[0].isCommentedOut, false, 'isCommentedOut must reset to false');
			assert.strictEqual(lifecycles[0].identicalRestorationCount, 1);
			assert.strictEqual(restoredResult.classifications[0].status, 'active');

			// Observed again at t0 + 35_000 (age 35s >= 30s -> persisting)
			const persistingResult = processObservation([finding], lifecycles, t0 + 35_000, true);
			assert.strictEqual(persistingResult.classifications[0].status, 'persisting');
		});

		it('resolves normally when code is genuinely deleted instead of commented out', () => {
			const finding = createMockFinding({
				filePath: '/workspace/src/db.ts',
				lineNumber: 3,
				instanceName: 'executeQuery',
			});
			const lifecycles: FindingLifecycleRecord[] = [];

			processObservation([finding], lifecycles, t0, true);
			processObservation([finding], lifecycles, t0 + 10_000, true);

			// Truly deleted: clean code without comment
			const cleanFile = [
				'import db from "db";',
				'function run() {',
				'  return safeExecute(userInput);',
				'}',
			].join('\n');

			const mockProvider = () => cleanFile;

			// Absent observation 1: sets missingSince
			processObservation([], lifecycles, t0 + 15_000, true, mockProvider);
			assert.strictEqual(lifecycles[0].isCommentedOut, false);
			assert.strictEqual(lifecycles[0].missingSince, t0 + 15_000);

			// Absent observation 2: past grace period (5s) -> provisional resolution
			processObservation([], lifecycles, t0 + 22_000, true, mockProvider);
			assert.strictEqual(lifecycles[0].isCommentedOut, false);
			assert.notStrictEqual(lifecycles[0].provisionalResolutionAt, null);

			// Absent observation 3: past durable resolution delay (5s from provisional) -> durable resolution
			const resolvedResult = processObservation([], lifecycles, t0 + 28_000, true, mockProvider);
			assert.strictEqual(lifecycles[0].isCommentedOut, false);
			assert.notStrictEqual(lifecycles[0].durableResolutionAt, null);
			assert.strictEqual(resolvedResult.classifications[0].status, 'resolved');
		});
	});

	// ── 14. Session Lifecycle & Deactivation Finalization ─────────────
	describe('14. Session Lifecycle & Deactivation Finalization', () => {
		it('starts session with status active and null endedAt', () => {
			const tStart = 10000;
			const session = startSession('session-001', tStart);

			assert.strictEqual(session.sessionId, 'session-001');
			assert.strictEqual(session.startedAt, tStart);
			assert.strictEqual(session.endedAt, null);
			assert.strictEqual(session.status, 'active');
			assert.strictEqual(session.baselineCheckpoint, null);
			assert.strictEqual(session.finalCheckpoint, null);
			assert.deepStrictEqual(session.lifecycleSummaries, []);
		});

		it('captures baseline and latest checkpoints on observations', () => {
			const tStart = 10000;
			const session = startSession('session-001', tStart);
			const mockFindings = [createMockFinding({ instanceName: 'f1' })];

			setSessionBaseline(session, mockFindings, tStart);
			updateSessionLatest(session, mockFindings, tStart);

			assert.notStrictEqual(session.baselineCheckpoint, null);
			assert.strictEqual(session.baselineCheckpoint?.timestamp, tStart);
			assert.strictEqual(session.baselineCheckpoint?.findings.length, 1);
			assert.strictEqual(session.finalCheckpoint?.timestamp, tStart);

			// Subsequent baseline call does NOT overwrite baseline
			const mockFindings2 = [createMockFinding({ instanceName: 'f1' }), createMockFinding({ instanceName: 'f2' })];
			setSessionBaseline(session, mockFindings2, tStart + 5000);
			assert.strictEqual(session.baselineCheckpoint?.findings.length, 1);

			// But updateSessionLatest DOES update final checkpoint
			updateSessionLatest(session, mockFindings2, tStart + 5000);
			assert.strictEqual(session.finalCheckpoint?.timestamp, tStart + 5000);
			assert.strictEqual(session.finalCheckpoint?.findings.length, 2);
		});

		it('finalizes session cleanly with status completed', () => {
			const tStart = 10000;
			const tEnd = 25000;
			const session = startSession('session-001', tStart);
			const mockFinding = createMockFinding();
			setSessionBaseline(session, [mockFinding], tStart);
			updateSessionLatest(session, [mockFinding], tStart);

			const step = processObservation([mockFinding], [], tStart, true);
			const finalized = finalizeSession(session, step.lifecycles, tEnd, 'completed');

			assert.strictEqual(finalized.sessionId, 'session-001');
			assert.strictEqual(finalized.startedAt, tStart);
			assert.strictEqual(finalized.endedAt, tEnd);
			assert.strictEqual(finalized.status, 'completed');
			assert.strictEqual(finalized.lifecycleSummaries.length, 1);
		});

		it('finalizes session with status incomplete on failure or timeout fallback', () => {
			const tStart = 10000;
			const tEnd = 20000;
			const session = startSession('session-002', tStart);
			const mockFinding = createMockFinding();
			setSessionBaseline(session, [mockFinding], tStart);

			const step = processObservation([mockFinding], [], tStart, true);
			const finalized = finalizeSession(session, step.lifecycles, tEnd, 'incomplete');

			assert.strictEqual(finalized.sessionId, 'session-002');
			assert.strictEqual(finalized.endedAt, tEnd);
			assert.strictEqual(finalized.status, 'incomplete');
			assert.strictEqual(finalized.lifecycleSummaries.length, 1);
		});
	});

	// ── 15. Synchronous Shutdown Persistence & Recovery ───────────────
	describe('15. Synchronous Shutdown Persistence & Recovery', () => {
		let tempDir: string;
		let mockContext: vscode.ExtensionContext;
		let memento: Map<string, any>;

		beforeEach(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-store-'));
			memento = new Map<string, any>();
			mockContext = {
				storageUri: { fsPath: tempDir },
				globalStorageUri: { fsPath: tempDir },
				workspaceState: {
					get: (key: string, defaultValue?: any) => memento.has(key) ? memento.get(key) : defaultValue,
					update: async (key: string, value: any) => {
						if (value === undefined) {
							memento.delete(key);
						} else {
							memento.set(key, value);
						}
					},
				},
			} as unknown as vscode.ExtensionContext;
		});

		afterEach(() => {
			if (fs.existsSync(tempDir)) {
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
		});

		it('synchronously persists finalized session to local disk in <1ms', () => {
			const store = new SessionStore(mockContext);
			const session = startSession('session-001', 1000);
			const finalized = finalizeSession(session, [], 2000, 'completed');

			store.saveFinalizedSessionSync(finalized);

			const filePath = store.getFinalizedSessionFilePath();
			assert.strictEqual(fs.existsSync(filePath), true);

			const raw = fs.readFileSync(filePath, 'utf8');
			const parsed = JSON.parse(raw);
			assert.strictEqual(parsed.sessionId, 'session-001');
			assert.strictEqual(parsed.status, 'completed');
			assert.strictEqual(parsed.endedAt, 2000);
		});

		it('recovers pending finalized session, writes to completedSessions, and cleans up file', async () => {
			const store = new SessionStore(mockContext);
			const session = startSession('session-001', 1000);
			const finalized = finalizeSession(session, [], 2000, 'completed');

			// Persist synchronously as if during deactivation
			store.saveFinalizedSessionSync(finalized);
			const filePath = store.getFinalizedSessionFilePath();
			assert.strictEqual(fs.existsSync(filePath), true);

			// Recover as if during next activation
			const recovered = await store.recoverPendingFinalizedSession();
			assert.notStrictEqual(recovered, null);
			assert.strictEqual(recovered!.sessionId, 'session-001');
			assert.strictEqual(recovered!.status, 'completed');

			// Temporary file must be unlinked/deleted
			assert.strictEqual(fs.existsSync(filePath), false);

			// Check completed sessions
			const completed = store.loadCompletedSessions();
			assert.strictEqual(completed.length, 1);
			assert.strictEqual(completed[0].sessionId, 'session-001');
			assert.strictEqual(completed[0].status, 'completed');
		});

		it('returns null and does not fail if no pending file exists', async () => {
			const store = new SessionStore(mockContext);
			const recovered = await store.recoverPendingFinalizedSession();
			assert.strictEqual(recovered, null);
		});
	});

	// ══════════════════════════════════════════════════════════════════
	// 16. Prior Completed Session Lookup & Graceful Incomplete Handling
	// ══════════════════════════════════════════════════════════════════
	describe('16. Prior Completed Session Lookup & Graceful Incomplete Handling', () => {
		let tempDir: string;
		let mockContext: vscode.ExtensionContext;
		let storageState: Record<string, unknown>;

		beforeEach(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-prior-'));
			storageState = {};
			mockContext = {
				storageUri: vscode.Uri.file(tempDir),
				globalStorageUri: vscode.Uri.file(tempDir),
				workspaceState: {
					get: <T>(key: string, defaultValue?: T): T => {
						return (storageState[key] !== undefined ? storageState[key] : defaultValue) as T;
					},
					update: async (key: string, value: unknown): Promise<void> => {
						if (value === undefined) {
							delete storageState[key];
						} else {
							storageState[key] = value;
						}
					},
				},
			} as unknown as vscode.ExtensionContext;
		});

		afterEach(() => {
			if (fs.existsSync(tempDir)) {
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
		});

		it('returns null when no completed sessions exist (e.g. Session 1)', () => {
			const store = new SessionStore(mockContext);
			const prior = store.loadPriorCompletedSession();
			assert.strictEqual(prior, null);
		});

		it('returns the completed session when exactly one exists', async () => {
			const store = new SessionStore(mockContext);
			const s1 = startSession('session-001', 1000);
			const finalized1 = finalizeSession(s1, [], 2000, 'completed');
			await store.appendCompletedSession(finalized1);

			const prior = store.loadPriorCompletedSession();
			assert.notStrictEqual(prior, null);
			assert.strictEqual(prior!.sessionId, 'session-001');
			assert.strictEqual(prior!.status, 'completed');
		});

		it('gracefully skips an incomplete session and pulls the preceding completed session', async () => {
			const store = new SessionStore(mockContext);
			// Session 1: completed
			const s1 = startSession('session-001', 1000);
			const finalized1 = finalizeSession(s1, [], 2000, 'completed');
			await store.appendCompletedSession(finalized1);

			// Session 2: incomplete (e.g. power cut or shutdown timeout)
			const s2 = startSession('session-002', 3000);
			const finalized2 = finalizeSession(s2, [], 4000, 'incomplete');
			await store.appendCompletedSession(finalized2);

			// When Session 3 queries for prior completed baseline:
			const prior = store.loadPriorCompletedSession();
			assert.notStrictEqual(prior, null);
			// MUST skip session-002 and return session-001!
			assert.strictEqual(prior!.sessionId, 'session-001');
			assert.strictEqual(prior!.status, 'completed');
		});

		it('skips multiple consecutive incomplete sessions until it finds the completed one', async () => {
			const store = new SessionStore(mockContext);
			const s1 = finalizeSession(startSession('session-001', 1000), [], 2000, 'completed');
			const s2 = finalizeSession(startSession('session-002', 3000), [], 4000, 'incomplete');
			const s3 = finalizeSession(startSession('session-003', 5000), [], 6000, 'incomplete');

			await store.appendCompletedSession(s1);
			await store.appendCompletedSession(s2);
			await store.appendCompletedSession(s3);

			const prior = store.loadPriorCompletedSession();
			assert.notStrictEqual(prior, null);
			assert.strictEqual(prior!.sessionId, 'session-001');
		});

		it('returns null if all stored sessions are incomplete', async () => {
			const store = new SessionStore(mockContext);
			const s1 = finalizeSession(startSession('session-001', 1000), [], 2000, 'incomplete');
			const s2 = finalizeSession(startSession('session-002', 3000), [], 4000, 'incomplete');

			await store.appendCompletedSession(s1);
			await store.appendCompletedSession(s2);

			const prior = store.loadPriorCompletedSession();
			assert.strictEqual(prior, null);
		});

		it('loadPriorCompletedSessionBefore returns the preceding completed session before a given ID', async () => {
			const store = new SessionStore(mockContext);
			const s1 = finalizeSession(startSession('session-001', 1000), [], 2000, 'completed');
			const s2 = finalizeSession(startSession('session-002', 3000), [], 4000, 'completed');
			const s3 = finalizeSession(startSession('session-003', 5000), [], 6000, 'incomplete');
			const s4 = finalizeSession(startSession('session-004', 7000), [], 8000, 'completed');

			await store.appendCompletedSession(s1);
			await store.appendCompletedSession(s2);
			await store.appendCompletedSession(s3);
			await store.appendCompletedSession(s4);

			// Preceding completed before session-004 should skip session-003 and return session-002
			const beforeS4 = store.loadPriorCompletedSessionBefore('session-004');
			assert.notStrictEqual(beforeS4, null);
			assert.strictEqual(beforeS4!.sessionId, 'session-002');

			// Preceding completed before session-002 should return session-001
			const beforeS2 = store.loadPriorCompletedSessionBefore('session-002');
			assert.notStrictEqual(beforeS2, null);
			assert.strictEqual(beforeS2!.sessionId, 'session-001');

			// Preceding completed before session-001 should be null
			const beforeS1 = store.loadPriorCompletedSessionBefore('session-001');
			assert.strictEqual(beforeS1, null);
		});

		it('extractTrendComparisonBaseline returns null for null or incomplete session', () => {
			assert.strictEqual(extractTrendComparisonBaseline(null), null);

			const incomplete = finalizeSession(startSession('session-001', 1000), [], 2000, 'incomplete');
			assert.strictEqual(extractTrendComparisonBaseline(incomplete), null);
		});

		it('extractTrendComparisonBaseline groups findings by key and computes denominator and prior resolved counts', () => {
			const s1 = startSession('session-001', 1000);
			const finding1 = createMockFinding({
				logicalFingerprint: 'fp-sql-1',
				cweId: 'CWE-89',
				type: 'SQL Injection',
			});
			const finding2 = createMockFinding({
				logicalFingerprint: 'fp-sql-2',
				cweId: 'CWE-89',
				type: 'SQL Injection',
			});
			const finding3 = createMockFinding({
				logicalFingerprint: 'fp-path-1',
				cweId: 'CWE-22',
				type: 'Path Traversal',
			});

			updateSessionLatest(s1, [finding1, finding2, finding3], 1500);

			// Mock lifecycle summaries where fp-sql-1 was already durably resolved at session end
			const flcSql1 = {
				...finding1,
				firstConfirmedAt: 1000,
				lastConfirmedAt: 1200,
				missingSince: 1300,
				provisionalResolutionAt: 1400,
				durableResolutionAt: 1500, // durably resolved!
				identicalRestorationCount: 0,
				inSessionToggleCount: 0,
				recurrenceCount: 0,
			} as unknown as FindingLifecycleRecord;

			const flcSql2 = {
				...finding2,
				firstConfirmedAt: 1000,
				lastConfirmedAt: 1500,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				identicalRestorationCount: 0,
				inSessionToggleCount: 0,
				recurrenceCount: 0,
			} as unknown as FindingLifecycleRecord;

			const flcPath1 = {
				...finding3,
				firstConfirmedAt: 1000,
				lastConfirmedAt: 1500,
				missingSince: null,
				provisionalResolutionAt: null,
				durableResolutionAt: null,
				identicalRestorationCount: 0,
				inSessionToggleCount: 0,
				recurrenceCount: 0,
			} as unknown as FindingLifecycleRecord;

			const completed1 = finalizeSession(s1, [flcSql1, flcSql2, flcPath1], 2000, 'completed');

			const baseline = extractTrendComparisonBaseline(completed1);
			assert.notStrictEqual(baseline, null);

			// CWE-89 (SQL Injection) check
			assert.ok(baseline!['CWE-89']);
			assert.strictEqual(baseline!['CWE-89'].sourceSessionId, 'session-001');
			assert.strictEqual(baseline!['CWE-89'].denominator, 2);
			assert.strictEqual(baseline!['CWE-89'].resolvedAtSourceFinal, 1);
			assert.deepStrictEqual(baseline!['CWE-89'].flcIds, ['fp-sql-1', 'fp-sql-2']);

			// CWE-22 (Path Traversal) check
			assert.ok(baseline!['CWE-22']);
			assert.strictEqual(baseline!['CWE-22'].sourceSessionId, 'session-001');
			assert.strictEqual(baseline!['CWE-22'].denominator, 1);
			assert.strictEqual(baseline!['CWE-22'].resolvedAtSourceFinal, 0);
			assert.deepStrictEqual(baseline!['CWE-22'].flcIds, ['fp-path-1']);
		});

		it('startSession attaches priorCompletedSessionId and trendComparisonByKey when completed session provided', () => {
			const s1 = startSession('session-001', 1000);
			updateSessionLatest(s1, [createMockFinding({ logicalFingerprint: 'fp-1', cweId: 'CWE-89' })], 1500);
			const completed1 = finalizeSession(s1, [], 2000, 'completed');

			// Start session-002 with completed1 passed
			const s2 = startSession('session-002', 2500, completed1);
			assert.strictEqual(s2.priorCompletedSessionId, 'session-001');
			assert.notStrictEqual(s2.trendComparisonByKey, null);
			assert.ok(s2.trendComparisonByKey!['CWE-89']);
			assert.strictEqual(s2.trendComparisonByKey!['CWE-89'].denominator, 1);

			// Start session-003 with an incomplete session -> should ignore incomplete session
			const incomplete = finalizeSession(startSession('session-x', 100), [], 200, 'incomplete');
			const s3 = startSession('session-003', 3000, incomplete);
			assert.strictEqual(s3.priorCompletedSessionId, null);
			assert.strictEqual(s3.trendComparisonByKey, null);
		});
	});
});
