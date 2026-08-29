/**
 * Types for GitHub authentication and user consent in the AI feedback layer.
 */

import type { SidebarSettingsViewModel } from '../settings/extensionSettings.js';

/** GitHub OAuth scopes requested for Copilot SDK integration. */
export const GITHUB_AUTH_SCOPES = ['read:user', 'user:email'] as const;

/** Bump when terms copy changes so users re-accept on next sign-in. */
export const TERMS_VERSION = '1.0';

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
}
