/**
 * Session metrics upload to the Ariadne data-collection server.
 */

import * as http from 'node:http';
import * as https from 'node:https';
import * as vscode from 'vscode';
import type { AuthStorage } from '../../feedback/auth/authStorage.js';
import type { SessionCheckpoint, SessionRecord } from '../analysis/lifecycleTypes.js';
import {
	buildHourlyCheckpointPayload,
	buildSessionFinalizedPayload,
} from './metricsIngestPayload.js';

export { METRICS_INGEST_SECRET_KEY } from './metricsIngestConfig.js';
export {
	aggregateCweCounts,
	buildHourlyCheckpointPayload,
	buildSessionFinalizedPayload,
	countSeverity,
	toPublicLifecycleSummaries,
} from './metricsIngestPayload.js';

export type { MetricsIngestConfig } from './metricsIngestConfig.js';
export { loadMetricsIngestConfig } from './metricsIngestConfig.js';

import type { MetricsIngestConfig } from './metricsIngestConfig.js';
import { loadMetricsIngestConfig } from './metricsIngestConfig.js';

function allowInsecureTls(hostname: string, trustLocalTls: boolean): boolean {
	return trustLocalTls && (hostname === '127.0.0.1' || hostname === 'localhost');
}

export async function postMetricsIngest(
	config: MetricsIngestConfig,
	body: Record<string, unknown>,
): Promise<void> {
	const url = new URL('/v1/ingest', `${config.baseUrl}/`);
	const payload = JSON.stringify(body);
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
				'Content-Length': Buffer.byteLength(payload),
			},
			...(isHttps && allowInsecureTls(url.hostname, config.trustLocalTls)
				? { rejectUnauthorized: false }
				: {}),
		};

		const req = lib.request(options, (res) => {
			let text = '';
			res.on('data', (chunk) => {
				text += String(chunk);
			});
			res.on('end', () => {
				if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
					resolve();
					return;
				}
				reject(new Error(`Metrics ingest HTTP ${res.statusCode ?? '?'}: ${text.slice(0, 200)}`));
			});
		});
		req.on('error', reject);
		req.setTimeout(15_000, () => {
			req.destroy(new Error('Metrics ingest request timed out'));
		});
		req.write(payload);
		req.end();
	});
}

export class MetricsIngestService {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly authStorage: AuthStorage,
	) {}

	async uploadSessionFinalized(session: SessionRecord): Promise<void> {
		const config = await this.resolveConfig();
		if (!config) {
			return;
		}
		const githubAccountId = await this.githubAccountId();
		if (!githubAccountId) {
			return;
		}
		const body = buildSessionFinalizedPayload(
			session,
			githubAccountId,
			this.context.extension.packageJSON.version ?? '0.0.0',
			vscode.version,
		);
		await postMetricsIngest(config, body);
		console.log(`[Ariadne] Uploaded session_finalized for ${session.sessionId}.`);
	}

	async uploadHourlyCheckpoint(sessionId: string, checkpoint: SessionCheckpoint): Promise<void> {
		const config = await this.resolveConfig();
		if (!config) {
			return;
		}
		const githubAccountId = await this.githubAccountId();
		if (!githubAccountId) {
			return;
		}
		const body = buildHourlyCheckpointPayload(
			sessionId,
			checkpoint,
			githubAccountId,
			this.context.extension.packageJSON.version ?? '0.0.0',
			vscode.version,
		);
		await postMetricsIngest(config, body);
		console.log(`[Ariadne] Uploaded hourly_checkpoint for ${sessionId}.`);
	}

	private async resolveConfig(): Promise<MetricsIngestConfig | null> {
		const consent = await this.authStorage.loadConsent();
		if (!consent?.analyticsConsentAt) {
			return null;
		}
		return loadMetricsIngestConfig(this.context);
	}

	private async githubAccountId(): Promise<string | null> {
		const meta = await this.authStorage.loadSessionMeta();
		const id = meta?.accountId?.trim();
		return id && /^[0-9]+$/.test(id) ? id : null;
	}
}
