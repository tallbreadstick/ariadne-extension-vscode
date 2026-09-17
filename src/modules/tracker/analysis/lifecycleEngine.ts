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
	FindingLifecycleState,
	InternalFindingState,
	ObservedFinding,
	SessionRecord,
	SessionCheckpoint,
	LifecyclePolicy,
	TrendComparisonBaseline,
} from './lifecycleTypes.js';

import { LIFECYCLE_POLICY } from './lifecycleTypes.js';
import { isCodeCommentedOut } from './commentDetector.js';
import { computeCategoryScores, computeTrendScore } from './scoreCalculator.js';

/**
 * Provider function that returns file content by path.
 * In the extension, this checks open VS Code documents then disk.
 * In unit tests, this can provide mock file strings.
 */
export type FileContentProvider = (filePath: string) => string | undefined;

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
	isSettledOrPolicy: boolean | LifecyclePolicy = true,
	maybePolicyOrProvider?: LifecyclePolicy | FileContentProvider,
	maybeProvider?: FileContentProvider,
): ObservationResult {
	let isSettled = true;
	let policy: LifecyclePolicy = LIFECYCLE_POLICY;
	let fileContentProvider: FileContentProvider | undefined;

	if (typeof isSettledOrPolicy === 'boolean') {
		isSettled = isSettledOrPolicy;
		if (typeof maybePolicyOrProvider === 'object' && maybePolicyOrProvider !== null) {
			policy = maybePolicyOrProvider;
			fileContentProvider = maybeProvider;
		} else if (typeof maybePolicyOrProvider === 'function') {
			fileContentProvider = maybePolicyOrProvider;
		}
	} else if (typeof isSettledOrPolicy === 'object' && isSettledOrPolicy !== null) {
		policy = isSettledOrPolicy;
		if (typeof maybePolicyOrProvider === 'function') {
			fileContentProvider = maybePolicyOrProvider;
		}
	}

	// Index observed findings by logical fingerprint for O(1) lookup
	const observedMap = new Map<string, ObservedFinding>();
	for (const f of observedFindings) {
		observedMap.set(f.logicalFingerprint, f);
	}

	// Track which lifecycles were matched to avoid duplicates
	const matchedFingerprints = new Set<string>();
	const restoredFingerprints = new Set<string>();
	const newlyCreatedFingerprints = new Set<string>();
	const newlyAbsentFingerprints = new Set<string>();

	// Record previous state of existing lifecycles before mutation
	const previousStateByFingerprint = new Map<string, FindingLifecycleState | undefined>();
	const wasMissingMap = new Map<string, boolean>();
	for (const lifecycle of existingLifecycles) {
		previousStateByFingerprint.set(lifecycle.logicalFingerprint, lifecycle.lifecycleState);
		wasMissingMap.set(lifecycle.logicalFingerprint, lifecycle.missingSince !== null);
	}

	// ── Update existing lifecycles ──────────────────────────────────
	for (const lifecycle of existingLifecycles) {
		const observed = observedMap.get(lifecycle.logicalFingerprint);

		if (observed) {
			matchedFingerprints.add(lifecycle.logicalFingerprint);
			const isRestored = updateActiveLifecycle(lifecycle, observed, timestamp, isSettled);
			if (isRestored) {
				restoredFingerprints.add(lifecycle.logicalFingerprint);
			}
		} else {
			const wasMissing = wasMissingMap.get(lifecycle.logicalFingerprint) ?? false;
			updateAbsentLifecycle(lifecycle, timestamp, policy, isSettled, fileContentProvider);
			if (isSettled && !wasMissing && lifecycle.missingSince !== null && lifecycle.durableResolutionAt === null) {
				newlyAbsentFingerprints.add(lifecycle.logicalFingerprint);
			}
		}
	}

	// ── Create new lifecycles for unmatched findings ────────────────
	for (const [fp, finding] of observedMap) {
		if (!matchedFingerprints.has(fp)) {
			existingLifecycles.push(createLifecycleRecord(finding, timestamp));
			newlyCreatedFingerprints.add(fp);
		}
	}

	// ── Classify all lifecycles ─────────────────────────────────────
	const classifications = existingLifecycles.map((lifecycle) =>
		classifyLifecycle(
			lifecycle,
			timestamp,
			policy,
			restoredFingerprints.has(lifecycle.logicalFingerprint),
			previousStateByFingerprint.get(lifecycle.logicalFingerprint),
			newlyCreatedFingerprints.has(lifecycle.logicalFingerprint),
			newlyAbsentFingerprints.has(lifecycle.logicalFingerprint),
		),
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
	isSettled: boolean,
): boolean {
	const previousCount = lifecycle.currentOccurrenceCount;
	const wasCommentedOut = lifecycle.isCommentedOut;

	// Update live occurrence and path
	lifecycle.currentOccurrenceCount = observed.occurrenceCount;
	lifecycle.filePath = observed.filePath;
	if (typeof observed.lineNumber === 'number') {
		lifecycle.lastLineNumber = observed.lineNumber;
	}
	if (typeof observed.endLine === 'number') {
		lifecycle.lastEndLine = observed.endLine;
	}

	// Live scan (unsettled) updates presence for UI, but does not commit confirmations or state transitions
	if (!isSettled) {
		if (observed.contentFingerprint) {
			lifecycle.contentFingerprint = observed.contentFingerprint;
		}
		if (observed.scopeFingerprint) {
			lifecycle.scopeFingerprint = observed.scopeFingerprint;
		}
		return false;
	}

	let isRestored = false;

	// ── Recurrence after durable resolution ─────────────────────
	if (lifecycle.durableResolutionAt !== null) {
		isRestored = checkIdenticalRestoration(lifecycle, observed);
		lifecycle.recurrenceCount += 1;
		lifecycle.lastRecurredAt = timestamp;
		lifecycle.durableResolutionAt = null;
		lifecycle.provisionalResolutionAt = null;
		lifecycle.missingSince = null;
		lifecycle.isCommentedOut = false;
		lifecycle.baselineOccurrenceCount = observed.occurrenceCount;
		// Reset confirmations so the finding must re-prove persistence
		lifecycle.confirmationCount = 0;
		console.log(
			`[Ariadne Lifecycle] Recurrence #${lifecycle.recurrenceCount} ` +
			`for ${lifecycle.type} (${lifecycle.logicalFingerprint.slice(0, 16)})`,
		);
	} else if (lifecycle.missingSince !== null || lifecycle.provisionalResolutionAt !== null || wasCommentedOut) {
		// ── Reappearance after absence / provisional resolution / commented out ─────
		isRestored = checkIdenticalRestoration(lifecycle, observed);
		lifecycle.missingSince = null;
		lifecycle.provisionalResolutionAt = null;
		lifecycle.isCommentedOut = false;
	} else {
		lifecycle.isCommentedOut = false;
	}

	// Update content/scope fingerprints to latest observation after restoration check
	if (observed.contentFingerprint) {
		lifecycle.contentFingerprint = observed.contentFingerprint;
	}
	if (observed.scopeFingerprint) {
		lifecycle.scopeFingerprint = observed.scopeFingerprint;
	}

	// ── Settled confirmation update ─────────────────────────────
	lifecycle.confirmationCount += 1;
	lifecycle.lastConfirmedAt = timestamp;
	lifecycle.missingSince = null;

	// Track previous count for delta reporting
	// (stored transiently — the classification step reads it from the lifecycle)
	void previousCount;

	return isRestored;
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
	isSettled: boolean,
	fileContentProvider?: FileContentProvider,
): void {
	// Already durably resolved — nothing to do
	if (lifecycle.durableResolutionAt !== null) {
		return;
	}

	// Unsettled observations (live typing) do not advance absence or resolution
	if (!isSettled) {
		return;
	}

	// Check if the finding's code is commented out in the source file
	if (fileContentProvider && lifecycle.filePath) {
		const content = fileContentProvider(lifecycle.filePath);
		if (content) {
			const commentedOut = isCodeCommentedOut(
				content,
				lifecycle.lastLineNumber,
				lifecycle.instanceName,
				lifecycle.lastEndLine,
			);
			if (commentedOut) {
				lifecycle.isCommentedOut = true;
				if (lifecycle.missingSince === null) {
					lifecycle.missingSince = timestamp;
				}
				// Commented-out code MUST NOT transition to provisional or durable resolution!
				lifecycle.provisionalResolutionAt = null;
				lifecycle.durableResolutionAt = null;
				console.log(
					`[Ariadne Lifecycle] Vulnerability commented out (withheld from resolution): ` +
					`${lifecycle.type} (${lifecycle.instanceName || lifecycle.logicalFingerprint.slice(0, 16)})`,
				);
				return;
			}
		}
	}

	lifecycle.isCommentedOut = false;

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
): boolean {
	// Content/scope fingerprints are required to determine identical restoration.
	if (!lifecycle.contentFingerprint || !observed.contentFingerprint) {
		return false;
	}
	if (!lifecycle.scopeFingerprint || !observed.scopeFingerprint) {
		return false;
	}

	const contentMatch = lifecycle.contentFingerprint === observed.contentFingerprint;
	const scopeMatch = lifecycle.scopeFingerprint === observed.scopeFingerprint;

	if (contentMatch && scopeMatch) {
		lifecycle.identicalRestorationCount = (lifecycle.identicalRestorationCount ?? 0) + 1;
		lifecycle.inSessionToggleCount = (lifecycle.inSessionToggleCount ?? 0) + 1;
		console.log(
			`[Ariadne Lifecycle] Identical restoration detected: ` +
			`${lifecycle.type} (toggle #${lifecycle.inSessionToggleCount})`,
		);
		return true;
	}

	return false;
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
		confirmationCount: 0,
		recurrenceCount: 0,
		inSessionToggleCount: 0,
		identicalRestorationCount: 0,
		lastRecurredAt: null,
		lastLineNumber: finding.lineNumber,
		lastEndLine: finding.endLine,
		isCommentedOut: false,
		lifecycleState: 'candidate',
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
 * 5. Active     — active AND confirmed by at least 1 settled scan
 * 6. Candidate  — not yet eligible (internal only)
 */
function classifyLifecycle(
	lifecycle: FindingLifecycleRecord,
	timestamp: number,
	policy: LifecyclePolicy,
	isIdenticalRestoration: boolean = false,
	previousState?: FindingLifecycleState,
	isNewCandidate: boolean = false,
	isAbsentCandidate: boolean = false,
): FindingClassification {
	const status = classifyFinding(lifecycle, timestamp, policy);
	const isNewPersisting = status === 'persisting' && previousState !== 'persisting';
	lifecycle.lifecycleState = status;

	return {
		lifecycle,
		status,
		previousOccurrenceCount: lifecycle.baselineOccurrenceCount,
		currentOccurrenceCount: lifecycle.currentOccurrenceCount,
		previousState,
		...(isIdenticalRestoration ? { isIdenticalRestoration: true } : {}),
		...(isNewCandidate ? { isNewCandidate: true } : {}),
		...(isAbsentCandidate ? { isAbsentCandidate: true } : {}),
		...(isNewPersisting ? { isNewPersisting: true } : {}),
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
	// 0. Commented-out finding: withheld from 'resolved' and treated as 'persisting' (Option 1)
	if (lifecycle.isCommentedOut) {
		return 'persisting';
	}

	const isCurrentlyActive = lifecycle.missingSince === null
		&& lifecycle.durableResolutionAt === null;
	const observedAge = timestamp - lifecycle.firstConfirmedAt;
	const meetsThresholds = observedAge >= policy.MINIMUM_DURATION_MS
		&& lifecycle.confirmationCount >= policy.MINIMUM_SETTLED_CONFIRMATIONS;

	// 1. Recurring: previously resolved, now active, met recurrence threshold.
	//    Thresholds are measured from lastRecurredAt (not firstConfirmedAt)
	//    so the finding must re-prove persistence after each recurrence.
	//    Once it re-establishes itself, it graduates to 'persisting'.
	if (
		isCurrentlyActive
		&& lifecycle.recurrenceCount >= policy.RECURRENCE_THRESHOLD
	) {
		const ageSinceRecurrence = lifecycle.lastRecurredAt !== null
			? timestamp - lifecycle.lastRecurredAt
			: observedAge;
		const reestablished = ageSinceRecurrence >= policy.MINIMUM_DURATION_MS
			&& lifecycle.confirmationCount >= policy.MINIMUM_SETTLED_CONFIRMATIONS;
		return reestablished ? 'persisting' : 'recurring';
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

	// 5. Active: confirmed by at least 1 settled scan, currently active
	if (isCurrentlyActive && lifecycle.confirmationCount >= 1) {
		return 'active';
	}

	// 6. Candidate: not yet confirmed by a settled scan (newly observed or unsettled)
	return 'candidate';
}

// ══════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════

/**
 * Extracts the frozen Trend comparison baseline from a prior completed session.
 *
 * For each vulnerability type/key observed in the prior session, captures:
 * - `sourceSessionId`: The prior completed session ID
 * - `flcIds`: The set C of logical fingerprints known at the prior session's end
 * - `denominator`: Total count |C|
 * - `resolvedAtSourceFinal`: How many were already resolved at the prior session's end
 *
 * Gracefully returns null if the prior session is null, incomplete, or has no findings.
 *
 * Reference: Section 5 & 6 — Consolidated Implementation Decision Summary
 */
export function extractTrendComparisonBaseline(
	priorSession: SessionRecord | null,
): Record<string, TrendComparisonBaseline> | null {
	if (!priorSession || priorSession.status !== 'completed') {
		return null;
	}

	const summaries = priorSession.lifecycleSummaries ?? [];
	const finalFindings = priorSession.finalCheckpoint?.findings ?? [];

	// If no summaries and no final checkpoint findings exist, baseline is empty/null
	if (summaries.length === 0 && finalFindings.length === 0) {
		return null;
	}

	const result: Record<string, TrendComparisonBaseline> = {};

	// Helper to resolve a group key (prefers cweId, fallback to type)
	const getGroupKey = (item: { cweId?: string; type?: string }) =>
		item.cweId && item.cweId.length > 0 ? item.cweId : (item.type ?? 'Unknown');

	if (summaries.length > 0) {
		// Group by vulnerability key from lifecycleSummaries
		for (const flc of summaries) {
			const key = getGroupKey(flc);
			if (!result[key]) {
				result[key] = {
					sourceSessionId: priorSession.sessionId,
					flcIds: [],
					denominator: 0,
					resolvedAtSourceFinal: 0,
				};
			}
			const entry = result[key];
			if (!entry.flcIds.includes(flc.logicalFingerprint)) {
				entry.flcIds.push(flc.logicalFingerprint);
				entry.denominator += 1;
				if (flc.durableResolutionAt !== null) {
					entry.resolvedAtSourceFinal += 1;
				}
			}
		}
	} else {
		// Fallback: group from finalCheckpoint.findings
		for (const finding of finalFindings) {
			const key = getGroupKey(finding);
			if (!result[key]) {
				result[key] = {
					sourceSessionId: priorSession.sessionId,
					flcIds: [],
					denominator: 0,
					resolvedAtSourceFinal: 0,
				};
			}
			const entry = result[key];
			if (!entry.flcIds.includes(finding.logicalFingerprint)) {
				entry.flcIds.push(finding.logicalFingerprint);
				entry.denominator += 1;
			}
		}
	}

	return Object.keys(result).length > 0 ? result : null;
}

/**
 * Creates a new observation session record.
 *
 * If a prior completed session is provided, extracts and freezes
 * its Trend comparison baseline (cohort C) for the lifetime of this session.
 * Incomplete sessions are ignored and treated as null.
 */
export function startSession(
	sessionId: string,
	timestamp: number,
	priorCompletedSession?: SessionRecord | null,
): SessionRecord {
	const isCompleted = priorCompletedSession?.status === 'completed';
	const trendComparisonByKey = isCompleted
		? extractTrendComparisonBaseline(priorCompletedSession)
		: null;

	return {
		sessionId,
		startedAt: timestamp,
		endedAt: null,
		status: 'active',
		baselineCheckpoint: null,
		finalCheckpoint: null,
		lifecycleSummaries: [],
		priorCompletedSessionId: isCompleted ? priorCompletedSession.sessionId : null,
		trendComparisonByKey,
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
 * Finalizes an active session by capturing lifecycle summaries,
 * recording completion status ('completed' or 'incomplete'),
 * and setting the end timestamp.
 */
export function finalizeSession(
	session: SessionRecord,
	lifecycles: FindingLifecycleRecord[],
	timestamp: number,
	status: 'completed' | 'incomplete' = 'completed',
): SessionRecord {
	// Compute F/P/T scores only for completed sessions
	let finalScores: SessionRecord['finalScores'];
	if (status === 'completed' && lifecycles.length > 0) {
		const categoryResult = computeCategoryScores(lifecycles);
		const trendResult = computeTrendScore(lifecycles, session.trendComparisonByKey);
		finalScores = {
			f: categoryResult.aggregate.f,
			p: categoryResult.aggregate.p,
			t: trendResult?.workspaceT ?? null,
		};
		console.log(
			`[Ariadne Lifecycle] Session ${session.sessionId} finalized with scores: ` +
			`F=${finalScores.f.toFixed(2)} P=${finalScores.p.toFixed(2)} ` +
			`T=${finalScores.t !== null ? finalScores.t.toFixed(2) : 'N/A'}`,
		);
	}

	return {
		...session,
		endedAt: timestamp,
		status,
		lifecycleSummaries: lifecycles.map(lc => ({ ...lc })),
		finalScores,
	};
}
