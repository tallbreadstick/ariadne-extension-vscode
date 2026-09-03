/**
 * Lifecycle Engine for the Ariadne trends framework.
 *
 * Processes settled observations to maintain FindingLifecycleRecord[]
 * and classify each finding into one of the four public statuses:
 * Persisting, Improving, Resolved, Recurring.
 *
 * This module is the core state machine for the trends framework.
 * It replaces the old snapshot-diffing logic in snapshotAnalyzer.ts.
 *
 * No `vscode` import — pure business logic, fully testable.
 *
 * Reference: ABEL-ariadne-trends-framework-finalization.md, Sections 7–11
 */

import type {
	FindingLifecycleRecord,
	FindingClassification,
	InternalFindingState,
	ObservedFinding,
	SessionRecord,
	SessionCheckpoint,
	LifecyclePolicy,
} from './lifecycleTypes.js';

import { LIFECYCLE_POLICY } from './lifecycleTypes.js';

// ══════════════════════════════════════════════════════════════════════
// OBSERVATION PROCESSING
// ══════════════════════════════════════════════════════════════════════

/**
 * Result of processing a settled observation.
 */
export interface ObservationResult {
	/** Updated lifecycle records (existing + newly created). */
	lifecycles: FindingLifecycleRecord[];

	/** Per-finding classification for the presentation layer. */
	classifications: FindingClassification[];
}

/**
 * Processes a settled observation against existing lifecycle records.
 *
 * For each observed finding:
 * - If it matches an existing lifecycle → update confirmation, counts, reappearance
 * - If no match → create a new lifecycle record (candidate state)
 *
 * For each existing lifecycle NOT in the observation:
 * - Track absence → provisional resolution → durable resolution
 *
 * @param observedFindings - Findings from the current settled observation
 * @param existingLifecycles - Current lifecycle records (mutated in place for efficiency)
 * @param timestamp - Epoch ms of the observation
 * @param policy - Lifecycle policy constants
 */
export function processObservation(
	observedFindings: ObservedFinding[],
	existingLifecycles: FindingLifecycleRecord[],
	timestamp: number,
	policy: LifecyclePolicy = LIFECYCLE_POLICY,
): ObservationResult {

	// Index observed findings by logical fingerprint for O(1) lookup
	const observedMap = new Map<string, ObservedFinding>();
	for (const f of observedFindings) {
		observedMap.set(f.logicalFingerprint, f);
	}

	// Track which lifecycles were matched to avoid duplicates
	const matchedFingerprints = new Set<string>();

	// ── Update existing lifecycles ──────────────────────────────────
	for (const lifecycle of existingLifecycles) {
		const observed = observedMap.get(lifecycle.logicalFingerprint);

		if (observed) {
			matchedFingerprints.add(lifecycle.logicalFingerprint);
			updateActiveLifecycle(lifecycle, observed, timestamp);
		} else {
			updateAbsentLifecycle(lifecycle, timestamp, policy);
		}
	}

	// ── Create new lifecycles for unmatched findings ────────────────
	for (const [fp, finding] of observedMap) {
		if (!matchedFingerprints.has(fp)) {
			existingLifecycles.push(createLifecycleRecord(finding, timestamp));
		}
	}

	// ── Classify all lifecycles ─────────────────────────────────────
	const classifications = existingLifecycles.map((lifecycle) =>
		classifyLifecycle(lifecycle, timestamp, policy),
	);

	return { lifecycles: existingLifecycles, classifications };
}

// ══════════════════════════════════════════════════════════════════════
// LIFECYCLE STATE UPDATES
// ══════════════════════════════════════════════════════════════════════

/**
 * Updates a lifecycle record for a finding that IS present in the
 * current observation.
 *
 * Handles: confirmation, reappearance after provisional resolution,
 * recurrence after durable resolution, and identical-restoration.
 */
function updateActiveLifecycle(
	lifecycle: FindingLifecycleRecord,
	observed: ObservedFinding,
	timestamp: number,
): void {
	const previousCount = lifecycle.currentOccurrenceCount;

	// ── Reappearance after provisional resolution ───────────────
	if (lifecycle.provisionalResolutionAt !== null && lifecycle.durableResolutionAt === null) {
		// Finding came back before durable resolution was confirmed
		checkIdenticalRestoration(lifecycle, observed);
		lifecycle.provisionalResolutionAt = null;
	}

	// ── Recurrence after durable resolution ─────────────────────
	if (lifecycle.durableResolutionAt !== null) {
		lifecycle.recurrenceCount += 1;
		// Reset resolution state — finding is active again
		lifecycle.durableResolutionAt = null;
		lifecycle.provisionalResolutionAt = null;
		// Start a new baseline for this recurrence cycle
		lifecycle.baselineOccurrenceCount = observed.occurrenceCount;
		console.log(
			`[Ariadne Lifecycle] Recurrence #${lifecycle.recurrenceCount} ` +
			`for ${lifecycle.type} (${lifecycle.logicalFingerprint.slice(0, 16)})`,
		);
	}

	// ── Standard confirmation update ────────────────────────────
	lifecycle.confirmationCount += 1;
	lifecycle.lastConfirmedAt = timestamp;
	lifecycle.currentOccurrenceCount = observed.occurrenceCount;
	lifecycle.missingSince = null;
	lifecycle.filePath = observed.filePath;

	// Update content/scope fingerprints if the scanner provides them
	if (observed.contentFingerprint) {
		lifecycle.contentFingerprint = observed.contentFingerprint;
	}
	if (observed.scopeFingerprint) {
		lifecycle.scopeFingerprint = observed.scopeFingerprint;
	}

	// Track previous count for delta reporting
	// (stored transiently — the classification step reads it from the lifecycle)
	void previousCount;
}

/**
 * Updates a lifecycle record for a finding that is ABSENT from the
 * current observation.
 *
 * Progression: active → missingSince → provisional → durable resolution.
 *
 * Section 8.2: absence grace period prevents a temporary deletion
 * from becoming a claimed remediation event.
 */
function updateAbsentLifecycle(
	lifecycle: FindingLifecycleRecord,
	timestamp: number,
	policy: LifecyclePolicy,
): void {
	// Already durably resolved — nothing to do
	if (lifecycle.durableResolutionAt !== null) {
		return;
	}

	// First observation of absence
	if (lifecycle.missingSince === null) {
		lifecycle.missingSince = timestamp;
		return;
	}

	const absenceDuration = timestamp - lifecycle.missingSince;

	// Within grace period — wait for more observations
	if (absenceDuration < policy.ABSENCE_GRACE_PERIOD_MS) {
		return;
	}

	// Grace period exceeded — mark provisional resolution
	if (lifecycle.provisionalResolutionAt === null) {
		lifecycle.provisionalResolutionAt = timestamp;
		lifecycle.currentOccurrenceCount = 0;
		console.log(
			`[Ariadne Lifecycle] Provisional resolution: ` +
			`${lifecycle.type} (${lifecycle.logicalFingerprint.slice(0, 16)})`,
		);
		return;
	}

	// Already provisionally resolved — later observation still absent → durable
	lifecycle.durableResolutionAt = timestamp;
	console.log(
		`[Ariadne Lifecycle] Durable resolution confirmed: ` +
		`${lifecycle.type} (${lifecycle.logicalFingerprint.slice(0, 16)})`,
	);
}

/**
 * Checks whether a reappearance after absence is an identical restoration
 * (same content + scope fingerprints) or a genuine modification.
 *
 * Section 11.2–11.4: identical restoration invalidates provisional fixes
 * and increments the toggle counter.
 */
function checkIdenticalRestoration(
	lifecycle: FindingLifecycleRecord,
	observed: ObservedFinding,
): void {
	// Content/scope fingerprints are empty until the scanner provides them.
	// When empty, we cannot determine identical restoration — skip.
	if (!lifecycle.contentFingerprint || !observed.contentFingerprint) {
		return;
	}

	const contentMatch = lifecycle.contentFingerprint === observed.contentFingerprint;
	const scopeMatch = lifecycle.scopeFingerprint === observed.scopeFingerprint;

	if (contentMatch && scopeMatch) {
		lifecycle.identicalRestorationCount += 1;
		lifecycle.inSessionToggleCount += 1;
		console.log(
			`[Ariadne Lifecycle] Identical restoration detected: ` +
			`${lifecycle.type} (toggle #${lifecycle.inSessionToggleCount})`,
		);
	}
}

// ══════════════════════════════════════════════════════════════════════
// LIFECYCLE CREATION
// ══════════════════════════════════════════════════════════════════════

/** Creates a new lifecycle record for a newly observed finding. */
function createLifecycleRecord(
	finding: ObservedFinding,
	timestamp: number,
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
		firstConfirmedAt: timestamp,
		lastConfirmedAt: timestamp,
		missingSince: null,
		provisionalResolutionAt: null,
		durableResolutionAt: null,
		baselineOccurrenceCount: finding.occurrenceCount,
		currentOccurrenceCount: finding.occurrenceCount,
		confirmationCount: 1,
		recurrenceCount: 0,
		inSessionToggleCount: 0,
		identicalRestorationCount: 0,
	};
}

// ══════════════════════════════════════════════════════════════════════
// CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════

/**
 * Classifies a single lifecycle record into its public status.
 *
 * Priority order (Section 7.3):
 * 1. Recurring — recurrenceCount >= threshold AND currently active
 * 2. Resolved  — durably resolved AND NOT currently active
 * 3. Improving — active AND occurrence count < baseline
 * 4. Persisting — active AND met duration/confirmation thresholds
 * 5. Candidate — not yet eligible (internal only)
 */
function classifyLifecycle(
	lifecycle: FindingLifecycleRecord,
	timestamp: number,
	policy: LifecyclePolicy,
): FindingClassification {
	const status = classifyFinding(lifecycle, timestamp, policy);

	return {
		lifecycle,
		status,
		previousOccurrenceCount: lifecycle.baselineOccurrenceCount,
		currentOccurrenceCount: lifecycle.currentOccurrenceCount,
	};
}

/**
 * Determines the internal state of a finding from its lifecycle record.
 */
export function classifyFinding(
	lifecycle: FindingLifecycleRecord,
	timestamp: number,
	policy: LifecyclePolicy = LIFECYCLE_POLICY,
): InternalFindingState {
	const isCurrentlyActive = lifecycle.missingSince === null
		&& lifecycle.durableResolutionAt === null;
	const observedAge = timestamp - lifecycle.firstConfirmedAt;
	const meetsThresholds = observedAge >= policy.MINIMUM_DURATION_MS
		&& lifecycle.confirmationCount >= policy.MINIMUM_SETTLED_CONFIRMATIONS;

	// 1. Recurring: previously resolved, now active, met recurrence threshold
	if (
		isCurrentlyActive
		&& lifecycle.recurrenceCount >= policy.RECURRENCE_THRESHOLD
	) {
		return 'recurring';
	}

	// 2. Resolved: durably resolved and NOT currently active
	if (lifecycle.durableResolutionAt !== null && !isCurrentlyActive) {
		return 'resolved';
	}

	// 3. Improving: active, occurrence count decreased from baseline
	if (
		isCurrentlyActive
		&& lifecycle.currentOccurrenceCount < lifecycle.baselineOccurrenceCount
	) {
		return 'improving';
	}

	// 4. Persisting: active, met minimum duration and confirmation thresholds
	if (isCurrentlyActive && meetsThresholds) {
		return 'persisting';
	}

	// 5. Candidate: not yet eligible for public classification
	return 'candidate';
}

// ══════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════════════

/**
 * Creates a new observation session record.
 */
export function startSession(sessionId: string, timestamp: number): SessionRecord {
	return {
		sessionId,
		startedAt: timestamp,
		endedAt: null,
		baselineCheckpoint: null,
		finalCheckpoint: null,
		lifecycleSummaries: [],
	};
}

/**
 * Sets the baseline checkpoint for a session from the first
 * settled observation's findings.
 *
 * Should be called once when the first settled observation arrives
 * in a session (i.e. when `baselineCheckpoint` is null).
 */
export function setSessionBaseline(
	session: SessionRecord,
	observedFindings: ObservedFinding[],
	timestamp: number,
): void {
	if (session.baselineCheckpoint !== null) {
		return;
	}
	session.baselineCheckpoint = {
		timestamp,
		findings: observedFindings.map(f => ({ ...f })),
	};
}

/**
 * Updates the session's latest observation snapshot.
 * Called after every settled observation so the final checkpoint
 * always reflects the most recent state.
 */
export function updateSessionLatest(
	session: SessionRecord,
	observedFindings: ObservedFinding[],
	timestamp: number,
): void {
	session.finalCheckpoint = {
		timestamp,
		findings: observedFindings.map(f => ({ ...f })),
	};
}

/**
 * Finalizes an active session by capturing lifecycle summaries
 * and setting the end timestamp.
 */
export function finalizeSession(
	session: SessionRecord,
	lifecycles: FindingLifecycleRecord[],
	timestamp: number,
): SessionRecord {
	return {
		...session,
		endedAt: timestamp,
		lifecycleSummaries: lifecycles.map(lc => ({ ...lc })),
	};
}
