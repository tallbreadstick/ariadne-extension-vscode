/**
 * Difference extraction engine for differential session sync.
 */

import type { FindingLifecycleRecord, SessionRecord } from '../../analysis/lifecycleTypes.js';

export interface DiffEngineInput {
	currentLifecycles: readonly FindingLifecycleRecord[];
	currentCompletedSessions: readonly SessionRecord[];
	activeSession: SessionRecord | null;
	knownCompletedSessionIds?: readonly string[];
	lastSyncedTimestamp?: number | null;
	featureCounts: {
		explainVulnerabilityCount: number;
		auditGraphOpenCount: number;
		fileLocationOpenCount: number;
	};
	lastSyncedFeatureCounts?: {
		explainVulnerabilityCount: number;
		auditGraphOpenCount: number;
		fileLocationOpenCount: number;
	} | null;
}

export interface DiffResult {
	newCompletedSessions: SessionRecord[];
	activeSessionUpdate: {
		sessionId: string;
		startedAt: number;
		status: 'completed' | 'incomplete' | 'active';
		latestCheckpoint?: {
			timestamp: number;
			findingsCount: number;
			severityCounts: Record<string, number>;
		};
	} | null;
	upsertLifecycles: FindingLifecycleRecord[];
	featureCountIncrements: {
		explainVulnerabilityDelta: number;
		auditGraphOpenDelta: number;
		fileLocationOpenDelta: number;
	};
}

export function extractDiff(input: DiffEngineInput): DiffResult {
	const lastSync = input.lastSyncedTimestamp ?? 0;
	const knownSessionIds = new Set(input.knownCompletedSessionIds ?? []);

	// 1. Identify completed sessions the server does not know about
	const newCompletedSessions = input.currentCompletedSessions.filter(
		(session) => !knownSessionIds.has(session.sessionId),
	);

	// 2. Identify active session update
	let activeSessionUpdate: DiffResult['activeSessionUpdate'] = null;
	if (input.activeSession) {
		const latestCp = input.activeSession.finalCheckpoint ?? input.activeSession.baselineCheckpoint;
		let severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
		if (latestCp?.findings) {
			for (const f of latestCp.findings) {
				if (f.severity in severityCounts) {
					severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
				}
			}
		}

		activeSessionUpdate = {
			sessionId: input.activeSession.sessionId,
			startedAt: input.activeSession.startedAt,
			status: (input.activeSession.status as 'completed' | 'incomplete') ?? 'active',
			latestCheckpoint: latestCp ? {
				timestamp: latestCp.timestamp,
				findingsCount: latestCp.findings.length,
				severityCounts,
			} : undefined,
		};
	}

	// 3. Identify lifecycles modified or created since lastSyncedTimestamp
	// If lastSync === 0, send all lifecycles
	const upsertLifecycles = input.currentLifecycles.filter((lc) => {
		if (lastSync === 0) {
			return true;
		}
		const lastTouch = Math.max(
			lc.lastConfirmedAt ?? 0,
			lc.firstConfirmedAt ?? 0,
			lc.missingSince ?? 0,
			lc.provisionalResolutionAt ?? 0,
			lc.durableResolutionAt ?? 0,
		);
		return lastTouch >= lastSync;
	});

	// 4. Feature increments
	const prevCounts = input.lastSyncedFeatureCounts ?? {
		explainVulnerabilityCount: 0,
		auditGraphOpenCount: 0,
		fileLocationOpenCount: 0,
	};

	const featureCountIncrements = {
		explainVulnerabilityDelta: Math.max(0, input.featureCounts.explainVulnerabilityCount - prevCounts.explainVulnerabilityCount),
		auditGraphOpenDelta: Math.max(0, input.featureCounts.auditGraphOpenCount - prevCounts.auditGraphOpenCount),
		fileLocationOpenDelta: Math.max(0, input.featureCounts.fileLocationOpenCount - prevCounts.fileLocationOpenCount),
	};

	return {
		newCompletedSessions: [...newCompletedSessions],
		activeSessionUpdate,
		upsertLifecycles: [...upsertLifecycles],
		featureCountIncrements,
	};
}
