/**
 * Analysis result types for the Session-Based Reinforcement Tracker.
 *
 * These types capture the output of the lifecycle engine, bridging
 * the internal FindingLifecycleRecord model to the presentation layer.
 *
 * Consumed by:
 * - `toSessionMetrics()` — maps to SessionMetrics for the panel
 * - Status bar — uses severity counts and trend data
 * - Toast notifications — uses deltas for user alerts
 */

import type { Vulnerability, ScanSnapshot } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
import type { FindingClassification } from './lifecycleTypes.js';

// ── Score types ───────────────────────────────────────────────────────

/**
 * Per-CWE score entry for the Improving Trends collapsible rows.
 *
 * Computed by `scoreCalculator.ts` and attached to `SessionAnalysis.typeScores`.
 */
export interface TypeScoreEntry {
	/** Vulnerability type label (e.g. "SQL Injection"). */
	type: string;
	/** CWE identifier used as the grouping key. */
	cweId: string;
	/** Fix Score for this CWE (0–10). */
	f: number;
	/** Persistence Score for this CWE (0–10). */
	p: number;
	/** Pairwise Trend Score for this CWE. Null if first session or not in comparison set. */
	t: number | null;
	/** Total FLCs ever observed for this CWE. */
	totalInstances: number;
	/** FLCs with durable resolution. */
	resolvedInstances: number;
	/** FLCs currently open. */
	openInstances: number;
}

// ── Status classification ─────────────────────────────────────────────

/**
 * Public status of a vulnerability in the Trends card.
 *
 * Four statuses per the finalized framework (Section 7.2):
 * - `persisting` — active, met duration/confirmation thresholds, not improving
 * - `improving`  — active, occurrence count decreased from baseline
 * - `resolved`   — durable confirmed absence
 * - `recurring`  — previously resolved, reappeared >= threshold times
 *
 * `new` is removed from the public taxonomy — new findings are internal
 * "candidates" that do not appear on the Trends card until they meet
 * the persistence thresholds.
 */
export type VulnerabilityStatus = 'persisting' | 'improving' | 'resolved' | 'recurring';

/**
 * Delta for a single vulnerability between observations.
 *
 * Each VulnerabilityDelta describes one finding's current classification
 * and count change for the presentation layer.
 */
export interface VulnerabilityDelta {
	/** The vulnerability pattern (current state, or last known for resolved) */
	vulnerability: Vulnerability;
	/** Computed status from the lifecycle engine */
	status: VulnerabilityStatus;
	/** Occurrence count from the previous/baseline observation (0 if new) */
	previousInstanceCount: number;
	/** Occurrence count in the current observation (0 if resolved) */
	currentInstanceCount: number;
}

// ── Severity counts ───────────────────────────────────────────────────

/** Severity breakdown of active findings in the current scan. */
export interface SeverityCounts {
	critical: number;
	high: number;
	medium: number;
	low: number;
}

// ── Session analysis ──────────────────────────────────────────────────

/**
 * Complete analysis result for a scan session.
 *
 * Produced by the lifecycle engine adapter from FindingClassification[].
 * Contains both the raw data and computed summary metrics.
 */
export interface SessionAnalysis {
	/** The current (latest) scan snapshot — kept for compatibility with existing views */
	currentScan: ScanSnapshot;
	/** The previous scan snapshot, or null if only one scan exists */
	previousScan: ScanSnapshot | null;
	/** All vulnerabilities in the current scan */
	activeFindings: Vulnerability[];
	/** Per-vulnerability deltas (persisting, improving, resolved, recurring) */
	deltas: VulnerabilityDelta[];
	/** Severity breakdown of active findings */
	severityCounts: SeverityCounts;
	/** Unique instances seen earlier in the session that are still present */
	persistingPatterns: number;
	/** Unique instances seen earlier in the session that are now gone */
	improvingTrends: number;
	/** Count of vulnerabilities with durable confirmed resolution */
	resolvedThisSession: number;
	/**
	 * Count of vulnerabilities that have recurred after durable resolution
	 * and met the recurrence threshold.
	 */
	recurringPatterns: number;
	/**
	 * Total identical restoration count across all findings in the session (Section 11.3).
	 * Measurement-integrity counter.
	 */
	totalIdenticalRestorations?: number;
	/**
	 * Total in-session toggle count across all findings in the session (Section 11.3).
	 * Measurement-integrity counter.
	 */
	totalInSessionToggles?: number;
	/**
	 * Live F/P/T scores computed from the current lifecycle state.
	 * Updated each settled observation.
	 */
	scores?: {
		/** Workspace-level Fix Score (0–10). */
		f: number;
		/** Workspace-level Persistence Score (0–10). */
		p: number;
		/** Live Trend Score. Null = first session (no comparison set). */
		tLive: number | null;
		/** User-facing label for T (e.g. "Some progress (+2.00)"). */
		tLabel: string | null;
	};
	/**
	 * Per-CWE score breakdown for the Improving Trends collapsible rows.
	 */
	typeScores?: TypeScoreEntry[];
	/**
	 * Findings newly detected in this observation transitioning to Candidate.
	 */
	newCandidateFindings?: FindingClassification[];
}
