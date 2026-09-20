/**
 * Common Vulnerabilities computation engine.
 *
 * Identifies which vulnerability *categories* (by `cweId::type`) a student
 * frequently encounters across coding sessions. A type-level awareness
 * metric that operates independently of instance-level lifecycle statuses.
 *
 * Strategy: New-Instance Session Threshold (K) + Prevention-Aware Graduation (G)
 * + Session-Count Reset on Re-entry after Graduation.
 *
 * Counting: Only sessions where a **new** instance of a type was first
 * detected increment the session count. Persisting findings (the same
 * instance carried across milestones) do not inflate the count.
 *
 * Graduation: Requires **both** all instances resolved AND no new instances
 * created for G consecutive completed sessions — proving the student can
 * fix the vulnerability AND has learned to prevent it.
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
	 * Entry threshold: minimum number of milestones in which a vulnerability
	 * type must have a **new** instance first detected to be classified as
	 * Common.
	 *
	 * Set to 3 to align with a 3-hour weekly laboratory session
	 * where hourly full-scan checkpoints occur at hours 1, 2, and 3.
	 * A single persisting finding does NOT reach this threshold on its own.
	 */
	K: 3,

	/**
	 * Graduation threshold: minimum consecutive completed sessions with
	 * no new instances of this type AND all existing instances resolved.
	 *
	 * Proves the student can both **fix** the vulnerability and **prevent**
	 * creating new ones. One clean session could be coincidence; two across
	 * spaced intervals suggests internalization.
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
	 * Completed session index after which this type last graduated.
	 * Milestones at or before this session are skipped on re-entry.
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
	/** Number of milestones this type was present in (post-graduation). */
	sessionCount: number;
	/** Total milestones analyzed. */
	totalSessions: number;
	/** Whether this type has graduated (always false in returned results). */
	isGraduated: boolean;
	/** Sum of recurrenceCount across all FLCs of this type. */
	totalRecurrences: number;
	/**
	 * Total finding instances of this type (active + resolved + missing).
	 * Represents how many times the student has encountered this pattern.
	 */
	totalInstanceCount: number;
	/** Count of active (unresolved, not missing) findings of this type. */
	activeFindingCount: number;
}

// ══════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ══════════════════════════════════════════════════════════════════════

/** Minimal finding shape carried through each milestone. */
interface MilestoneFinding {
	cweId: string;
	type: string;
	logicalFingerprint: string;
}

/** A single milestone in the chronological session timeline. */
interface Milestone {
	findings: MilestoneFinding[];
	/**
	 * Index into the `completedSessions` array that this milestone belongs to,
	 * or -1 for milestones from the active session (not yet finalized).
	 */
	completedSessionIdx: number;
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
 * A vulnerability TYPE is "Common" if **new** instances of it were first
 * detected in >= K milestones (counting only from the last graduation
 * point) and it has not graduated. Graduation requires both all instances
 * resolved AND no new instances for >= G consecutive completed sessions.
 *
 * @param completedSessions  All completed SessionRecords (chronological)
 * @param activeSession      The current active session (null if none)
 * @param currentLifecycles  Live FindingLifecycleRecord[] for active session
 * @param graduationHistory  Per-type graduation state (persisted, mutated in-place)
 * @param K                  New-instance session threshold (default: 3)
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

	// ── Phase 1: Build milestone list with fingerprints ─────────────
	//
	// Each completed session expands into:
	//   hourlyCheckpoint[0], hourlyCheckpoint[1], ..., sessionFinal
	// Each carries logicalFingerprint so Phase 2 can distinguish
	// new instances from persisting ones.

	const milestones: Milestone[] = [];

	for (let csIdx = 0; csIdx < completedSessions.length; csIdx++) {
		const cs = completedSessions[csIdx];

		// Hourly checkpoints within this completed session
		if (cs.hourlyCheckpoints && cs.hourlyCheckpoints.length > 0) {
			for (const cp of cs.hourlyCheckpoints) {
				milestones.push({
					findings: cp.findings.map(f => ({
						cweId: f.cweId,
						type: f.type,
						logicalFingerprint: f.logicalFingerprint,
					})),
					completedSessionIdx: csIdx,
				});
			}
		}

		// Completed session final state
		milestones.push({
			findings: cs.lifecycleSummaries.map(flc => ({
				cweId: flc.cweId,
				type: flc.type,
				logicalFingerprint: flc.logicalFingerprint,
			})),
			completedSessionIdx: csIdx,
		});
	}

	if (activeSession) {
		// Hourly checkpoints within the active session
		if (activeSession.hourlyCheckpoints && activeSession.hourlyCheckpoints.length > 0) {
			for (const cp of activeSession.hourlyCheckpoints) {
				milestones.push({
					findings: cp.findings.map(f => ({
						cweId: f.cweId,
						type: f.type,
						logicalFingerprint: f.logicalFingerprint,
					})),
					completedSessionIdx: -1,
				});
			}
		}

		// Active session current live state
		milestones.push({
			findings: currentLifecycles.map(flc => ({
				cweId: flc.cweId,
				type: flc.type,
				logicalFingerprint: flc.logicalFingerprint,
			})),
			completedSessionIdx: -1,
		});
	}

	const totalMilestones = milestones.length;

	// ── Phase 2: Session-presence counting + new-instance tracking ──
	//
	// Session-presence counting for K: a type's session count increments
	// when it is present in a milestone (regardless of whether the
	// instance is new or persisting). This aligns with the lab model.
	//
	// New-instance tracking for G: a cumulative fingerprint set tracks
	// which instances are genuinely new. Only used by the graduation
	// check (csNewTypes) to determine if the student stopped creating
	// new instances.

	const typeData = new Map<string, {
		type: string;
		cweId: string;
		sessionCount: number;
	}>();

	/** Per-type cumulative fingerprints already seen (since graduation). */
	const seenByType = new Map<string, Set<string>>();

	/**
	 * Per completed session: which types had at least one new instance
	 * in any of the session's milestones (hourly checkpoints + final).
	 * Used by the graduation G-check.
	 */
	const csNewTypes: Array<Set<string>> = completedSessions.map(() => new Set());

	for (const [mIdx, milestone] of milestones.entries()) {
		const typesPresent = new Set<string>();
		const newTypesHere = new Set<string>();

		for (const f of milestone.findings) {
			const key = typeKey(f.cweId, f.type);

			// Skip milestones at or before the graduated session for this type,
			// but still seed the fingerprint tracker so post-graduation milestones
			// don't treat these already-known instances as "new".
			const gradState = graduationHistory[key];
			const gradAfterSession = gradState?.graduatedAfterSessionIndex ?? -1;
			if (milestone.completedSessionIdx >= 0 && milestone.completedSessionIdx <= gradAfterSession) {
				if (!seenByType.has(key)) { seenByType.set(key, new Set()); }
				seenByType.get(key)!.add(f.logicalFingerprint);
				continue;
			}
			// For active-session milestones (completedSessionIdx === -1), always process

			// Session-presence for K threshold
			typesPresent.add(key);

			// New-instance tracking for G graduation check
			if (!seenByType.has(key)) {
				seenByType.set(key, new Set());
			}
			const seen = seenByType.get(key)!;
			if (!seen.has(f.logicalFingerprint)) {
				seen.add(f.logicalFingerprint);
				newTypesHere.add(key);
			}
		}

		// Update session counts (presence-based for K)
		for (const key of typesPresent) {
			const sample = milestone.findings.find(
				f => typeKey(f.cweId, f.type) === key,
			)!;
			const entry = typeData.get(key) ?? {
				type: sample.type,
				cweId: sample.cweId,
				sessionCount: 0,
			};
			entry.sessionCount++;
			typeData.set(key, entry);
		}

		// Track per-completed-session new types (for graduation only)
		for (const key of newTypesHere) {
			if (milestone.completedSessionIdx >= 0) {
				csNewTypes[milestone.completedSessionIdx].add(key);
			}
		}
	}

	// ── Phase 3: Graduation check and result ────────────────────────
	//
	// A type graduates when BOTH conditions are met simultaneously:
	// 1. All current FLCs of this type are durably resolved (can fix)
	// 2. No new instances were created in the G most recent completed
	//    sessions (can prevent)

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

		// Count consecutive completed sessions (from most recent backwards)
		// with no new instances of this type, BUT only sessions that started
		// AFTER the latest resolution timestamp. This ensures G clean sessions
		// happen AFTER the student fixed everything, not before.
		let consecutiveNoNew = 0;
		if (allResolved) {
			// Find the latest resolution timestamp across all FLCs of this type
			const latestResolution = Math.max(
				...typeFLCs.map(flc => flc.durableResolutionAt ?? 0),
			);

			for (let i = completedSessions.length - 1; i >= 0; i--) {
				// Only count sessions that started after the fix was applied
				if (completedSessions[i].startedAt < latestResolution) { break; }
				if (csNewTypes[i].has(key)) { break; }
				consecutiveNoNew++;
			}
		}

		const graduated = allResolved && consecutiveNoNew >= G;

		if (graduated) {
			// Record graduation using the completed session index (stable
			// across milestone recalculations, unlike milestone index)
			graduationHistory[key] = {
				graduatedAfterSessionIndex: completedSessions.length - 1,
			};
			continue; // Graduated types are not Common
		}

		const totalRecurrences = typeFLCs.reduce(
			(sum, flc) => sum + flc.recurrenceCount, 0,
		);
		const totalInstanceCount = typeFLCs.length;
		const activeFindingCount = typeFLCs.filter(
			flc => flc.missingSince === null && flc.durableResolutionAt === null,
		).length;

		common.set(key, {
			type: data.type,
			cweId: data.cweId,
			sessionCount: data.sessionCount,
			totalSessions: totalMilestones,
			isGraduated: false,
			totalRecurrences,
			totalInstanceCount,
			activeFindingCount,
		});
	}

	// ── Sort descending ─────────────────────────────────────────────
	// Primary: highest totalInstanceCount (most frequently encountered)
	// Secondary: highest sessionCount (spread across sessions)
	// Tertiary: alphabetical by type
	const sortedEntries = Array.from(common.entries()).sort(([, a], [, b]) => {
		if (b.totalInstanceCount !== a.totalInstanceCount) {
			return b.totalInstanceCount - a.totalInstanceCount;
		}
		if (b.sessionCount !== a.sessionCount) {
			return b.sessionCount - a.sessionCount;
		}
		return a.type.localeCompare(b.type);
	});

	return new Map(sortedEntries);
}

