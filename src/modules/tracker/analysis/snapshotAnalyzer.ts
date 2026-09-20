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

import type {
	Vulnerability,
	ScanSnapshot,
} from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
import type {
	SessionAnalysis,
	VulnerabilityDelta,
	VulnerabilityStatus,
	SeverityCounts,
	TypeScoreEntry,
} from './analysisTypes.js';
import type {
	SessionMetrics,
	SessionNotification,
	ImprovingSubItem,
	TrendSubItem,
	CommonVulnerabilityItem,
} from '../../presentation/panelTypes.js';
import type {
	FindingClassification,
	FindingLifecycleRecord,
	InternalFindingState,
	TrendComparisonBaseline,
} from './lifecycleTypes.js';
import type { CommonVulnerabilityEntry } from './commonVulnerabilities.js';
import {
	computeCategoryScores,
	computeTrendScore,
	trendLabel,
	formatTrendDelta,
} from './scoreCalculator.js';

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

export interface BuildSessionAnalysisOptions {
	/** True if this is the session's first checkpoint. */
	isInitialCheckpoint?: boolean;
}

/**
 * Builds a SessionAnalysis from lifecycle classifications and the
 * current scan snapshot.
 *
 * @param classifications - Output from lifecycleEngine.processObservation()
 * @param currentScan - The current scan snapshot (for active findings)
 * @param previousScan - The previous scan snapshot, or null
 * @param lifecycles - Current lifecycle records (for F/P computation)
 * @param trendComparisonByKey - Frozen comparison set from prior session (for T computation)
 * @param sessionStartedAt - Start timestamp of the current active session (for scoping resolutions)
 * @param options - Additional options including initial checkpoint flags
 */
export function buildSessionAnalysis(
	classifications: FindingClassification[],
	currentScan: ScanSnapshot,
	previousScan: ScanSnapshot | null,
	lifecycles?: FindingLifecycleRecord[],
	trendComparisonByKey?: Record<string, TrendComparisonBaseline> | null,
	sessionStartedAtOrOptions?: number | null | BuildSessionAnalysisOptions,
	options?: BuildSessionAnalysisOptions,
): SessionAnalysis {
	let sessionStartedAt: number | null | undefined = null;
	let resolvedOptions = options;

	if (typeof sessionStartedAtOrOptions === 'number' || sessionStartedAtOrOptions === null) {
		sessionStartedAt = sessionStartedAtOrOptions;
	} else if (sessionStartedAtOrOptions && typeof sessionStartedAtOrOptions === 'object') {
		resolvedOptions = sessionStartedAtOrOptions;
	}
	void resolvedOptions;
	const activeFindings = currentScan.vulnerabilities;

	const newCandidateFindings = classifications.filter((c) => {
		if (c.isNewCandidate !== undefined) {
			return c.isNewCandidate;
		}
		return c.status === 'candidate' && c.previousState === undefined;
	});

	const absentCandidateFindings = classifications.filter((c) => {
		if (c.isAbsentCandidate !== undefined) {
			return c.isAbsentCandidate;
		}
		return (
			c.status === 'candidate' &&
			c.previousState !== undefined &&
			c.previousState !== 'candidate' &&
			c.previousState !== 'resolved'
		);
	});

	const newPersistingFindings = classifications.filter((c) => {
		if (c.isNewPersisting !== undefined) {
			return c.isNewPersisting;
		}
		return c.status === 'persisting' && c.previousState !== 'persisting';
	});

	const newResolvedFindings = classifications.filter((c) => {
		if (c.isNewResolved !== undefined) {
			return c.isNewResolved;
		}
		return c.status === 'resolved' && c.previousState !== 'resolved';
	});

	let persistingPatterns = 0;
	let improvingTrends = 0;
	let resolvedThisSession = 0;
	let recurringPatterns = 0;
	let totalIdenticalRestorations = 0;
	let totalInSessionToggles = 0;

	const deltas: VulnerabilityDelta[] = [];

	/**
	 * Indices of deltas for findings first detected in this session
	 * (firstConfirmedAt >= sessionStartedAt). These are new problems
	 * and must NOT be reclassified as "improving" even if another
	 * finding of the same type was resolved.
	 */
	const newlyPersistingIndices = new Set<number>();

	// ── Per-type aggregation for type-level improving detection ──
	const typeResolvedCount = new Map<string, number>();
	const typePersistingCount = new Map<string, number>();
	const typeTotalCount = new Map<string, number>();

	for (const classification of classifications) {
		totalIdenticalRestorations += classification.lifecycle.identicalRestorationCount ?? 0;
		totalInSessionToggles += classification.lifecycle.inSessionToggleCount ?? 0;

		// Skip candidates and active findings — they are not shown on the Trends card
		if (classification.status === 'candidate' || classification.status === 'active') {
			continue;
		}

		const status = classification.status as VulnerabilityStatus;
		const type = classification.lifecycle.type;

		// Check if resolved finding was resolved in this session.
		// Historical resolutions from prior sessions must not count toward this session's
		// resolved count or trigger type-level improving trends on reintroduced instances.
		const isResolvedThisSession = status === 'resolved' && (
			sessionStartedAt === undefined || sessionStartedAt === null ||
			(classification.lifecycle.durableResolutionAt !== null && classification.lifecycle.durableResolutionAt >= sessionStartedAt) ||
			(classification.lifecycle.provisionalResolutionAt !== null && classification.lifecycle.provisionalResolutionAt >= sessionStartedAt)
		);

		if (status === 'resolved' && !isResolvedThisSession) {
			continue;
		}

		// Find the matching Vulnerability in the current scan for the delta
		const matchedVuln = findMatchingVulnerability(
			activeFindings,
			classification.lifecycle,
		);

		// For resolved findings, we need a placeholder since they're not active
		const vuln = matchedVuln ?? createResolvedPlaceholder(classification);

		const deltaIdx = deltas.length;
		deltas.push({
			vulnerability: vuln,
			status,
			previousInstanceCount: classification.previousOccurrenceCount,
			currentInstanceCount: classification.currentOccurrenceCount,
		});

		// Track per-type counts for improving detection
		typeTotalCount.set(type, (typeTotalCount.get(type) ?? 0) + 1);

		switch (status) {
			case 'persisting':
				persistingPatterns++;
				typePersistingCount.set(type, (typePersistingCount.get(type) ?? 0) + 1);
				// Tag findings first detected in this session — they are new
				// problems, not partially-fixed old ones. This is stable across
				// multiple saves within the same session (unlike previousState).
				if (
					sessionStartedAt !== null &&
					sessionStartedAt !== undefined &&
					classification.lifecycle.firstConfirmedAt !== null &&
					classification.lifecycle.firstConfirmedAt !== undefined &&
					classification.lifecycle.firstConfirmedAt >= sessionStartedAt
				) {
					newlyPersistingIndices.add(deltaIdx);
				}
				break;
			case 'improving':
				// FLC-level improving (occurrence count reduction) — still count
				improvingTrends++;
				typePersistingCount.set(type, (typePersistingCount.get(type) ?? 0) + 1);
				break;
			case 'resolved':
				resolvedThisSession++;
				typeResolvedCount.set(type, (typeResolvedCount.get(type) ?? 0) + 1);
				break;
			case 'recurring':
				recurringPatterns++;
				break;
		}
	}

	// ── Type-level improving detection ───────────────────────────
	// A vulnerability type is "improving" when it has at least one
	// resolved instance AND at least one still-persisting instance.
	// Recurring findings are regressions (relapses), never improving trends.
	// Newly-persisting findings (just introduced this session) are excluded —
	// they are new problems, not evidence of partial fixing.
	for (const [type, resolved] of typeResolvedCount.entries()) {
		const persisting = typePersistingCount.get(type) ?? 0;
		if (resolved > 0 && persisting > 0) {
			// Mark the still-persisting deltas for this type as 'improving',
			// but skip newly-persisting ones (they aren't improvements)
			for (let i = 0; i < deltas.length; i++) {
				const d = deltas[i];
				if (d.vulnerability.type === type && d.status === 'persisting' && !newlyPersistingIndices.has(i)) {
					(d as { status: VulnerabilityStatus }).status = 'improving';
					improvingTrends++;
					persistingPatterns = Math.max(0, persistingPatterns - 1);
				}
			}
		}
	}

	// ── F/P/T score computation ────────────────────────────────────
	let scores: SessionAnalysis['scores'];
	let typeScores: TypeScoreEntry[] | undefined;

	if (lifecycles && lifecycles.length > 0) {
		const categoryResult = computeCategoryScores(lifecycles);
		const trendResult = computeTrendScore(lifecycles, trendComparisonByKey);

		scores = {
			f: categoryResult.aggregate.f,
			p: categoryResult.aggregate.p,
			tLive: trendResult?.workspaceT ?? null,
			tLabel: trendResult
				? buildTrendLabel(trendResult.workspaceT)
				: null,
		};

		// Build per-CWE type scores
		typeScores = [];
		for (const [key, ts] of categoryResult.byType) {
			const tForKey = trendResult?.byKey[key] ?? null;
			typeScores.push({
				type: ts.type,
				cweId: ts.cweId,
				f: ts.f,
				p: ts.p,
				t: tForKey,
				totalInstances: ts.totalEverObserved,
				resolvedInstances: ts.durablyResolved,
				openInstances: ts.currentlyOpen,
			});
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
		totalIdenticalRestorations,
		totalInSessionToggles,
		scores,
		typeScores,
		newCandidateFindings,
		absentCandidateFindings,
		newPersistingFindings,
		newResolvedFindings,
	};
}

/**
 * Builds a user-facing trend label string like "Some progress (+2.00)".
 */
function buildTrendLabel(t: number): string | null {
	const label = trendLabel(t);
	if (!label) {
		return null;
	}
	return `${label} (${formatTrendDelta(t)})`;
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
// ADAPTER HELPERS
// ══════════════════════════════════════════════════════════════════════

/**
 * Groups vulnerability deltas by type and sums their instance counts.
 *
 * Instead of one row per FLC instance (e.g. "Path Traversal 1" × 8),
 * produces one row per vulnerability type (e.g. "Path Traversal 8").
 */
function groupByType(
	deltas: VulnerabilityDelta[],
	getCount: (d: VulnerabilityDelta) => number,
): TrendSubItem[] {
	const map = new Map<string, TrendSubItem>();
	for (const d of deltas) {
		const type = d.vulnerability.type;
		const existing = map.get(type);
		if (existing) {
			existing.instances += getCount(d);
		} else {
			map.set(type, { type, instances: getCount(d) });
		}
	}
	return [...map.values()];
}

/**
 * Maps CommonVulnerabilityEntry results from the computation engine
 * into the CommonVulnerabilityItem[] shape expected by the panel.
 */
function mapCommonVulns(
	commonVulns?: Map<string, CommonVulnerabilityEntry>,
): CommonVulnerabilityItem[] | undefined {
	if (!commonVulns || commonVulns.size === 0) { return undefined; }

	const items: CommonVulnerabilityItem[] = [];
	for (const entry of commonVulns.values()) {
		items.push({
			type: entry.type,
			cweId: entry.cweId,
			sessionCount: entry.sessionCount,
			totalSessions: entry.totalSessions,
			totalInstanceCount: entry.totalInstanceCount,
			activeFindingCount: entry.activeFindingCount,
		});
	}
	return items;
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
 * Common vulnerability data is passed through from the computation engine.
 */
export function toSessionMetrics(
	analysis: SessionAnalysis,
	commonVulns?: Map<string, CommonVulnerabilityEntry>,
	totalSessionsAnalyzed?: number,
): SessionMetrics {
	// Build per-type sub-items for recurring findings (grouped by type)
	const recurringItems = groupByType(
		analysis.deltas.filter(d => d.status === 'recurring'),
		d => d.currentInstanceCount,
	);

	// Build per-type sub-items for persisting findings (grouped by type)
	const persistingItems: TrendSubItem[] = groupByType(
		analysis.deltas.filter(d => d.status === 'persisting'),
		d => d.currentInstanceCount,
	);

	// Build per-type sub-items for resolved findings (grouped by type)
	const resolvedItems: TrendSubItem[] = groupByType(
		analysis.deltas.filter(d => d.status === 'resolved'),
		d => d.previousInstanceCount,
	);

	// Build per-type sub-items for improving findings with T scores (grouped by type)
	const improvingMap = new Map<string, ImprovingSubItem>();
	for (const d of analysis.deltas.filter(d => d.status === 'improving')) {
		const type = d.vulnerability.type;
		const existing = improvingMap.get(type);
		if (existing) {
			existing.instances += d.currentInstanceCount;
		} else {
			// Look up per-CWE T score from typeScores
			const cweId = d.vulnerability.cwe_id;
			const typeEntry = analysis.typeScores?.find(ts => ts.cweId === cweId);
			const t = typeEntry?.t ?? null;
			const label = t !== null ? trendLabel(t) : null;
			const delta = t !== null ? formatTrendDelta(t) : 'N/A';

			improvingMap.set(type, {
				type,
				instances: d.currentInstanceCount,
				progressLabel: label ?? 'Some progress',
				progressDelta: delta,
			});
		}
	}
	const improvingItems: ImprovingSubItem[] = [...improvingMap.values()];

	// Build trend label string
	const trendLabelStr = analysis.scores?.tLabel ?? undefined;

	let totalSessions = totalSessionsAnalyzed;
	if (totalSessions === undefined && commonVulns && commonVulns.size > 0) {
		totalSessions = commonVulns.values().next().value?.totalSessions;
	}

	return {
		critical: analysis.severityCounts.critical,
		high: analysis.severityCounts.high,
		medium: analysis.severityCounts.medium,
		low: analysis.severityCounts.low,
		trends: {
			persistingPatterns: analysis.persistingPatterns,
			improvingTrends: improvingItems.reduce((sum, item) => sum + item.instances, 0),
			resolvedThisSession: analysis.resolvedThisSession,
			recurringPatterns: analysis.recurringPatterns,
			persistingItems: persistingItems.length > 0 ? persistingItems : undefined,
			improvingItems: improvingItems.length > 0 ? improvingItems : undefined,
			recurringItems: recurringItems.length > 0 ? recurringItems : undefined,
			resolvedItems: resolvedItems.length > 0 ? resolvedItems : undefined,
			fixScore: analysis.scores?.f,
			persistenceScore: analysis.scores?.p,
			trendScore: analysis.scores?.tLive,
			trendLabel: trendLabelStr,
		},
		notifications: generateNotifications(analysis),
		commonVulnerabilities: mapCommonVulns(commonVulns),
		totalSessionsAnalyzed: totalSessions,
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
