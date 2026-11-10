/**
 * Pure builders for metrics ingest JSON (no vscode import — unit-testable).
 */

import type { ObservedFinding } from '../analysis/lifecycleTypes.js';
import type {
	FindingLifecycleRecord,
	SessionCheckpoint,
	SessionRecord,
} from '../analysis/lifecycleTypes.js';

const INGEST_FORMAT = 'ariadne-metrics-ingest';
const INGEST_VERSION = 1;

export interface SeverityCounts {
	critical: number;
	high: number;
	medium: number;
	low: number;
}

export interface PublicLifecycleSummary {
	cweId: string;
	vulnerabilityType: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	lifecycleState: string;
	confirmationCount: number;
	recurrenceCount: number;
	baselineOccurrenceCount: number;
	currentOccurrenceCount: number;
}

export function countSeverity(findings: Array<{ severity: string }>): SeverityCounts {
	const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
	for (const f of findings) {
		if (f.severity in counts) {
			counts[f.severity as keyof SeverityCounts] += 1;
		}
	}
	return counts;
}

export function aggregateCweCounts(findings: ObservedFinding[]): Array<{ cweId: string; count: number }> {
	const map = new Map<string, number>();
	for (const f of findings) {
		map.set(f.cweId, (map.get(f.cweId) ?? 0) + (f.occurrenceCount > 0 ? f.occurrenceCount : 1));
	}
	return [...map.entries()].map(([cweId, count]) => ({ cweId, count }));
}

export function toPublicLifecycleSummaries(
	lifecycles: FindingLifecycleRecord[],
): PublicLifecycleSummary[] {
	return lifecycles.map((lc) => ({
		cweId: lc.cweId,
		vulnerabilityType: lc.type,
		severity: lc.severity,
		lifecycleState: lc.lifecycleState ?? 'candidate',
		confirmationCount: lc.confirmationCount ?? 0,
		recurrenceCount: lc.recurrenceCount ?? 0,
		baselineOccurrenceCount: lc.baselineOccurrenceCount ?? 0,
		currentOccurrenceCount: lc.currentOccurrenceCount ?? 0,
	}));
}

function epochMsToIso(ms: number): string {
	return new Date(ms).toISOString();
}

function clientBlock(extensionVersion: string, vscodeVersion: string) {
	return {
		extensionVersion,
		vscodeVersion,
		platform: `${process.platform}-${process.arch}`,
	};
}

export function buildSessionFinalizedPayload(
	session: SessionRecord,
	githubAccountId: string,
	extensionVersion: string,
	vscodeVersion: string,
): Record<string, unknown> {
	const status = session.status === 'incomplete' ? 'incomplete' : 'completed';
	const lifecycles = session.lifecycleSummaries ?? [];
	const baselineCount = session.baselineCheckpoint?.findings.length ?? 0;
	const finalCount =
		session.finalCheckpoint?.findings.length
		?? lifecycles.filter((lc) => (lc.currentOccurrenceCount ?? 0) > 0).length;

	const body: Record<string, unknown> = {
		clientSessionId: session.sessionId,
		status,
		startedAt: epochMsToIso(session.startedAt),
		endedAt: epochMsToIso(session.endedAt ?? session.startedAt),
		baselineFindingCount: baselineCount,
		finalFindingCount: finalCount,
		severityCounts: countSeverity(lifecycles),
		lifecycleSummaries: toPublicLifecycleSummaries(lifecycles),
	};

	if (status === 'completed' && session.finalScores) {
		body.finalScores = {
			f: session.finalScores.f,
			p: session.finalScores.p,
			t: session.finalScores.t,
		};
	}

	return {
		format: INGEST_FORMAT,
		version: INGEST_VERSION,
		githubAccountId,
		event: 'session_finalized',
		observedAt: epochMsToIso(session.endedAt ?? Date.now()),
		client: clientBlock(extensionVersion, vscodeVersion),
		session: body,
	};
}

export function buildHourlyCheckpointPayload(
	sessionId: string,
	checkpoint: SessionCheckpoint,
	githubAccountId: string,
	extensionVersion: string,
	vscodeVersion: string,
): Record<string, unknown> {
	return {
		format: INGEST_FORMAT,
		version: INGEST_VERSION,
		githubAccountId,
		event: 'hourly_checkpoint',
		observedAt: epochMsToIso(checkpoint.timestamp),
		client: clientBlock(extensionVersion, vscodeVersion),
		checkpoint: {
			clientSessionId: sessionId,
			checkpointAt: epochMsToIso(checkpoint.timestamp),
			findingCount: checkpoint.findings.length,
			severityCounts: countSeverity(checkpoint.findings),
			cweCounts: aggregateCweCounts(checkpoint.findings),
		},
	};
}
