/**
 * GitHub authentication service for the AI feedback layer.
 *
 * Uses VS Code's built-in GitHub authentication provider so tokens are
 * stored securely in the OS credential store. Session metadata and user
 * consent are persisted separately via AuthStorage.
 */

import * as vscode from 'vscode';
import { AuthStorage } from './authStorage.js';
import {
	GITHUB_AUTH_SCOPES,
	TERMS_VERSION,
	type AuthPanelState,
} from './authTypes.js';

export class GitHubAuthService {
	private readonly storage: AuthStorage;
	private readonly _onDidChangeAuth = new vscode.EventEmitter<void>();
	readonly onDidChangeAuth = this._onDidChangeAuth.event;

	constructor(context: vscode.ExtensionContext) {
		this.storage = new AuthStorage(context);

		context.subscriptions.push(
			vscode.authentication.onDidChangeSessions((event) => {
				if (event.provider.id === 'github') {
					void this.syncStoredSession().then(() => {
						this._onDidChangeAuth.fire();
					});
				}
			}),
		);
	}

	/** Sync stored session metadata with VS Code's GitHub auth provider. */
	async initialize(): Promise<void> {
		await this.syncStoredSession();
	}

	async getPanelViewModel(): Promise<AuthPanelState> {
		const consent = await this.storage.loadConsent();
		if (!this.hasValidConsent(consent)) {
			return {
				status: 'signed-out',
				hasConsent: false,
				analyticsConsent: false,
			};
		}

		const sessionMeta = await this.storage.loadSessionMeta();
		const liveSession = await this.getLiveSession();

		if (liveSession && sessionMeta && consent) {
			return {
				status: 'signed-in',
				accountLabel: liveSession.account.label,
				signedInAt: sessionMeta.signedInAt,
				analyticsConsent: Boolean(consent.analyticsConsentAt),
			};
		}

		return {
			status: 'signed-out',
			hasConsent: true,
			analyticsConsent: Boolean(consent?.analyticsConsentAt),
		};
	}

	async signIn(options: {
		termsAccepted: boolean;
		analyticsConsent: boolean;
	}): Promise<void> {
		if (!options.termsAccepted) {
			throw new Error('You must accept the Terms and Conditions to sign in.');
		}
		if (!options.analyticsConsent) {
			throw new Error(
				'You must consent to anonymous activity collection to use AI feedback.',
			);
		}

		const now = Date.now();
		await this.storage.saveConsent({
			termsAcceptedAt: now,
			analyticsConsentAt: now,
			termsVersion: TERMS_VERSION,
		});

		const session = await vscode.authentication.getSession(
			'github',
			[...GITHUB_AUTH_SCOPES],
			{
				createIfNone: {
					detail:
						'Ariadne uses your GitHub account to power AI vulnerability explanations via GitHub Copilot.',
				},
				clearSessionPreference: false,
			},
		);

		await this.storage.saveSessionMeta({
			sessionId: session.id,
			accountId: session.account.id,
			accountLabel: session.account.label,
			signedInAt: now,
			scopes: session.scopes,
		});

		this._onDidChangeAuth.fire();
	}

	async signOut(): Promise<void> {
		await this.storage.clearSessionMeta();
		await this.storage.clearConsent();
		this._onDidChangeAuth.fire();

		const liveSession = await this.getLiveSession();
		if (liveSession) {
			// Best-effort global GitHub sign-out; UI already reflects Ariadne sign-out.
			void vscode.commands.executeCommand(
				'workbench.action.accounts.signOut',
				{ providerId: 'github', account: liveSession.account },
			);
		}
	}

	/**
	 * Returns the active GitHub access token when the user is signed in
	 * with valid consent. Intended for future Copilot SDK integration.
	 */
	async getAccessToken(): Promise<string | undefined> {
		const consent = await this.storage.loadConsent();
		if (!this.hasValidConsent(consent)) {
			return undefined;
		}

		const session = await this.getLiveSession();
		return session?.accessToken;
	}

	async isAuthenticated(): Promise<boolean> {
		const consent = await this.storage.loadConsent();
		if (!this.hasValidConsent(consent)) {
			return false;
		}
		return Boolean(await this.getLiveSession());
	}

	private async getLiveSession(): Promise<vscode.AuthenticationSession | undefined> {
		return vscode.authentication.getSession(
			'github',
			[...GITHUB_AUTH_SCOPES],
			{ silent: true },
		);
	}

	private hasValidConsent(consent: Awaited<ReturnType<AuthStorage['loadConsent']>>): boolean {
		return Boolean(
			consent
			&& consent.termsVersion === TERMS_VERSION
			&& consent.termsAcceptedAt > 0
			&& consent.analyticsConsentAt > 0,
		);
	}

	private async syncStoredSession(): Promise<void> {
		const consent = await this.storage.loadConsent();
		if (!this.hasValidConsent(consent)) {
			await this.storage.clearSessionMeta();
			return;
		}

		const liveSession = await this.getLiveSession();
		if (!liveSession) {
			await this.storage.clearSessionMeta();
			return;
		}

		const existing = await this.storage.loadSessionMeta();
		if (
			existing
			&& existing.sessionId === liveSession.id
			&& existing.accountId === liveSession.account.id
		) {
			return;
		}

		await this.storage.saveSessionMeta({
			sessionId: liveSession.id,
			accountId: liveSession.account.id,
			accountLabel: liveSession.account.label,
			signedInAt: existing?.signedInAt ?? Date.now(),
			scopes: liveSession.scopes,
		});
	}
}
