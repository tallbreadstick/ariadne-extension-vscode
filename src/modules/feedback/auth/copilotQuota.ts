/**
 * Copilot account quota helpers (via SDK account.getQuota RPC).
 */

import type { CopilotRuntimeOptions } from '../llm_request/copilotRuntime.js';
import type { CopilotClientManager } from '../llm_request/copilotClientManager.js';

const QUOTA_TYPE_PRIORITY = [
	'premium_interactions',
	'chat',
	'completions',
	'agent_sessions',
] as const;

export interface CopilotQuotaUsage {
	/** Human-readable quota category (e.g. "Premium interactions"). */
	label: string;
	/** Percentage of entitlement remaining (0–100). */
	remainingPercent: number;
	/** Percentage of entitlement used this period (0–100). */
	usedPercent: number;
	usedRequests: number;
	entitlementRequests: number;
	isUnlimited: boolean;
	resetDate?: string;
}

function formatQuotaLabel(type: string): string {
	return type
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function pickQuotaSnapshot(
	snapshots: Record<string, {
		isUnlimitedEntitlement: boolean;
		entitlementRequests: number;
		usedRequests: number;
		remainingPercentage: number;
		resetDate?: string;
	} | undefined>,
): { type: string; snapshot: NonNullable<typeof snapshots[string]> } | undefined {
	for (const type of QUOTA_TYPE_PRIORITY) {
		const snapshot = snapshots[type];
		if (snapshot) {
			return { type, snapshot };
		}
	}

	const fallbackType = Object.keys(snapshots)[0];
	if (!fallbackType || !snapshots[fallbackType]) {
		return undefined;
	}

	return { type: fallbackType, snapshot: snapshots[fallbackType]! };
}

/**
 * Fetches Copilot usage quota for the signed-in user via the warm SDK client.
 */
export async function fetchCopilotQuotaUsage(
	manager: CopilotClientManager,
	options: CopilotRuntimeOptions,
): Promise<CopilotQuotaUsage | undefined> {
	try {
		const client = await manager.getClient(options);
		const result = await client.rpc.account.getQuota({
			gitHubToken: options.gitHubToken,
		});

		const picked = pickQuotaSnapshot(result.quotaSnapshots);
		if (!picked) {
			return undefined;
		}

		const { type, snapshot } = picked;
		const remainingPercent = Math.max(
			0,
			Math.min(100, Math.round(snapshot.remainingPercentage)),
		);
		const usedPercent = snapshot.isUnlimitedEntitlement
			? 0
			: Math.max(0, Math.min(100, 100 - remainingPercent));

		return {
			label: formatQuotaLabel(type),
			remainingPercent,
			usedPercent,
			usedRequests: snapshot.usedRequests,
			entitlementRequests: snapshot.entitlementRequests,
			isUnlimited: snapshot.isUnlimitedEntitlement,
			resetDate: snapshot.resetDate,
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[Ariadne] Could not fetch Copilot quota:', message);
		return undefined;
	}
}
