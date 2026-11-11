/** Copilot model used for vulnerability explanations. No other models are allowed. */
export const DEFAULT_COPILOT_MODEL = 'gemini-3.5-flash';

export interface SidebarSettingsViewModel {
	copilotModel: string;
	rulesPresent: boolean;
}

import type * as vscode from 'vscode';
import type { ConfigurationSettingsViewModel, NotificationLevel } from '../auth/authTypes.js';

function getVsCode(): typeof vscode | undefined {
	try {
		return require('vscode');
	} catch {
		return undefined;
	}
}

export const DEFAULT_AUTO_SCAN_INTERVAL_MINUTES = 60;
export const MIN_AUTO_SCAN_INTERVAL_MINUTES = 2;
export const MAX_AUTO_SCAN_INTERVAL_MINUTES = 180;

/** Default configuration view model when VS Code workspace configuration is not yet available. */
export function defaultConfigurationSettings(): ConfigurationSettingsViewModel {
	return {
		notificationLevel: 'milestones',
		autoScanIntervalMinutes: DEFAULT_AUTO_SCAN_INTERVAL_MINUTES,
		executablePath: 'ariadne',
		metricsEnabled: true,
		metricsBaseUrl: 'https://127.0.0.1:8443',
		metricsApiKey: '',
		metricsTrustLocalTls: true,
	};
}

/**
 * Loads the current Ariadne configuration settings from VS Code workspace configuration.
 */
export function loadConfigurationSettings(): ConfigurationSettingsViewModel {
	const vs = getVsCode();
	if (!vs) {
		return defaultConfigurationSettings();
	}
	try {
		const autoScan = vs.workspace.getConfiguration('ariadne.autoScan');
		const notifications = vs.workspace.getConfiguration('ariadne.notifications');
		const rootConfig = vs.workspace.getConfiguration('ariadne');
		const metrics = vs.workspace.getConfiguration('ariadne.metricsIngest');

		const rawLevel = notifications.get<string>('level', 'milestones');
		const notificationLevel: NotificationLevel =
			rawLevel === 'all' || rawLevel === 'quiet' ? rawLevel : 'milestones';
		const autoScanIntervalMinutes = getAutoScanIntervalMinutes();
		const executablePath = rootConfig.get<string>('executable', 'ariadne') || 'ariadne';
		const metricsEnabled = metrics.get<boolean>('enabled', true) ?? true;
		const metricsBaseUrl = metrics.get<string>('baseUrl', 'https://127.0.0.1:8443') || 'https://127.0.0.1:8443';
		const metricsApiKey = metrics.get<string>('apiKey', '') || '';
		const metricsTrustLocalTls = metrics.get<boolean>('trustLocalTls', true) ?? true;

		return {
			notificationLevel,
			autoScanIntervalMinutes,
			executablePath,
			metricsEnabled,
			metricsBaseUrl,
			metricsApiKey,
			metricsTrustLocalTls,
		};
	} catch {
		return defaultConfigurationSettings();
	}
}

/**
 * Reads the configured auto-scan interval in minutes from settings
 * (clamped between 2 and 180 minutes).
 */
export function getAutoScanIntervalMinutes(): number {
	try {
		const vs = getVsCode();
		if (!vs) {
			return DEFAULT_AUTO_SCAN_INTERVAL_MINUTES;
		}
		const config = vs.workspace.getConfiguration('ariadne.autoScan');
		const minutes = config.get<number>('intervalMinutes', DEFAULT_AUTO_SCAN_INTERVAL_MINUTES);
		if (typeof minutes !== 'number' || isNaN(minutes)) {
			return DEFAULT_AUTO_SCAN_INTERVAL_MINUTES;
		}
		return Math.max(
			MIN_AUTO_SCAN_INTERVAL_MINUTES,
			Math.min(MAX_AUTO_SCAN_INTERVAL_MINUTES, Math.round(minutes)),
		);
	} catch {
		return DEFAULT_AUTO_SCAN_INTERVAL_MINUTES;
	}
}

/**
 * Reads the configured auto-scan interval in milliseconds.
 */
export function getAutoScanIntervalMs(): number {
	return getAutoScanIntervalMinutes() * 60 * 1000;
}
