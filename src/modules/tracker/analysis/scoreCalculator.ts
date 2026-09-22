/**
 * Score computation for the Ariadne trends framework.
 *
 * Implements Fix Score (F), Persistence Score (P), and Trend Score (T)
 * per the ABEL framework document (Section 9) and the test scenario
 * design decisions.
 *
 * Model:
 * - **Expanding membership** for category-level F/P — new FLCs join the
 *   denominator when they appear.
 * - **Pairwise comparison** for T — uses only the frozen comparison set
 *   (`trendComparisonByKey`) from the previous completed session.
 *   New FLCs discovered since do NOT affect T.
 *
 * No `vscode` import — pure business logic, fully testable.
 *
 * Reference: ABEL-ariadne-trends-framework-finalization.md, Section 9
 *            test_scenario/third-response.md — pairwise T model
 *            test_scenario/fifth-response.md — score range labels
 */

import type {
	FindingLifecycleRecord,
	TrendComparisonBaseline,
} from './lifecycleTypes.js';

// ══════════════════════════════════════════════════════════════════════
// SEVERITY WEIGHTS
// ══════════════════════════════════════════════════════════════════════

/**
 * Severity weights from the framework document (Section 9.1).
 *
 * Used in the P (persistence) formula:
 *   P = min(1, O / B) × W × 10
 */
export const SEVERITY_WEIGHT: Record<string, number> = {
	critical: 1.0,
	high: 0.8,
	medium: 0.6,
	low: 0.4,
};

// ══════════════════════════════════════════════════════════════════════
// OUTPUT TYPES
// ══════════════════════════════════════════════════════════════════════

/**
 * Per-CWE score breakdown.
 */
export interface TypeScore {
	/** Vulnerability type label (e.g. "SQL Injection"). */
	type: string;
	/** CWE identifier used as the grouping key. */
	cweId: string;
	/** Total FLCs ever observed for this CWE (expanding denominator). */
	totalEverObserved: number;
	/** FLCs with durable resolution. */
	durablyResolved: number;
	/** FLCs currently open (not durably resolved). */
	currentlyOpen: number;
	/** Fix Score: (durablyResolved / totalEverObserved) × 10. */
	f: number;
	/** Persistence Score: (currentlyOpen / totalEverObserved) × avgW × 10. */
	p: number;
	/** Average severity weight across FLCs in this group. */
	avgSeverityWeight: number;
}

/**
 * Aggregate result from `computeCategoryScores()`.
 */
export interface CategoryScoreResult {
	/** Per-CWE breakdown. */
	byType: Map<string, TypeScore>;
	/** Workspace-level aggregate scores. */
	aggregate: { f: number; p: number };
}

/**
 * Result from `computeTrendScore()`.
 */
export interface TrendScoreResult {
	/** Workspace-level T (weighted across all CWE keys). */
	workspaceT: number;
	/** Per-CWE T values, keyed same as `trendComparisonByKey`. */
	byKey: Record<string, number>;
	/** User-facing label for the workspace T. */
	label: 'Some progress' | 'Clear progress' | 'Major progress' | null;
}

// ══════════════════════════════════════════════════════════════════════
// CATEGORY SCORES (F / P) — EXPANDING MEMBERSHIP
// ══════════════════════════════════════════════════════════════════════

/**
 * Computes category-level F and P across all ever-observed FLCs.
 *
 * Expanding membership: every FLC ever observed (including those now
 * durably resolved) is included in the denominator.
 *
 * F_category = (durablyResolved / totalEverObserved) × 10
 * P_category = (currentlyOpen / totalEverObserved) × avgSeverityWeight × 10
 *
 * Grouped by CWE key.
 */
export function computeCategoryScores(
	lifecycles: FindingLifecycleRecord[],
): CategoryScoreResult {
	const byType = new Map<string, TypeScore>();

	for (const lc of lifecycles) {
		const key = lc.cweId && lc.cweId.length > 0 ? lc.cweId : (lc.type ?? 'Unknown');
		let entry = byType.get(key);

		if (!entry) {
			entry = {
				type: lc.type,
				cweId: lc.cweId,
				totalEverObserved: 0,
				durablyResolved: 0,
				currentlyOpen: 0,
				f: 0,
				p: 0,
				avgSeverityWeight: 0,
			};
			byType.set(key, entry);
		}

		entry.totalEverObserved += 1;

		if (lc.durableResolutionAt !== null) {
			entry.durablyResolved += 1;
		} else {
			entry.currentlyOpen += 1;
		}

		entry.avgSeverityWeight += (SEVERITY_WEIGHT[lc.severity] ?? 0.4);
	}

	// Compute F and P per type
	let totalResolved = 0;
	let totalObserved = 0;
	let weightedPSum = 0;

	for (const entry of byType.values()) {
		if (entry.totalEverObserved > 0) {
			entry.avgSeverityWeight = entry.avgSeverityWeight / entry.totalEverObserved;
			entry.f = roundScore((entry.durablyResolved / entry.totalEverObserved) * 10);
			entry.p = roundScore((entry.currentlyOpen / entry.totalEverObserved) * entry.avgSeverityWeight * 10);
		}

		totalResolved += entry.durablyResolved;
		totalObserved += entry.totalEverObserved;
		weightedPSum += entry.p * entry.totalEverObserved;
	}

	// Workspace aggregate
	const aggregateF = totalObserved > 0
		? (totalResolved / totalObserved) * 10
		: 0;
	const aggregateP = totalObserved > 0
		? weightedPSum / totalObserved
		: 0;

	return {
		byType,
		aggregate: {
			f: roundScore(aggregateF),
			p: roundScore(aggregateP),
		},
	};
}

// ══════════════════════════════════════════════════════════════════════
// TREND SCORE (T) — PAIRWISE COMPARISON
// ══════════════════════════════════════════════════════════════════════

/**
 * Computes the pairwise Trend score (T) using the frozen comparison
 * set from the previous completed session.
 *
 * For each CWE key in `trendComparisonByKey`:
 *   F_compare_now  = (resolved among comparison FLCs now / denominator) × 10
 *   F_compare_prev = (resolvedAtSourceFinal / denominator) × 10
 *   T_key = F_compare_now − F_compare_prev
 *
 * New FLCs (not in comparison set) affect F_category/P_category only, NOT T.
 *
 * @returns null for Session 1 (no comparison set).
 */
export function computeTrendScore(
	lifecycles: FindingLifecycleRecord[],
	trendComparisonByKey: Record<string, TrendComparisonBaseline> | null | undefined,
): TrendScoreResult | null {
	if (!trendComparisonByKey) {
		return null;
	}

	const keys = Object.keys(trendComparisonByKey);
	if (keys.length === 0) {
		return null;
	}

	// Index current lifecycles by logical fingerprint for O(1) lookup
	const lifecycleByFp = new Map<string, FindingLifecycleRecord>();
	for (const lc of lifecycles) {
		lifecycleByFp.set(lc.logicalFingerprint, lc);
	}

	const byKey: Record<string, number> = {};
	let totalComparisonFLCs = 0;
	let totalResolvedNow = 0;
	let totalResolvedPrev = 0;

	for (const key of keys) {
		const baseline = trendComparisonByKey[key];
		if (!baseline || baseline.denominator === 0) {
			continue;
		}

		let resolvedNowInKey = 0;

		for (const flcId of baseline.flcIds) {
			const lc = lifecycleByFp.get(flcId);
			if (lc && lc.durableResolutionAt !== null) {
				resolvedNowInKey += 1;
			}
		}

		const fNow = (resolvedNowInKey / baseline.denominator) * 10;
		const fPrev = (baseline.resolvedAtSourceFinal / baseline.denominator) * 10;
		byKey[key] = roundScore(fNow - fPrev);

		totalComparisonFLCs += baseline.denominator;
		totalResolvedNow += resolvedNowInKey;
		totalResolvedPrev += baseline.resolvedAtSourceFinal;
	}

	const workspaceT = totalComparisonFLCs > 0
		? roundScore(((totalResolvedNow - totalResolvedPrev) / totalComparisonFLCs) * 10)
		: 0;

	return {
		workspaceT,
		byKey,
		label: trendLabel(workspaceT),
	};
}

// ══════════════════════════════════════════════════════════════════════
// TREND LABEL
// ══════════════════════════════════════════════════════════════════════

/**
 * Maps a numeric T value to a user-facing label.
 *
 * Reference: test_scenario/fifth-response.md
 *
 * | T range     | Label          |
 * |-------------|----------------|
 * | 0 < T < 4   | Some progress  |
 * | 4 ≤ T < 7   | Clear progress |
 * | 7 ≤ T ≤ 10  | Major progress |
 * | T ≤ 0        | null           |
 */
export function trendLabel(
	t: number,
): 'Some progress' | 'Clear progress' | 'Major progress' | null {
	if (t <= 0) {
		return null;
	}
	if (t < 4) {
		return 'Some progress';
	}
	if (t < 7) {
		return 'Clear progress';
	}
	return 'Major progress';
}

/**
 * Formats a T value as a delta string for the UI (e.g. "+2.00", "−1.43").
 */
export function formatTrendDelta(t: number): string {
	const sign = t >= 0 ? '+' : '';
	return `${sign}${t.toFixed(2)}`;
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

/** Rounds a score to 2 decimal places. */
function roundScore(value: number): number {
	return Math.round(value * 100) / 100;
}
