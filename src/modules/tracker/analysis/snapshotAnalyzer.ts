/**
 * Snapshot Analysis Engine for the Session-Based Reinforcement Tracker.
 *
 * This module diffs consecutive ScanSnapshots to derive:
 *
 * - **Active findings** — vulnerabilities in the latest scan
 * - **Improving trends** — instance count decreased since previous scan
 * - **Persisting patterns** — instance count stayed same or increased
 * - **Resolved** — present in a prior scan, absent in the current scan
 * - **New** — present in current scan, absent in the previous scan
 *
 * Resolution follows the project's definition: a vulnerability is
 * resolved when a fresh, complete analysis run can no longer reproduce
 * the same instance. It is NOT "it was fixed before" but "it is not
 * currently reproducible under the engine's rules."
 *
 * ─────────────────────────────────────────────────────────────────────
 * EXPORTS:
 *   analyzeSession(snapshots)  → SessionAnalysis (rich internal data)
 *   toSessionMetrics(analysis) → SessionMetrics   (presentation shape)
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
} from '../../presentation/types.js';

// ══════════════════════════════════════════════════════════════════════
// IDENTITY KEY
// ══════════════════════════════════════════════════════════════════════

/**
 * Returns the unique identity key for a vulnerability pattern.
 * Two findings are considered the same vulnerability if they share
 * both `cwe_id` and `type`.
 */
function vulnKey(v: Vulnerability): string {
	return `${v.cwe_id}::${v.type}`;
}

/**
 * Builds a lookup map from vulnerability key → Vulnerability.
 */
function buildVulnMap(vulnerabilities: Vulnerability[]): Map<string, Vulnerability> {
	const map = new Map<string, Vulnerability>();
	for (const v of vulnerabilities) {
		map.set(vulnKey(v), v);
	}
	return map;
}

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
// CORE ANALYSIS
// ══════════════════════════════════════════════════════════════════════

/**
 * Analyzes a session's scan timeline to produce computed metrics.
 *
 * Requires at least 1 scan snapshot. Trend and pattern analysis
 * requires at least 2 scans — with only 1 scan, all active
 * findings are classified as `new` and no trends are computed.
 *
 * Resolution is determined across the **entire session**: a
 * vulnerability is resolved if it appeared in ANY prior scan
 * but is absent from the current (latest) scan.
 *
 * @param snapshots - Chronologically ordered scan snapshots (oldest first)
 * @returns Complete session analysis with computed deltas and metrics
 * @throws Error if snapshots array is empty
 */
export function analyzeSession(snapshots: ScanSnapshot[]): SessionAnalysis {
	if (snapshots.length === 0) {
		throw new Error('[Ariadne] analyzeSession requires at least 1 scan snapshot.');
	}

	const currentScan = snapshots[snapshots.length - 1];
	const previousScan = snapshots.length >= 2
		? snapshots[snapshots.length - 2]
		: null;

	const activeFindings = currentScan.vulnerabilities;
	const currentMap = buildVulnMap(activeFindings);
	const previousMap = previousScan
		? buildVulnMap(previousScan.vulnerabilities)
		: new Map<string, Vulnerability>();

	// ── Collect all vulnerability keys that ever appeared ──────────
	// Used for resolution detection across the entire session.
	const allPriorKeys = new Set<string>();
	for (let i = 0; i < snapshots.length - 1; i++) {
		for (const v of snapshots[i].vulnerabilities) {
			allPriorKeys.add(vulnKey(v));
		}
	}

	const deltas: VulnerabilityDelta[] = [];
	let persistingPatterns = 0;
	let improvingTrends = 0;
	let resolvedThisSession = 0;
	let newVulnerabilities = 0;

	// ── Classify active findings ──────────────────────────────────
	for (const [key, vuln] of currentMap) {
		const prev = previousMap.get(key);
		const currentCount = vuln.instances.length;

		let status: VulnerabilityStatus;
		let previousCount: number;

		if (!prev) {
			// Not in the immediately previous scan → new
			status = 'new';
			previousCount = 0;
			newVulnerabilities++;
		} else {
			previousCount = prev.instances.length;
			if (currentCount < previousCount) {
				status = 'improving';
				improvingTrends++;
			} else {
				// currentCount >= previousCount → persisting
				status = 'persisting';
				persistingPatterns++;
			}
		}

		deltas.push({
			vulnerability: vuln,
			status,
			previousInstanceCount: previousCount,
			currentInstanceCount: currentCount,
		});
	}

	// ── Detect resolved vulnerabilities ───────────────────────────
	// A vulnerability is resolved if it appeared in ANY prior scan
	// but is absent from the current scan.
	for (const priorKey of allPriorKeys) {
		if (!currentMap.has(priorKey)) {
			// Find the last known state of this vulnerability
			// (scan backwards from the second-to-last snapshot)
			let lastKnown: Vulnerability | undefined;
			for (let i = snapshots.length - 2; i >= 0; i--) {
				lastKnown = snapshots[i].vulnerabilities.find(
					(v) => vulnKey(v) === priorKey,
				);
				if (lastKnown) { break; }
			}

			if (lastKnown) {
				deltas.push({
					vulnerability: lastKnown,
					status: 'resolved',
					previousInstanceCount: lastKnown.instances.length,
					currentInstanceCount: 0,
				});
				resolvedThisSession++;
			}
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
		newVulnerabilities,
	};
}

// ══════════════════════════════════════════════════════════════════════
// ADAPTER: SessionAnalysis → SessionMetrics
// ══════════════════════════════════════════════════════════════════════

/**
 * Maps the rich SessionAnalysis output to the existing
 * `SessionMetrics` shape from `presentation/types.ts`.
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
// NOTIFICATION GENERATOR
// ══════════════════════════════════════════════════════════════════════

/**
 * Auto-generates notification entries from the vulnerability deltas.
 *
 * Order: new vulnerabilities first (most urgent), then persisting
 * patterns, then improving trends, then resolved (positive feedback).
 */
function generateNotifications(analysis: SessionAnalysis): SessionNotification[] {
	const notifications: SessionNotification[] = [];

	// Sort deltas by priority: new > persisting > improving > resolved
	const priorityOrder: Record<VulnerabilityStatus, number> = {
		new: 0,
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

		switch (delta.status) {
			case 'new':
				notifications.push({
					message: 'New vulnerability detected',
					detail:
						`${v.type} (${v.cwe_id}) found in ${fileHint}` +
						`${firstOccurrence ? ` at line ${firstOccurrence.line_number}` : ''}` +
						'. Review immediately.',
					timestamp: 'just now',
				});
				break;

			case 'persisting':
				notifications.push({
					message: 'Recurring issue',
					detail:
						`${v.type} has persisted across consecutive scans` +
						` in ${fileHint}.`,
					timestamp: 'ongoing',
				});
				break;

			case 'improving':
				notifications.push({
					message: 'Security improving',
					detail:
						`${v.type} instances decreased from ` +
						`${delta.previousInstanceCount} to ${delta.currentInstanceCount}. Keep it up.`,
					timestamp: 'just now',
				});
				break;

			case 'resolved':
				notifications.push({
					message: 'Pattern resolved',
					detail:
						`${v.type} (${v.cwe_id}) is no longer detected in the latest scan.`,
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
