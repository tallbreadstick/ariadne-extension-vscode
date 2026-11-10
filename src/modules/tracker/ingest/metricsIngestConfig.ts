import * as vscode from 'vscode';

export const METRICS_INGEST_SECRET_KEY = 'ariadne.metricsIngestApiKey';

export interface MetricsIngestConfig {
	enabled: boolean;
	baseUrl: string;
	apiKey: string;
	trustLocalTls: boolean;
}

export async function loadMetricsIngestConfig(
	context: vscode.ExtensionContext,
): Promise<MetricsIngestConfig | null> {
	const config = vscode.workspace.getConfiguration('ariadne.metricsIngest');
	const enabled = config.get<boolean>('enabled', true);
	if (!enabled) {
		return null;
	}
	const baseUrl = (config.get<string>('baseUrl', 'https://127.0.0.1:8443') ?? '').replace(/\/$/, '');
	if (!baseUrl) {
		return null;
	}
	let apiKey = config.get<string>('apiKey', '')?.trim() ?? '';
	if (!apiKey) {
		apiKey = (await context.secrets.get(METRICS_INGEST_SECRET_KEY))?.trim() ?? '';
	}
	if (apiKey.length < 32) {
		return null;
	}
	const trustLocalTls = config.get<boolean>('trustLocalTls', true);
	return { enabled, baseUrl, apiKey, trustLocalTls };
}
