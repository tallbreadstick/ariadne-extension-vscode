/**
 * Type definitions for the Ariadne lifecycle-based trends framework.
 *
 * Replaces raw ScanSnapshot[] storage with finding-instance lifecycle
 * records that track confirmation, absence, resolution, and recurrence
 * across observation sessions.
 *
 * These types are consumed by:
 *
 * - `lifecycleEngine.ts`  — core state-machine logic
 * - `sessionStore.ts`     — persistence to workspaceState
 * - `snapshotAnalyzer.ts` — adapter to SessionMetrics presentation shape
 *
 * Reference: ABEL-ariadne-trends-framework-finalization.md, Sections 3–7
 */

// ══════════════════════════════════════════════════════════════════════
// POLICY CONSTANTS
// ══════════════════════════════════════════════════════════════════════

/**
 * Hardcoded policy defaults for lifecycle classification.
 *
 * These values are initial proposals from the framework document
 * (Section 5.2) and are subject to tuning from observed data.
 */
export const LIFECYCLE_POLICY = {
	/** Minimum observed age (ms) before a finding is eligible for Persisting. */
	MINIMUM_DURATION_MS: 30_000,

	/** Minimum settled confirmations before a finding is eligible for Persisting. */
	MINIMUM_SETTLED_CONFIRMATIONS: 2,

	/**
	 * Grace period (ms) before a missing finding enters provisional resolution.
	 * Prevents a temporary deletion/comment-out from becoming a claimed remediation.
	 */
	ABSENCE_GRACE_PERIOD_MS: 5_000,

	/**
	 * Number of durable-resolved → active reappearances required before
	 * showing "Recurring Pattern" in the public Trends card.
	 */
	RECURRENCE_THRESHOLD: 2,
} as const;

export type LifecyclePolicy = typeof LIFECYCLE_POLICY;

// ══════════════════════════════════════════════════════════════════════
// FINDING STATUS
// ══════════════════════════════════════════════════════════════════════

/**
 * Public finding classifications shown on the Trends card.
 *
 * Priority order (Section 7.3): recurring > resolved > improving > persisting
 */
export type FindingStatus = 'recurring' | 'resolved' | 'improving' | 'persisting';

/**
 * Internal state that includes `candidate` — findings that have not yet
 * met the minimum duration/confirmation thresholds. Candidates are
 * omitted from the public Trends card (Section 7.1).
 */
export type InternalFindingState = 'candidate' | FindingStatus;

// ══════════════════════════════════════════════════════════════════════
// FINDING LIFECYCLE RECORD
// ══════════════════════════════════════════════════════════════════════

/**
 * Per-finding lifecycle record persisted across scans and sessions.
 *
 * Tracks a single finding instance identified by its logical fingerprint.
 * Each record captures the full lifecycle: first appearance, confirmations,
 * absence, provisional/durable resolution, recurrence, and toggle detection.
 *
 * Reference: Section 6.2 — FindingLifecycleRecord
 */
export interface FindingLifecycleRecord {
	/**
	 * Stable identity for matching the same logical finding through
	 * line movement and minor edits. From scanner SHA256 or derived fallback.
	 */
	logicalFingerprint: string;

	/**
	 * Detects materially identical vulnerable code when it disappears
	 * and later returns. Empty string until scanner fingerprints land.
	 */
	contentFingerprint: string;

	/**
	 * Identifies the enclosing scope (class/method). Empty string until
	 * scanner fingerprints land.
	 */
	scopeFingerprint: string;

	/** SAST rule identifier from the engine. */
	ruleId: string;

	/** CWE identifier (e.g. "CWE-89"). */
	cweId: string;

	/** Vulnerability type name (e.g. "SQL Injection"). */
	type: string;

	/** Severity level. */
	severity: 'critical' | 'high' | 'medium' | 'low';

	/** Instance name from the engine (e.g. variable/method name). */
	instanceName: string;

	/** File path where the finding was last observed. */
	filePath: string;

	/** Epoch ms when the finding was first confirmed by a settled observation. */
	firstConfirmedAt: number;

	/** Epoch ms of the most recent settled confirmation. */
	lastConfirmedAt: number;

	/**
	 * Epoch ms when the finding was first absent from a settled observation.
	 * Null when the finding is currently active.
	 */
	missingSince: number | null;

	/**
	 * Epoch ms when provisional resolution was recorded (absence beyond
	 * the grace period). Null if never provisionally resolved.
	 */
	provisionalResolutionAt: number | null;

	/**
	 * Epoch ms when durable resolution was confirmed (absence verified
	 * at a later eligible checkpoint). Null if never durably resolved.
	 */
	durableResolutionAt: number | null;

	/**
	 * Number of matched occurrences at the finding's first confirmed
	 * observation. Used as the denominator for F/P scoring.
	 */
	baselineOccurrenceCount: number;

	/** Current matched occurrence count from the latest observation. */
	currentOccurrenceCount: number;

	/** Number of settled observations that confirmed this finding active. */
	confirmationCount: number;

	/**
	 * Number of durable-resolved → active transitions.
	 * Public "Recurring Pattern" shown when >= RECURRENCE_THRESHOLD.
	 */
	recurrenceCount: number;

	/**
	 * Within-session active → absent → active cycles with identical
	 * content/scope fingerprints. Measurement-integrity counter.
	 */
	inSessionToggleCount: number;

	/**
	 * Reappearances with identical content AND scope fingerprints
	 * after an absence. These are NOT counted as durable fixes.
	 */
	identicalRestorationCount: number;
}

// ══════════════════════════════════════════════════════════════════════
// CLASSIFICATION RESULT
// ══════════════════════════════════════════════════════════════════════

/**
 * Output of the lifecycle engine's classification step.
 *
 * Pairs a lifecycle record with its computed status and count delta
 * for the presentation layer.
 */
export interface FindingClassification {
	/** The finding's lifecycle record (post-update). */
	lifecycle: FindingLifecycleRecord;

	/** Computed status for the Trends card. */
	status: InternalFindingState;

	/** Occurrence count from the previous observation. */
	previousOccurrenceCount: number;

	/** Occurrence count from the current observation. */
	currentOccurrenceCount: number;
}

// ══════════════════════════════════════════════════════════════════════
// OBSERVED FINDING
// ══════════════════════════════════════════════════════════════════════

/**
 * Lightweight representation of a finding from a single scan result.
 *
 * Produced by `metadataToObservedFindings()` in convert.ts. This is
 * the input to the lifecycle engine — it does not carry full
 * Vulnerability hierarchy data, only the fields needed for matching
 * and lifecycle updates.
 */
export interface ObservedFinding {
	/** Logical fingerprint for identity matching. */
	logicalFingerprint: string;

	/** Content fingerprint for identical-restoration detection. */
	contentFingerprint: string;

	/** Scope fingerprint for identical-restoration detection. */
	scopeFingerprint: string;

	/** SAST rule identifier. */
	ruleId: string;

	/** CWE identifier. */
	cweId: string;

	/** Vulnerability type name. */
	type: string;

	/** Severity level. */
	severity: 'critical' | 'high' | 'medium' | 'low';

	/** Instance/symbol name. */
	instanceName: string;

	/** File path where the finding was observed. */
	filePath: string;

	/** Number of occurrences for this instance in this observation. */
	occurrenceCount: number;
}

// ══════════════════════════════════════════════════════════════════════
// SESSION CHECKPOINT
// ══════════════════════════════════════════════════════════════════════

/**
 * Snapshot of observed findings at a specific moment in a session.
 *
 * Captured at two points:
 * - **Baseline** — the first settled observation of the session
 * - **Final**    — the last observation before the session ends
 *
 * Comparing baseline vs. final reveals what changed during the session.
 */
export interface SessionCheckpoint {
	/** Epoch ms when this checkpoint was captured. */
	timestamp: number;

	/** Findings observed at this checkpoint. */
	findings: ObservedFinding[];
}

// ══════════════════════════════════════════════════════════════════════
// SESSION RECORD
// ══════════════════════════════════════════════════════════════════════

/**
 * Record for a completed or active observation session.
 *
 * Stores the session boundaries, baseline/final checkpoints, and
 * per-finding lifecycle summaries at session end.
 *
 * Reference: Section 6.2 — SessionRecord
 */
export interface SessionRecord {
	/** Unique session identifier (e.g. "session-001"). */
	sessionId: string;

	/** Epoch ms when the session started. */
	startedAt: number;

	/** Epoch ms when the session ended. Null while the session is active. */
	endedAt: number | null;

	/**
	 * Snapshot of findings at the first settled observation.
	 * Null until the first observation arrives.
	 */
	baselineCheckpoint: SessionCheckpoint | null;

	/**
	 * Snapshot of findings at the last observation before session end.
	 * Null while the session is active — set by finalizeSession().
	 */
	finalCheckpoint: SessionCheckpoint | null;

	/**
	 * Per-finding lifecycle summaries captured at session finalization.
	 * Empty while the session is active (live state is in the separate
	 * findingLifecycles store).
	 */
	lifecycleSummaries: FindingLifecycleRecord[];
}
