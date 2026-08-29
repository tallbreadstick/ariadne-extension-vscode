/**
 * Secure persistence for GitHub auth consent and session metadata.
 *
 * Raw OAuth tokens remain in VS Code's built-in GitHub authentication
 * provider (OS keychain). We only store non-sensitive session metadata
 * and consent flags here.
 */

import type * as vscode from 'vscode';
import type { AuthConsent, StoredAuthSession } from './authTypes.js';
import { GL_AUTH_CONSENT, SECRET_GITHUB_SESSION } from './authStorageKeys.js';

export class AuthStorage {
	constructor(private readonly context: vscode.ExtensionContext) {}

	async loadConsent(): Promise<AuthConsent | undefined> {
		return this.context.globalState.get<AuthConsent>(GL_AUTH_CONSENT);
	}

	async saveConsent(consent: AuthConsent): Promise<void> {
		await this.context.globalState.update(GL_AUTH_CONSENT, consent);
	}

	async clearConsent(): Promise<void> {
		await this.context.globalState.update(GL_AUTH_CONSENT, undefined);
	}

	async loadSessionMeta(): Promise<StoredAuthSession | undefined> {
		const raw = await this.context.secrets.get(SECRET_GITHUB_SESSION);
		if (!raw) {
			return undefined;
		}
		try {
			return JSON.parse(raw) as StoredAuthSession;
		} catch {
			return undefined;
		}
	}

	async saveSessionMeta(session: StoredAuthSession): Promise<void> {
		await this.context.secrets.store(
			SECRET_GITHUB_SESSION,
			JSON.stringify(session),
		);
	}

	async clearSessionMeta(): Promise<void> {
		await this.context.secrets.delete(SECRET_GITHUB_SESSION);
	}
}
