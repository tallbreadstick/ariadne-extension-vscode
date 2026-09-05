/**
 * Snapshot Analysis Engine for the Session-Based Reinforcement Tracker.
 *
 * This module diffs consecutive ScanSnapshots to derive:
 *
 * - **Active findings** — vulnerabilities in the latest scan
 * - **Persisting patterns** — unique instances still present after being seen
 * - **Improving trends** — unique instances seen before that are now gone
 * - **Resolved** — same as improving at instance granularity
 * - **New** — unique instances never seen earlier in the session
 *
 * Identity is `instance_fingerprint` (or composed logical/scope/content
 * hashes). Line shifts of the same sink stay one instance. Reappearing
 * after a fix is persisting again, not a new improvement.
 *
 * ─────────────────────────────────────────────────────────────────────
 * EXPORTS:
 *   analyzeSession(snapshots)  → SessionAnalysis (rich internal data)
 *   toSessionMetrics(analysis) → SessionMetrics   (presentation shape)
 * ─────────────────────────────────────────────────────────────────────
 */

import type {
	Vulnerability,
	ScanSnapshot,
	Instance,
	Occurrence,
} from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
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

type InstanceRef = {
	key: string;
	vulnerability: Vulnerability;
};

/**
 * Durable identity for one sink. Prefers the engine's instance hash so
 * two sinks of the same rule in the same method stay distinct.
 */
function instanceIdentity(occ: Occurrence, inst: Instance, v: Vulnerability): string {
	if (occ.instance_fingerprint) {
		return occ.instance_fingerprint;
	}
	if (occ.logical_fingerprint && occ.scope_fingerprint && occ.content_fingerprint) {
		return `${occ.logical_fingerprint}:${occ.scope_fingerprint}:${occ.content_fingerprint}`;
	}
	if (occ.logical_fingerprint) {
		return occ.logical_fingerprint;
	}
	return [
		v.cwe_id,
		v.type,
		occ.file_path,
		inst.name,
		occ.enclosing_symbol_path ?? '',
		String(occ.line_number),
	].join('::');
}

function collectInstanceKeys(vulnerabilities: Vulnerability[]): Map<string, InstanceRef> {
	const map = new Map<string, InstanceRef>();
	for (const vulnerability of vulnerabilities) {
		for (const inst of vulnerability.instances) {
			for (const occ of inst.occurrences) {
				const key = instanceIdentity(occ, inst, vulnerability);
				if (!map.has(key)) {
					map.set(key, { key, vulnerability });
				}
			}
		}
	}
	return map;
}

function instanceKeysFor(v: Vulnerability): Set<string> {
	const keys = new Set<string>();
	for (const inst of v.instances) {
		for (const occ of inst.occurrences) {
			keys.add(instanceIdentity(occ, inst, v));
		}
	}
	return keys;
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

	const currentInstances = collectInstanceKeys(activeFindings);
	const allPriorInstances = new Map<string, InstanceRef>();
	for (let i = 0; i < snapshots.length - 1; i++) {
		for (const [key, ref] of collectInstanceKeys(snapshots[i].vulnerabilities)) {
			allPriorInstances.set(key, ref);
		}
	}

	let persistingPatterns = 0;
	let improvingTrends = 0;
	let resolvedThisSession = 0;
	let newVulnerabilities = 0;

	for (const key of currentInstances.keys()) {
		if (allPriorInstances.has(key)) {
			// Seen before and still present — including a reintroduced sink.
			persistingPatterns++;
		} else {
			newVulnerabilities++;
		}
	}

	for (const key of allPriorInstances.keys()) {
		if (!currentInstances.has(key)) {
			// Unique instance that disappeared. Reappearing later removes
			// it from this set, so the same sink is not a second improvement.
			improvingTrends++;
			resolvedThisSession++;
		}
	}

	const deltas: VulnerabilityDelta[] = [];

	// Type-level deltas feed notifications; counters above are per instance.
	for (const vuln of currentMap.values()) {
		const prev = previousMap.get(vulnKey(vuln));
		const currentCount = instanceKeysFor(vuln).size;
		const previousCount = prev ? instanceKeysFor(prev).size : 0;

		let status: VulnerabilityStatus;
		if (!prev) {
			status = 'new';
		} else if (currentCount < previousCount) {
			status = 'improving';
		} else {
			status = 'persisting';
		}

		deltas.push({
			vulnerability: vuln,
			status,
			previousInstanceCount: previousCount,
			currentInstanceCount: currentCount,
		});
	}

	const allPriorTypeKeys = new Set<string>();
	for (let i = 0; i < snapshots.length - 1; i++) {
		for (const v of snapshots[i].vulnerabilities) {
			allPriorTypeKeys.add(vulnKey(v));
		}
	}

	for (const priorKey of allPriorTypeKeys) {
		if (!currentMap.has(priorKey)) {
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
					previousInstanceCount: instanceKeysFor(lastKnown).size,
					currentInstanceCount: 0,
				});
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

		// Stable ID: same vulnerability + same status → same ID across restarts.
		const notifId = `${delta.status}::${v.cwe_id}::${v.type}`;

		switch (delta.status) {
			case 'new':
				notifications.push({
					id: notifId,
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
	const parts = filePath.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1] || filePath;
}
