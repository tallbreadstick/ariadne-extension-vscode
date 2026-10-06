/**
 * Types for GitHub authentication and user consent in the AI feedback layer.
 */

import type { SidebarSettingsViewModel } from '../settings/extensionSettings.js';

/** GitHub OAuth scopes requested for Copilot SDK integration. */
export const GITHUB_AUTH_SCOPES = ['read:user', 'user:email'] as const;

/** Bump when terms copy changes so users re-accept on next sign-in. */
export const TERMS_VERSION = '1.2';

/** User consent captured before the first GitHub sign-in. */
export interface AuthConsent {
	termsAcceptedAt: number;
	analyticsConsentAt: number;
	termsVersion: string;
}

/** Non-token session metadata stored in SecretStorage. */
export interface StoredAuthSession {
	sessionId: string;
	accountId: string;
	accountLabel: string;
	signedInAt: number;
	scopes: readonly string[];
}

/** Auth state for the sidebar (settings are attached when rendering). */
export type AuthPanelState = Omit<SignInPanelViewModel, 'settings'>;

/** View-model passed into the sign-in panel HTML builder. */
export interface SignInPanelViewModel {
	status: 'loading' | 'signed-out' | 'signed-in' | 'signing-in' | 'error';
	accountLabel?: string;
	signedInAt?: number;
	hasConsent?: boolean;
	analyticsConsent?: boolean;
	errorMessage?: string;
	copilotUsage?: {
		label: string;
		remainingPercent: number;
		usedPercent: number;
		isUnlimited: boolean;
		resetDate?: string;
	};
	settings: SidebarSettingsViewModel;
	scanner?: ScannerSettingsViewModel;
}

export interface ScannerBinaryOption {
	id: string;
	label: string;
	downloaded: boolean;
}

/** Binary picker shown on the Ariadne settings page. */
export interface ScannerSettingsViewModel {
	auto: boolean;
	os: string;
	osOptions: readonly { id: string; label: string }[];
	target: string;
	/** Binary actually in use. Auto uses this computer's build. */
	activeTarget?: string;
	/** Build that matches this computer. Used when Auto is turned on. */
	hostTarget?: string;
	binaries: readonly ScannerBinaryOption[];
	downloaded: readonly ScannerBinaryOption[];
	working?: boolean;
	overrideActive?: boolean;
	/** True while a scanner choice or download is in progress. */
	busy?: boolean;
	/** Which control the busy spinner replaces. */
	busyAction?: 'download' | 'delete' | 'status';
	/** Editor highlights. The scanner keeps running when this is off. */
	highlightsVisible?: boolean;
	/** When true, showing the sidebar also opens the bottom Ariadne panel. */
	openPanelOnStartup?: boolean;
}
