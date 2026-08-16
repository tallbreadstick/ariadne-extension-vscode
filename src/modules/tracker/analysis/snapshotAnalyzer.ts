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
	SessionReinforcement,
} from '../../presentation/panelTypes.js';

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

	const currentScan = snapshots.at(-1)!;
	const previousScan = snapshots.at(-2) ?? null;

	const activeFindings = currentScan.vulnerabilities;
	const currentMap = buildVulnMap(activeFindings);
	const previousMap = previousScan
		? buildVulnMap(previousScan.vulnerabilities)
		: new Map<string, Vulnerability>();

	const allPriorKeys = collectPriorKeys(snapshots);
	const classified = classifyCurrentFindings(currentMap, previousMap);
	const resolved = collectResolvedFindings(snapshots, currentMap, previousMap, allPriorKeys);

	return {
		currentScan,
		previousScan,
		activeFindings,
		deltas: [...classified.deltas, ...resolved.deltas],
		severityCounts: countSeverities(activeFindings),
		persistingPatterns: classified.persistingPatterns,
		improvingTrends: classified.improvingTrends + resolved.improvingTrends,
		resolvedThisSession: resolved.resolvedThisSession,
		newVulnerabilities: classified.newVulnerabilities,
	};
}

function collectPriorKeys(snapshots: ScanSnapshot[]): Set<string> {
	const allPriorKeys = new Set<string>();
	for (let i = 0; i < snapshots.length - 1; i++) {
		for (const vulnerability of snapshots[i].vulnerabilities) {
			allPriorKeys.add(vulnKey(vulnerability));
		}
	}
	return allPriorKeys;
}

function classifyCurrentFindings(
	currentMap: Map<string, Vulnerability>,
	previousMap: Map<string, Vulnerability>,
): {
	deltas: VulnerabilityDelta[];
	persistingPatterns: number;
	improvingTrends: number;
	newVulnerabilities: number;
} {
	const deltas: VulnerabilityDelta[] = [];
	let persistingPatterns = 0;
	let improvingTrends = 0;
	let newVulnerabilities = 0;

	for (const [key, vulnerability] of currentMap) {
		const previous = previousMap.get(key);
		const currentCount = vulnerability.instances.length;

		if (!previous) {
			newVulnerabilities++;
			deltas.push({
				vulnerability,
				status: 'new',
				previousInstanceCount: 0,
				currentInstanceCount: currentCount,
			});
			continue;
		}

		const previousCount = previous.instances.length;
		const status: VulnerabilityStatus = currentCount < previousCount
			? 'improving'
			: 'persisting';

		if (status === 'improving') {
			improvingTrends++;
		} else {
			persistingPatterns++;
		}

		deltas.push({
			vulnerability,
			status,
			previousInstanceCount: previousCount,
			currentInstanceCount: currentCount,
		});
	}

	return { deltas, persistingPatterns, improvingTrends, newVulnerabilities };
}

function collectResolvedFindings(
	snapshots: ScanSnapshot[],
	currentMap: Map<string, Vulnerability>,
	previousMap: Map<string, Vulnerability>,
	allPriorKeys: Set<string>,
): {
	deltas: VulnerabilityDelta[];
	improvingTrends: number;
	resolvedThisSession: number;
} {
	const deltas: VulnerabilityDelta[] = [];
	let improvingTrends = 0;
	let resolvedThisSession = 0;

	for (const priorKey of allPriorKeys) {
		if (currentMap.has(priorKey)) {
			continue;
		}

		const lastKnown = findLastKnownVulnerability(snapshots, priorKey);
		if (!lastKnown) {
			continue;
		}

		deltas.push({
			vulnerability: lastKnown,
			status: 'resolved',
			previousInstanceCount: lastKnown.instances.length,
			currentInstanceCount: 0,
		});
		resolvedThisSession++;

		if (previousMap.has(priorKey)) {
			improvingTrends++;
		}
	}

	return { deltas, improvingTrends, resolvedThisSession };
}

function findLastKnownVulnerability(
	snapshots: ScanSnapshot[],
	priorKey: string,
): Vulnerability | undefined {
	for (let i = snapshots.length - 2; i >= 0; i--) {
		const lastKnown = snapshots[i].vulnerabilities.find(
			(vulnerability) => vulnKey(vulnerability) === priorKey,
		);
		if (lastKnown) {
			return lastKnown;
		}
	}

	return undefined;
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
		reinforcement: deriveReinforcement(analysis),
		notifications: generateNotifications(analysis),
	};
}

/**
 * Builds a compact encouragement banner from the current session state.
 *
 * The summary is intentionally conservative: it only appears when the
 * scan results show real progress, or when the workspace is currently
 * clean enough to merit a positive acknowledgement.
 */
function deriveReinforcement(analysis: SessionAnalysis): SessionReinforcement | undefined {
	const { activeFindings, improvingTrends, resolvedThisSession, newVulnerabilities, persistingPatterns } = analysis;

	if (activeFindings.length === 0) {
		return {
			title: 'Clean scan',
			detail: 'No active vulnerabilities are left in the latest scan. Nice work keeping the current surface clean.',
			tone: 'success',
		};
	}

	if (resolvedThisSession > 0) {
		const patternSuffix = resolvedThisSession === 1 ? '' : 's';
		const shrinkingSuffix = improvingTrends === 1 ? ' is' : 's are';
		const improvementSuffix = improvingTrends > 0
			? `, and ${improvingTrends} more pattern${shrinkingSuffix} shrinking.`
			: '.';

		return {
			title: 'Progress made',
			detail: `${resolvedThisSession} pattern${patternSuffix} resolved this session${improvementSuffix}`,
			tone: 'success',
		};
	}

	if (improvingTrends > 0 && newVulnerabilities === 0) {
		const trendSuffix = improvingTrends === 1 ? ' is' : 's are';
		return {
			title: 'Good momentum',
			detail: `${improvingTrends} vulnerability pattern${trendSuffix} trending down with no new issues introduced this scan.`,
			tone: 'encouragement',
		};
	}

	if (newVulnerabilities === 0 && persistingPatterns === 0) {
		return {
			title: 'Steady progress',
			detail: 'No new vulnerabilities were introduced in this scan.',
			tone: 'info',
		};
	}

	return undefined;
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
		const lineSuffix = firstOccurrence ? ` at line ${firstOccurrence.line_number}` : '';

		// Stable ID: same vulnerability + same status → same ID across restarts.
		const notifId = `${delta.status}::${v.cwe_id}::${v.type}`;

		switch (delta.status) {
			case 'new':
				notifications.push({
					id: notifId,
					message: 'New vulnerability detected',
					detail:
						`${v.type} (${v.cwe_id}) found in ${fileHint}` +
						lineSuffix +
						'. Review immediately.',
					timestamp: 'just now',
				});
				break;

			case 'persisting':
				notifications.push({
					id: notifId,
					message: 'Recurring issue',
					detail:
						`${v.type} has persisted across consecutive scans` +
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
	const parts = filePath.replaceAll('\\', '/').split('/');
	return parts.at(-1) || filePath;
}
