/**
 * Analysis adapter for the Session-Based Reinforcement Tracker.
 *
 * This module bridges the lifecycle engine's FindingClassification[]
 * output to the existing SessionAnalysis / SessionMetrics presentation
 * shapes used by the Session Metrics panel, status bar, and toasts.
 *
 * Previously this module diffed consecutive ScanSnapshots directly.
 * It now delegates all lifecycle logic to `lifecycleEngine.ts` and
 * only handles shape mapping for the UI layer.
 *
 * ─────────────────────────────────────────────────────────────────────
 * EXPORTS:
 *   buildSessionAnalysis(...)   → SessionAnalysis (rich internal data)
 *   toSessionMetrics(analysis)  → SessionMetrics   (presentation shape)
 * ─────────────────────────────────────────────────────────────────────
 */

import type { Vulnerability, ScanSnapshot } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
import type {
	SessionAnalysis,
	VulnerabilityDelta,
	VulnerabilityStatus,
	SeverityCounts,
} from './analysisTypes.js';
import type {
	SessionMetrics,
	SessionNotification,
} from '../../presentation/panelTypes.js';
import type {
	FindingClassification,
	InternalFindingState,
} from './lifecycleTypes.js';

// ══════════════════════════════════════════════════════════════════════
// SEVERITY COUNTING
// ══════════════════════════════════════════════════════════════════════

/**
 * Counts the total number of occurrences at each severity level.
 *
 * Walks the full hierarchy: Vulnerability → Instance → Occurrence.
 * Each individual occurrence is counted once, matching the
 * per-occurrence card display in the Active Vulnerabilities panel.
 */
function countSeverities(vulnerabilities: Vulnerability[]): SeverityCounts {
	const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
	for (const v of vulnerabilities) {
		for (const inst of v.instances) {
			counts[v.severity] += inst.occurrences.length;
		}
	}
	return counts;
}

// ══════════════════════════════════════════════════════════════════════
// SESSION ANALYSIS BUILDER
// ══════════════════════════════════════════════════════════════════════

/**
 * Builds a SessionAnalysis from lifecycle classifications and the
 * current scan snapshot.
 *
 * This replaces the old `analyzeSession(snapshots)` function.
 * The lifecycle engine has already processed the observation and
 * produced classifications — this function maps them to the shape
 * the UI expects.
 *
 * @param classifications - Output from lifecycleEngine.processObservation()
 * @param currentScan - The current scan snapshot (for active findings)
 * @param previousScan - The previous scan snapshot, or null
 */
export function buildSessionAnalysis(
	classifications: FindingClassification[],
	currentScan: ScanSnapshot,
	previousScan: ScanSnapshot | null,
): SessionAnalysis {
	const activeFindings = currentScan.vulnerabilities;

	let persistingPatterns = 0;
	let improvingTrends = 0;
	let resolvedThisSession = 0;
	let recurringPatterns = 0;

	const deltas: VulnerabilityDelta[] = [];

	for (const classification of classifications) {
		// Skip candidates — they are not shown on the Trends card
		if (classification.status === 'candidate') {
			continue;
		}

		const status = classification.status as VulnerabilityStatus;

		// Find the matching Vulnerability in the current scan for the delta
		const matchedVuln = findMatchingVulnerability(
			activeFindings,
			classification.lifecycle,
		);

		// For resolved findings, we need a placeholder since they're not active
		const vuln = matchedVuln ?? createResolvedPlaceholder(classification);

		deltas.push({
			vulnerability: vuln,
			status,
			previousInstanceCount: classification.previousOccurrenceCount,
			currentInstanceCount: classification.currentOccurrenceCount,
		});

		switch (status) {
			case 'persisting':
				persistingPatterns++;
				break;
			case 'improving':
				improvingTrends++;
				break;
			case 'resolved':
				resolvedThisSession++;
				break;
			case 'recurring':
				recurringPatterns++;
				break;
		}
	}

	return {
		currentScan,
		previousScan,
		activeFindings,
		deltas,
		severityCounts: countSeverities(activeFindings),
		persistingPatterns,
		improvingTrends,
		resolvedThisSession,
		recurringPatterns,
	};
}

/**
 * Finds a Vulnerability in the active scan that matches the lifecycle
 * record's CWE + type. Returns undefined if not found (e.g. resolved).
 */
function findMatchingVulnerability(
	activeFindings: Vulnerability[],
	lifecycle: { cweId: string; type: string },
): Vulnerability | undefined {
	return activeFindings.find(
		v => v.cwe_id === lifecycle.cweId && v.type === lifecycle.type,
	);
}

/**
 * Creates a minimal Vulnerability placeholder for resolved findings
 * that are no longer in the active scan.
 */
function createResolvedPlaceholder(
	classification: FindingClassification,
): Vulnerability {
	const lc = classification.lifecycle;
	return {
		type: lc.type,
		cwe_id: lc.cweId,
		owasp_category: '',
		severity: lc.severity,
		rule_id: lc.ruleId,
		instances: [],
	};
}

// ══════════════════════════════════════════════════════════════════════
// ADAPTER: SessionAnalysis → SessionMetrics
// ══════════════════════════════════════════════════════════════════════

/**
 * Maps the rich SessionAnalysis output to the existing
 * `SessionMetrics` shape from `presentation/panelTypes.ts`.
 *
 * This adapter bridges the analysis engine's internal data model
 * to the view layer without requiring any changes to the Session
 * Metrics panel's HTML builder (`buildSessionMetricsHtml`).
 *
 * Notifications are auto-generated from the vulnerability deltas.
 */
export function toSessionMetrics(analysis: SessionAnalysis): SessionMetrics {
	return {
		critical: analysis.severityCounts.critical,
		high: analysis.severityCounts.high,
		medium: analysis.severityCounts.medium,
		low: analysis.severityCounts.low,
		trends: {
			persistingPatterns: analysis.persistingPatterns,
			improvingTrends: analysis.improvingTrends,
			resolvedThisSession: analysis.resolvedThisSession,
		},
		notifications: generateNotifications(analysis),
	};
}

// ══════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY
// ══════════════════════════════════════════════════════════════════════

/**
 * Legacy `analyzeSession` kept for backward compatibility during
 * the transition period. Builds a minimal SessionAnalysis from a
 * scan snapshot without lifecycle data.
 *
 * @deprecated Use buildSessionAnalysis() with lifecycle classifications.
 */
export function analyzeSession(snapshots: ScanSnapshot[]): SessionAnalysis {
	if (snapshots.length === 0) {
		throw new Error('[Ariadne] analyzeSession requires at least 1 scan snapshot.');
	}

	const currentScan = snapshots[snapshots.length - 1];
	const previousScan = snapshots.length >= 2
		? snapshots[snapshots.length - 2]
		: null;

	return {
		currentScan,
		previousScan,
		activeFindings: currentScan.vulnerabilities,
		deltas: [],
		severityCounts: countSeverities(currentScan.vulnerabilities),
		persistingPatterns: 0,
		improvingTrends: 0,
		resolvedThisSession: 0,
		recurringPatterns: 0,
	};
}

// ══════════════════════════════════════════════════════════════════════
// NOTIFICATION GENERATOR
// ══════════════════════════════════════════════════════════════════════

/**
 * Auto-generates notification entries from the vulnerability deltas.
 *
 * Order: recurring first (most concerning), then persisting patterns,
 * then improving trends, then resolved (positive feedback).
 */
function generateNotifications(analysis: SessionAnalysis): SessionNotification[] {
	const notifications: SessionNotification[] = [];

	// Priority order: recurring > persisting > improving > resolved
	const priorityOrder: Record<VulnerabilityStatus, number> = {
		recurring: 0,
		persisting: 1,
		improving: 2,
		resolved: 3,
	};

	const sorted = [...analysis.deltas].sort(
		(a, b) => priorityOrder[a.status] - priorityOrder[b.status],
	);

	for (const delta of sorted) {
		const v = delta.vulnerability;
		const firstOccurrence = v.instances[0]?.occurrences[0];
		const fileHint = firstOccurrence
			? extractFileName(firstOccurrence.file_path)
			: 'unknown file';

		const notifId = `${delta.status}::${v.cwe_id}::${v.type}`;

		switch (delta.status) {
			case 'recurring':
				notifications.push({
					id: notifId,
					message: 'Recurring pattern detected',
					detail:
						`${v.type} (${v.cwe_id}) has reappeared after being resolved. ` +
						`Review in ${fileHint}.`,
					timestamp: 'just now',
				});
				break;

			case 'persisting':
				notifications.push({
					id: notifId,
					message: 'Persisting issue',
					detail:
						`${v.type} has persisted across observations` +
						` in ${fileHint}.`,
					timestamp: 'ongoing',
				});
				break;

			case 'improving':
				notifications.push({
					id: notifId,
					message: 'Security improving',
					detail:
						`${v.type} instances decreased from ` +
						`${delta.previousInstanceCount} to ${delta.currentInstanceCount}. Keep it up.`,
					timestamp: 'just now',
				});
				break;

			case 'resolved':
				notifications.push({
					id: notifId,
					message: 'Pattern resolved',
					detail:
						`${v.type} (${v.cwe_id}) is no longer detected.`,
					timestamp: 'just now',
				});
				break;
		}
	}

	return notifications;
}

/**
 * Extracts the file name from a path string.
 * e.g. "src/java/com/.../LoginController.java" → "LoginController.java"
 */
function extractFileName(filePath: string): string {
	const parts = filePath.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1] || filePath;
}
