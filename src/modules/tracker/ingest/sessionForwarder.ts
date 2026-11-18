/**
 * Session data forwarder with differential synchronization and chunking (API v2).
 *
 * Implements state-hash handshakes and delta diffing:
 *  - Computes workspace state hash (SHA-256).
 *  - Sends a lightweight handshake (`/v1/session-forward/handshake`).
 *  - If server state is up-to-date, halts immediately (0 data transferred).
 *  - If diff needed, extracts modified entities and feature deltas.
 *  - Compresses diffs with Gzip.
 *  - Slices across multiple chunk requests if payload exceeds threshold.
 *  - Gracefully falls back to legacy endpoint (`/v1/session-forward`) if
 *    server does not yet support v2 routes (404/405).
 */

import * as http from 'node:http';
import * as https from 'node:https';
import * as vscode from 'vscode';
import type { SessionStore } from '../storage/sessionStore.js';
import type { MetricsIngestConfig } from './metricsIngestConfig.js';
import { loadMetricsIngestConfig } from './metricsIngestConfig.js';
import type { AuthStorage } from '../../feedback/auth/authStorage.js';
import { computeStateHash, computeWorkspaceId } from './diff/stateHasher.js';
import { extractDiff } from './diff/diffEngine.js';
import { sliceDiffPayload, compressGzip, type DiffChunkPayload } from './diff/chunker.js';

export interface SessionFeatureCounts {
	explainVulnerabilityCount: number;
	auditGraphOpenCount: number;
	fileLocationOpenCount: number;
}

interface HandshakeResponse {
	status: 'up-to-date' | 'need-diff';
	serverStateHash?: string;
	knownCompletedSessionIds?: string[];
	lastSyncedTimestamp?: number;
}

interface DiffAckResponse {
	success: boolean;
	chunkReceived?: number;
	chunksRemaining?: number;
	currentServerStateHash?: string;
	error?: string;
}

const DEBOUNCE_MS = 60_000; // 1 minute

function allowInsecureTls(hostname: string, trustLocalTls: boolean): boolean {
	return trustLocalTls && (hostname === '127.0.0.1' || hostname === 'localhost');
}

/**
 * Generic HTTP POST request helper supporting raw string or gzip buffer payloads.
 */
function requestPost(
	config: MetricsIngestConfig,
	path: string,
	data: Buffer | string,
	extraHeaders: Record<string, string> = {},
): Promise<{ statusCode: number; body: string }> {
	const url = new URL(path, `${config.baseUrl}/`);
	const isHttps = url.protocol === 'https:';
	const lib = isHttps ? https : http;

	const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

	return new Promise((resolve, reject) => {
		const options: https.RequestOptions = {
			hostname: url.hostname,
			port: url.port || (isHttps ? 443 : 80),
			path: `${url.pathname}${url.search}`,
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
				'Content-Length': buffer.length,
				...extraHeaders,
			},
			...(isHttps && allowInsecureTls(url.hostname, config.trustLocalTls)
				? { rejectUnauthorized: false }
				: {}),
		};

		const req = lib.request(options, (res) => {
			let text = '';
			res.on('data', (chunk) => { text += String(chunk); });
			res.on('end', () => {
				resolve({
					statusCode: res.statusCode ?? 500,
					body: text,
				});
			});
		});

		req.on('error', reject);
		req.setTimeout(15_000, () => {
			req.destroy(new Error(`Request to ${path} timed out`));
		});
		req.write(buffer);
		req.end();
	});
}

export class SessionForwarder {
	private readonly counts: SessionFeatureCounts = {
		explainVulnerabilityCount: 0,
		auditGraphOpenCount: 0,
		fileLocationOpenCount: 0,
	};

	private lastSyncedFeatureCounts: SessionFeatureCounts = {
		explainVulnerabilityCount: 0,
		auditGraphOpenCount: 0,
		fileLocationOpenCount: 0,
	};

	private lastKnownAccountId: string | null = null;
	private lastSyncedStateHash: string | null = null;
	private lastSyncedTimestamp: number | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly store: SessionStore,
		private readonly authStorage: AuthStorage,
	) {
		this.lastKnownAccountId = context.globalState.get<string>('ariadne.lastKnownGithubAccountId') ?? null;
		this.lastSyncedStateHash = context.workspaceState.get<string>('ariadne.lastSyncedStateHash') ?? null;
		this.lastSyncedTimestamp = context.workspaceState.get<number>('ariadne.lastSyncedTimestamp') ?? null;

		const savedCounts = context.workspaceState.get<SessionFeatureCounts>('ariadne.lastSyncedFeatureCounts');
		if (savedCounts) {
			this.lastSyncedFeatureCounts = { ...savedCounts };
		}

		context.subscriptions.push(
			vscode.authentication.onDidChangeSessions((event) => {
				if (event.provider.id === 'github') {
					void this.resolveAccountId();
				}
			}),
		);
	}

	recordExplainVulnerability(): void {
		this.counts.explainVulnerabilityCount += 1;
	}

	recordAuditGraphOpen(): void {
		this.counts.auditGraphOpenCount += 1;
	}

	recordFileLocationOpen(): void {
		this.counts.fileLocationOpenCount += 1;
	}

	/** Schedules a forward after the 1-minute debounce window. */
	scheduleForward(): void {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.dispatch('save');
		}, DEBOUNCE_MS);
	}

	/** Cancels any pending debounce and forwards immediately. */
	forwardNow(): void {
		if (this.debounceTimer !== null) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		void this.dispatch('close');
	}

	private async dispatch(trigger: 'save' | 'close'): Promise<void> {
		try {
			const config = await loadMetricsIngestConfig(this.context);
			if (!config) {
				return;
			}

			const clientId = await this.resolveAccountId();
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const workspaceId = computeWorkspaceId(workspaceFolder);

			const currentLifecycles = this.store.loadFindingLifecycles();
			const activeSession = this.store.loadActiveSession();
			const completedSessions = this.store.loadCompletedSessions();
			const sessionMeta = this.store.loadSessionMeta();

			// 1. Calculate local deterministic state hash
			const clientStateHash = computeStateHash({
				findingLifecycles: currentLifecycles,
				activeSession,
				completedSessions,
				sessionMeta,
			});

			// If local state hasn't changed since last confirmed sync, skip network call
			if (
				trigger === 'save'
				&& this.lastSyncedStateHash === clientStateHash
				&& this.counts.explainVulnerabilityCount === this.lastSyncedFeatureCounts.explainVulnerabilityCount
				&& this.counts.auditGraphOpenCount === this.lastSyncedFeatureCounts.auditGraphOpenCount
				&& this.counts.fileLocationOpenCount === this.lastSyncedFeatureCounts.fileLocationOpenCount
			) {
				console.log('[Ariadne Sync] Workspace state unchanged. Skipping forward.');
				return;
			}

			// 2. Perform Handshake with server
			const handshakePayload = {
				format: 'ariadne-sync-handshake',
				version: 2,
				timestamp: new Date().toISOString(),
				clientId,
				workspaceId,
				clientStateHash,
				meta: {
					sessionIdSeed: sessionMeta.sessionIdSeed,
					totalScansCount: sessionMeta.totalScansCount,
				},
			};

			let handshakeRes = await requestPost(
				config,
				'/v1/session-forward/handshake',
				JSON.stringify(handshakePayload),
			);

			// Fallback: If server does not implement /handshake (404/405), fallback to legacy v1 snapshot
			if (handshakeRes.statusCode === 404 || handshakeRes.statusCode === 405) {
				console.log('[Ariadne Sync] Backend does not support handshake v2. Falling back to legacy snapshot.');
				await this.dispatchLegacy(config, trigger, clientId);
				return;
			}

			if (handshakeRes.statusCode < 200 || handshakeRes.statusCode >= 300) {
				throw new Error(`Handshake HTTP ${handshakeRes.statusCode}: ${handshakeRes.body.slice(0, 200)}`);
			}

			let handshakeData: HandshakeResponse;
			try {
				handshakeData = JSON.parse(handshakeRes.body) as HandshakeResponse;
			} catch {
				throw new Error('Invalid JSON received from handshake endpoint');
			}

			// 3. Evaluate handshake result
			if (handshakeData.status === 'up-to-date') {
				console.log(`[Ariadne Sync] Server reports state is up-to-date (${clientStateHash.slice(0, 8)}...).`);
				await this.recordSyncSuccess(clientStateHash, Date.now());
				return;
			}

			// 4. Extract diff
			const diff = extractDiff({
				currentLifecycles,
				currentCompletedSessions: completedSessions,
				activeSession,
				knownCompletedSessionIds: handshakeData.knownCompletedSessionIds,
				lastSyncedTimestamp: handshakeData.lastSyncedTimestamp ?? this.lastSyncedTimestamp,
				featureCounts: this.counts,
				lastSyncedFeatureCounts: this.lastSyncedFeatureCounts,
			});

			// 5. Slice into chunk payloads
			const chunks = sliceDiffPayload(diff, {
				trigger,
				clientId,
				workspaceId,
				baseStateHash: handshakeData.serverStateHash ?? null,
				targetStateHash: clientStateHash,
				client: {
					extensionVersion: this.context.extension.packageJSON.version ?? '0.0.0',
					vscodeVersion: vscode.version,
					platform: `${process.platform}-${process.arch}`,
				},
			});

			console.log(`[Ariadne Sync] Transmitting differential update (${chunks.length} chunk(s))...`);

			// 6. Post each chunk with Gzip compression
			for (const chunk of chunks) {
				const compressedBuffer = await compressGzip(chunk);
				const diffRes = await requestPost(
					config,
					'/v1/session-forward/diff',
					compressedBuffer,
					{ 'Content-Encoding': 'gzip' },
				);

				if (diffRes.statusCode < 200 || diffRes.statusCode >= 300) {
					throw new Error(`Diff chunk ${chunk.chunk.index}/${chunk.chunk.totalChunks} HTTP ${diffRes.statusCode}: ${diffRes.body.slice(0, 200)}`);
				}

				const diffAck = JSON.parse(diffRes.body) as DiffAckResponse;
				if (!diffAck.success) {
					throw new Error(`Diff rejected: ${diffAck.error ?? 'Unknown error'}`);
				}
			}

			await this.recordSyncSuccess(clientStateHash, Date.now());
			console.log(`[Ariadne Sync] Differential sync completed successfully (${chunks.length} chunk(s)).`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn('[Ariadne Sync] Session data forward failed:', message);
		}
	}

	/**
	 * Fallback to legacy single-shot forwarder if server is older version.
	 */
	private async dispatchLegacy(
		config: MetricsIngestConfig,
		trigger: 'save' | 'close',
		clientId: string | null,
	): Promise<void> {
		const payload = {
			format: 'ariadne-session-forward',
			version: 1,
			forwardedAt: new Date().toISOString(),
			trigger,
			sessionSnapshot: this.store.exportSessionSnapshot(),
			featureCounts: { ...this.counts },
			client: {
				extensionVersion: this.context.extension.packageJSON.version ?? '0.0.0',
				vscodeVersion: vscode.version,
				platform: `${process.platform}-${process.arch}`,
			},
			githubAccountId: clientId,
			githubUsername: clientId,
		};
		const res = await requestPost(
			config,
			'/v1/session-forward',
			JSON.stringify(payload),
		);
		if (res.statusCode >= 200 && res.statusCode < 300) {
			console.log(`[Ariadne] Session data forwarded via legacy route (trigger: ${trigger}).`);
		} else {
			throw new Error(`Legacy forward HTTP ${res.statusCode}: ${res.body.slice(0, 200)}`);
		}
	}

	private async recordSyncSuccess(stateHash: string, timestamp: number): Promise<void> {
		this.lastSyncedStateHash = stateHash;
		this.lastSyncedTimestamp = timestamp;
		this.lastSyncedFeatureCounts = { ...this.counts };

		await this.context.workspaceState.update('ariadne.lastSyncedStateHash', stateHash);
		await this.context.workspaceState.update('ariadne.lastSyncedTimestamp', timestamp);
		await this.context.workspaceState.update('ariadne.lastSyncedFeatureCounts', this.lastSyncedFeatureCounts);
	}

	private async resolveAccountId(): Promise<string | null> {
		try {
			let id: string | null = null;

			let liveSession = await vscode.authentication.getSession(
				'github',
				['read:user', 'user:email'],
				{ silent: true },
			);

			if (!liveSession) {
				liveSession = await vscode.authentication.getSession('github', ['read:user'], { silent: true });
			}
			if (!liveSession) {
				liveSession = await vscode.authentication.getSession('github', [], { silent: true });
			}

			if (liveSession) {
				id = liveSession.account.id;
			}

			if (!id) {
				const meta = await this.authStorage.loadSessionMeta();
				id = meta?.accountId?.trim() ?? null;
			}

			id = id || this.lastKnownAccountId;

			if (id && id !== this.lastKnownAccountId) {
				this.lastKnownAccountId = id;
				void this.context.globalState.update('ariadne.lastKnownGithubAccountId', id);
			}

			return id && /^[0-9]+$/.test(id) ? id : null;
		} catch {
			return this.lastKnownAccountId;
		}
	}
}
