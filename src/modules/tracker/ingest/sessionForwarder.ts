/**
 * Session data forwarder.
 *
 * Sends the full session export snapshot plus per-session feature usage
 * counts to the collection server endpoint whenever the user saves or
 * closes the editor.
 *
 * Trigger rules:
 *  - On save: a 60-second debounce prevents spam from repeated saves.
 *    The timer is reset on each save and fires only when the user stops
 *    saving for a full minute.
 *  - On editor close: the pending timer is cancelled and a forward is
 *    dispatched immediately (fire-and-forget) so data is not lost.
 *
 * Network calls are always asynchronous and never block the caller.
 *
 * ── Endpoint configuration ────────────────────────────────────────────
 * The target URL is composed from the existing `ariadne.metricsIngest`
 * VS Code settings block:
 *
 *   ariadne.metricsIngest.enabled   — set false to disable forwarding
 *   ariadne.metricsIngest.baseUrl   — base URL of the collection server
 *                                     (default: https://127.0.0.1:8080)
 *   ariadne.metricsIngest.apiKey    — Bearer token (≥ 32 chars)
 *   ariadne.metricsIngest.trustLocalTls — allow self-signed certs for localhost
 *
 * The forwarder posts to:  <baseUrl>/v1/session-forward
 *
 * To point this at your deployed collection server, update
 * `ariadne.metricsIngest.baseUrl` in VS Code settings (Settings →
 * search "Ariadne Metrics Ingest").  The same API key used for other
 * metrics ingest calls is reused for authentication.
 */

import * as http from 'node:http';
import * as https from 'node:https';
import * as vscode from 'vscode';
import type { SessionStore } from '../storage/sessionStore.js';
import type { MetricsIngestConfig } from './metricsIngestConfig.js';
import { loadMetricsIngestConfig } from './metricsIngestConfig.js';
import type { AuthStorage } from '../../feedback/auth/authStorage.js';
/** Counts of user interactions with the three tracked features. */
export interface SessionFeatureCounts {
	explainVulnerabilityCount: number;
	auditGraphOpenCount: number;
	fileLocationOpenCount: number;
}

/** Full payload sent to the collection server. */
interface SessionForwardPayload {
	format: 'ariadne-session-forward';
	version: 1;
	forwardedAt: string;
	trigger: 'save' | 'close';
	sessionSnapshot: ReturnType<SessionStore['exportSessionSnapshot']>;
	featureCounts: SessionFeatureCounts;
	client: {
		extensionVersion: string;
		vscodeVersion: string;
		platform: string;
	};
	githubAccountId: string | null;
	githubUsername: string | null;
}

const DEBOUNCE_MS = 60_000; // 1 minute

function allowInsecureTls(hostname: string, trustLocalTls: boolean): boolean {
	return trustLocalTls && (hostname === '127.0.0.1' || hostname === 'localhost');
}

async function postSessionForward(
	config: MetricsIngestConfig,
	payload: SessionForwardPayload,
): Promise<void> {
	const url = new URL('/v1/session-forward', `${config.baseUrl}/`);
	const body = JSON.stringify(payload);
	const isHttps = url.protocol === 'https:';
	const lib = isHttps ? https : http;

	await new Promise<void>((resolve, reject) => {
		const options: https.RequestOptions = {
			hostname: url.hostname,
			port: url.port || (isHttps ? 443 : 80),
			path: `${url.pathname}${url.search}`,
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(body),
			},
			...(isHttps && allowInsecureTls(url.hostname, config.trustLocalTls)
				? { rejectUnauthorized: false }
				: {}),
		};

		const req = lib.request(options, (res) => {
			let text = '';
			res.on('data', (chunk) => { text += String(chunk); });
			res.on('end', () => {
				if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
					resolve();
					return;
				}
				reject(new Error(`Session forward HTTP ${res.statusCode ?? '?'}: ${text.slice(0, 200)}`));
			});
		});
		req.on('error', reject);
		req.setTimeout(15_000, () => {
			req.destroy(new Error('Session forward request timed out'));
		});
		req.write(body);
		req.end();
	});
}

export class SessionForwarder {
	private readonly counts: SessionFeatureCounts = {
		explainVulnerabilityCount: 0,
		auditGraphOpenCount: 0,
		fileLocationOpenCount: 0,
	};

	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly store: SessionStore,
		private readonly authStorage: AuthStorage,
	) {}

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
			const accountInfo = await this.resolveAccountInfo();
			const payload: SessionForwardPayload = {
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
				githubAccountId: accountInfo.id,
				githubUsername: accountInfo.username,
			};
			await postSessionForward(config, payload);
			console.log(`[Ariadne] Session data forwarded (trigger: ${trigger}).`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn('[Ariadne] Session data forward failed:', message);
		}
	}

	private async resolveAccountInfo(): Promise<{ id: string | null; username: string | null }> {
		try {
			// 1. Check stored session metadata
			const meta = await this.authStorage.loadSessionMeta();
			let id = meta?.accountId?.trim() ?? null;
			let username = meta?.accountLabel?.trim() ?? null;

			// 2. Fall back to live VS Code GitHub session if stored metadata is missing
			if (!id || !username) {
				const liveSession = await vscode.authentication.getSession('github', ['read:user'], { silent: true });
				if (liveSession) {
					id = id || liveSession.account.id;
					username = username || liveSession.account.label;
				}
			}

			const validId = id && /^[0-9]+$/.test(id) ? id : null;
			return { id: validId, username: username || null };
		} catch {
			return { id: null, username: null };
		}
	}
}
