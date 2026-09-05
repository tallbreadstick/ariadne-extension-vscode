/**
 * Analysis result types for the Session-Based Reinforcement Tracker.
 *
 * These types capture the rich, granular output of the snapshot
 * analysis engine. They are consumed by:
 *
 * - `toSessionMetrics()` — maps to the presentation-layer SessionMetrics
 *   shape for rendering in the Session Metrics panel.
 * - Status bar — uses severity counts and trend data for the
 *   priority-based display.
 * - Future features — delta history, drill-down views, etc.
 */

import type { Vulnerability, ScanSnapshot } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';

// ── Status classification ─────────────────────────────────────────────

/**
 * Status of a vulnerability between two consecutive scans.
 *
 * - `new`        — present in the current scan but NOT in the previous scan
 * - `persisting` — present in both scans with instance count >= previous
 * - `improving`  — present in both scans with instance count < previous
 * - `resolved`   — present in a prior scan but absent from the current scan
 */
export type VulnerabilityStatus = 'new' | 'persisting' | 'improving' | 'resolved';

/**
 * Delta for a single vulnerability between two consecutive scans.
 *
 * Each VulnerabilityDelta describes how one vulnerability pattern
 * changed (or didn't) between the previous and current scan.
 */
export interface VulnerabilityDelta {
	/** The vulnerability pattern (current state, or last known for resolved) */
	vulnerability: Vulnerability;
	/** Computed status based on instance count comparison */
	status: VulnerabilityStatus;
	/** Instance count in the previous scan (0 if new) */
	previousInstanceCount: number;
	/** Instance count in the current scan (0 if resolved) */
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
 * Produced by `analyzeSession()` from a timeline of ScanSnapshot[].
 * Contains both the raw data and computed summary metrics.
 */
export interface SessionAnalysis {
	/** The current (latest) scan snapshot */
	currentScan: ScanSnapshot;
	/** The previous scan snapshot, or null if only one scan exists */
	previousScan: ScanSnapshot | null;
	/** All vulnerabilities in the current scan */
	activeFindings: Vulnerability[];
	/** Per-vulnerability deltas (includes new, persisting, improving, resolved) */
	deltas: VulnerabilityDelta[];
	/** Severity breakdown of active findings */
	severityCounts: SeverityCounts;
	/** Unique instances seen earlier in the session that are still present */
	persistingPatterns: number;
	/** Unique instances seen earlier in the session that are now gone */
	improvingTrends: number;
	/** Unique instances present in a prior scan but absent in the current scan */
	resolvedThisSession: number;
	/** Unique instances in the current scan that were never seen before */
	newVulnerabilities: number;
}
