/**
 * Deterministic state hashing for workspace tracking state.
 *
 * Produces a stable SHA-256 hash across finding lifecycles, active session,
 * completed sessions, and metadata.
 */

import * as crypto from 'node:crypto';
import type { FindingLifecycleRecord, SessionRecord } from '../../analysis/lifecycleTypes.js';
import type { SessionMeta } from '../../storage/storageTypes.js';

export interface StateHashInput {
	findingLifecycles: readonly FindingLifecycleRecord[];
	activeSession: SessionRecord | null;
	completedSessions: readonly SessionRecord[];
	sessionMeta: SessionMeta;
}

/**
 * Normalizes an entity to a sorted JSON-compatible object to ensure
 * deterministic serialization independent of property insertion order.
 */
function normalizeForHash(value: unknown): unknown {
	if (value === null || typeof value !== 'object') {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(normalizeForHash);
	}
	const sortedObj: Record<string, unknown> = {};
	const keys = Object.keys(value as Record<string, unknown>).sort();
	for (const key of keys) {
		const val = (value as Record<string, unknown>)[key];
		if (val !== undefined) {
			sortedObj[key] = normalizeForHash(val);
		}
	}
	return sortedObj;
}

/**
 * Calculates a SHA-256 hash of the complete workspace tracking state.
 */
export function computeStateHash(input: StateHashInput): string {
	// Sort lifecycles by logicalFingerprint for consistency
	const sortedLifecycles = [...input.findingLifecycles].sort((a, b) =>
		a.logicalFingerprint.localeCompare(b.logicalFingerprint),
	);

	// Sort completed sessions by sessionId
	const sortedCompletedSessions = [...input.completedSessions].sort((a, b) =>
		a.sessionId.localeCompare(b.sessionId),
	);

	const statePayload = {
		lifecycles: sortedLifecycles.map((lc) => ({
			logicalFingerprint: lc.logicalFingerprint,
			cweId: lc.cweId,
			type: lc.type,
			severity: lc.severity,
			lifecycleState: lc.lifecycleState,
			confirmationCount: lc.confirmationCount,
			recurrenceCount: lc.recurrenceCount,
			baselineOccurrenceCount: lc.baselineOccurrenceCount,
			currentOccurrenceCount: lc.currentOccurrenceCount,
			firstConfirmedAt: lc.firstConfirmedAt,
			lastConfirmedAt: lc.lastConfirmedAt,
			missingSince: lc.missingSince,
			provisionalResolutionAt: lc.provisionalResolutionAt,
			durableResolutionAt: lc.durableResolutionAt,
			isCommentedOut: lc.isCommentedOut,
		})),
		activeSession: input.activeSession ? {
			sessionId: input.activeSession.sessionId,
			startedAt: input.activeSession.startedAt,
			status: input.activeSession.status,
			checkpointTimestamp: input.activeSession.finalCheckpoint?.timestamp
				?? input.activeSession.baselineCheckpoint?.timestamp ?? null,
		} : null,
		completedSessions: sortedCompletedSessions.map((s) => ({
			sessionId: s.sessionId,
			startedAt: s.startedAt,
			endedAt: s.endedAt,
			status: s.status,
		})),
		sessionMeta: {
			scanIdSeed: input.sessionMeta.scanIdSeed,
			sessionIdSeed: input.sessionMeta.sessionIdSeed,
			totalScansCount: input.sessionMeta.totalScansCount,
		},
	};

	const canonicalJson = JSON.stringify(normalizeForHash(statePayload));
	return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/**
 * Computes a stable workspace ID from the workspace root path.
 */
export function computeWorkspaceId(workspaceRoot?: string): string {
	if (!workspaceRoot) {
		return 'default-workspace';
	}
	return crypto.createHash('sha256').update(workspaceRoot.trim().toLowerCase(), 'utf8').digest('hex');
}
