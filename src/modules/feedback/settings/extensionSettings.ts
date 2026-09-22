/** Copilot model used for vulnerability explanations. No other models are allowed. */
export const DEFAULT_COPILOT_MODEL = 'gemini-3.5-flash';

export const LOCKED_COPILOT_MODEL_LABEL = 'Gemini Flash';

export interface SidebarSettingsViewModel {
	copilotModel: string;
	rulesPresent: boolean;
}

import * as vscode from 'vscode';

export const DEFAULT_AUTO_SCAN_INTERVAL_MINUTES = 60;
export const MIN_AUTO_SCAN_INTERVAL_MINUTES = 2;
export const MAX_AUTO_SCAN_INTERVAL_MINUTES = 180;

/**
 * Reads the configured auto-scan interval in minutes from settings
 * (clamped between 2 and 180 minutes).
 */
export function getAutoScanIntervalMinutes(): number {
	try {
		const config = vscode.workspace.getConfiguration('ariadne.autoScan');
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
