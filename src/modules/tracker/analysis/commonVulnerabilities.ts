/**
 * Common Vulnerabilities computation engine.
 *
 * Identifies which vulnerability *categories* (by `cweId::type`) a student
 * frequently encounters across coding sessions. A type-level awareness
 * metric that operates independently of instance-level lifecycle statuses.
 *
 * Strategy: Session-Boundary Threshold (K) + Resolution-Aware Decay (G)
 * + Session-Count Reset on Graduation Revocation.
 *
 * Reference: docs/handoff/common_vuln_implementation_plan.md
 *
 * Consumed by:
 * - `snapshotAnalyzer.ts` — maps results into SessionMetrics for the panel
 * - `extension.ts`        — orchestrates computation in the settled scan flow
 */

import type { FindingLifecycleRecord, SessionRecord } from './lifecycleTypes.js';

// ══════════════════════════════════════════════════════════════════════
// POLICY CONSTANTS
// ══════════════════════════════════════════════════════════════════════

/**
 * Configurable policy constants for Common Vulnerability classification.
 *
 * These are initial values for pilot deployment, subject to empirical
 * tuning. See the literature justification document for defense rationale.
 */
export const COMMON_VULN_POLICY = {
	/**
	 * Entry threshold: minimum number of sessions a vulnerability type
	 * must appear in to be classified as Common.
	 *
	 * Set to 3 to align with a 3-hour weekly laboratory session
	 * where hourly full-scan checkpoints occur at hours 1, 2, and 3.
	 */
	K: 3,

	/**
	 * Graduation threshold: minimum consecutive clean sessions
	 * (all FLCs resolved, no new instances) required to graduate.
	 *
	 * One clean session could be coincidence; two across spaced
	 * intervals suggests internalization.
	 */
	G: 2,
} as const;

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════

/**
 * Tracks graduation history for a single vulnerability type.
 *
 * Persisted alongside session data in workspaceState so session-count
 * reset survives VS Code restarts.
 */
export interface TypeGraduationState {
	/**
	 * Index into completedSessions after which this type last graduated.
	 * Null if the type has never graduated.
	 */
	graduatedAfterSessionIndex: number | null;
}

/** Result for a single Common Vulnerability type. */
export interface CommonVulnerabilityEntry {
	/** Vulnerability type label (e.g. "SQL Injection"). */
	type: string;
	/** CWE identifier (e.g. "CWE-89"). */
	cweId: string;
	/** Number of sessions this type appeared in (post-graduation). */
	sessionCount: number;
	/** Total sessions analyzed. */
	totalSessions: number;
	/** Whether this type has graduated (always false in returned results). */
	isGraduated: boolean;
	/** Sum of recurrenceCount across all FLCs of this type. */
	totalRecurrences: number;
	/** Count of active (unresolved, not missing) findings of this type. */
	activeFindingCount: number;
}

// ══════════════════════════════════════════════════════════════════════
// COMPUTATION
// ══════════════════════════════════════════════════════════════════════

/**
 * Builds the type key used to group findings by vulnerability category.
 *
 * @returns A string like `"CWE-89::SQL Injection"`
 */
function typeKey(cweId: string, type: string): string {
	return `${cweId}::${type}`;
}

/**
 * Computes Common Vulnerabilities across all sessions.
 *
 * A vulnerability TYPE is "Common" if it appeared in >= K sessions
 * (counting only from the last graduation point) and has not graduated
 * (all findings resolved for >= G consecutive recent sessions).
 *
 * @param completedSessions  All completed SessionRecords (chronological)
 * @param activeSession      The current active session (null if none)
 * @param currentLifecycles  Live FindingLifecycleRecord[] for active session
 * @param graduationHistory  Per-type graduation state (persisted, mutated in-place)
 * @param K                  Session-presence threshold (default: 3)
 * @param G                  Graduation threshold (default: 2)
 * @returns Map of type key → CommonVulnerabilityEntry for qualifying types
 */
export function computeCommonVulnerabilities(
	completedSessions: SessionRecord[],
	activeSession: SessionRecord | null,
	currentLifecycles: FindingLifecycleRecord[],
	graduationHistory: Record<string, TypeGraduationState>,
	K: number = COMMON_VULN_POLICY.K,
	G: number = COMMON_VULN_POLICY.G,
): Map<string, CommonVulnerabilityEntry> {

	// Build list of all sessions (completed + active)
	const allSessions: SessionRecord[] = [...completedSessions];
	if (activeSession) {
		allSessions.push({
			...activeSession,
			lifecycleSummaries: currentLifecycles,
		});
	}

	const totalSessions = allSessions.length;

	// Step 1: Count session presence per type (from last graduation point)
	const typeData = new Map<string, {
		type: string;
		cweId: string;
		sessionCount: number;
	}>();

	for (const [sessionIdx, session] of allSessions.entries()) {
		const typesInSession = new Set<string>();

		for (const flc of session.lifecycleSummaries) {
			const key = typeKey(flc.cweId, flc.type);
			if (typesInSession.has(key)) { continue; }
			typesInSession.add(key);

			// Only count sessions AFTER the last graduation point
			const gradState = graduationHistory[key];
			const countFrom = gradState?.graduatedAfterSessionIndex ?? -1;
			if (sessionIdx <= countFrom) { continue; }

			const entry = typeData.get(key) ?? {
				type: flc.type,
				cweId: flc.cweId,
				sessionCount: 0,
			};
			entry.sessionCount++;
			typeData.set(key, entry);
		}
	}

	// Step 2: Check graduation and build result
	const common = new Map<string, CommonVulnerabilityEntry>();

	for (const [key, data] of typeData) {
		if (data.sessionCount < K) { continue; }

		// Aggregate lifecycle data for this type from current state
		const typeFLCs = currentLifecycles.filter(
			flc => typeKey(flc.cweId, flc.type) === key,
		);

		const allResolved = typeFLCs.length > 0 && typeFLCs.every(
			flc => flc.durableResolutionAt !== null,
		);

		// Count consecutive recent clean sessions (walk backwards through completed only)
		let consecutiveClean = 0;
		if (allResolved) {
			for (let i = completedSessions.length - 1; i >= 0; i--) {
				const hasActive = completedSessions[i].lifecycleSummaries.some(
					flc => typeKey(flc.cweId, flc.type) === key
						&& flc.durableResolutionAt === null
						&& flc.missingSince === null,
				);
				if (hasActive) { break; }
				consecutiveClean++;
			}
		}

		const graduated = allResolved && consecutiveClean >= G;

		if (graduated) {
			// Record graduation point for future session-count reset
			graduationHistory[key] = {
				graduatedAfterSessionIndex: completedSessions.length - 1,
			};
			continue; // Graduated types are not Common
		}

		const totalRecurrences = typeFLCs.reduce(
			(sum, flc) => sum + flc.recurrenceCount, 0,
		);
		const activeFindingCount = typeFLCs.filter(
			flc => flc.missingSince === null && flc.durableResolutionAt === null,
		).length;

		common.set(key, {
			type: data.type,
			cweId: data.cweId,
			sessionCount: data.sessionCount,
			totalSessions,
			isGraduated: false,
			totalRecurrences,
			activeFindingCount,
		});
	}
 
	// Step 3: Sort common vulnerabilities descending (highest sessionCount first, then activeFindingCount)
	const sortedEntries = Array.from(common.entries()).sort(([, a], [, b]) => {
		if (b.sessionCount !== a.sessionCount) {
			return b.sessionCount - a.sessionCount;
		}
		if (b.activeFindingCount !== a.activeFindingCount) {
			return b.activeFindingCount - a.activeFindingCount;
		}
		return a.type.localeCompare(b.type);
	});

	return new Map(sortedEntries);
}

