/**
 * View builder for the GitHub Sign-In panel (AI feedback layer).
 */

import type { SignInPanelViewModel } from '../auth/authTypes.js';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function formatSignedInDate(epochMs: number): string {
	return new Date(epochMs).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	});
}

const GITHUB_MARK_SVG = /* html */ `
	<svg class="github-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58
			0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.32-1.75-1.32-1.75
			-1.08-.74.08-.72.08-.72 1.19.08 1.82 1.23 1.82 1.23 1.06 1.82 2.79 1.29 3.47.99
			.11-.77.42-1.29.76-1.59-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22
			-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23
			3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49
			5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.21.7.83.58C20.56 21.8 24
			17.3 24 12 24 5.37 18.63 0 12 0z"/>
	</svg>`;

const CSS = /* css */ `
	:root {
		color-scheme: dark;
		--bg: var(--vscode-editor-background);
		--panel: var(--vscode-editorWidget-background);
		--border: var(--vscode-panel-border);
		--text: var(--vscode-foreground);
		--muted: var(--vscode-descriptionForeground);
		--accent: var(--vscode-textLink-foreground);
		--accent-hover: var(--vscode-textLink-activeForeground);
		--success: #3fb950;
		--error: var(--vscode-errorForeground);
		--radius: 8px;
	}

	* { box-sizing: border-box; }

	body {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: 13px;
		line-height: 1.5;
	}

	.panel {
		padding: 16px 12px 24px;
		display: grid;
		gap: 16px;
	}

	.header {
		display: grid;
		gap: 8px;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.github-mark {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.header h1 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.subtitle {
		margin: 0;
		color: var(--muted);
		font-size: 12px;
	}

	.card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 14px;
		display: grid;
		gap: 12px;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		width: fit-content;
	}

	.status-pill.signed-out {
		background: color-mix(in srgb, var(--muted) 20%, transparent);
		color: var(--muted);
	}

	.status-pill.signed-in {
		background: color-mix(in srgb, var(--success) 18%, transparent);
		color: var(--success);
	}

	.status-pill.signing-in {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent);
	}

	.status-pill.error {
		background: color-mix(in srgb, var(--error) 18%, transparent);
		color: var(--error);
	}

	.account-label {
		font-size: 14px;
		font-weight: 600;
		word-break: break-word;
	}

	.meta-line {
		color: var(--muted);
		font-size: 12px;
	}

	.consent-block {
		display: grid;
		gap: 10px;
	}

	.consent-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	.consent-item input {
		margin-top: 3px;
		flex-shrink: 0;
	}

	.consent-item label {
		color: var(--text);
		font-size: 12px;
		line-height: 1.45;
	}

	.consent-item a {
		color: var(--accent);
		text-decoration: none;
	}

	.consent-item a:hover {
		color: var(--accent-hover);
		text-decoration: underline;
	}

	.actions {
		display: grid;
		gap: 8px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 10px 14px;
		border-radius: 6px;
		border: 1px solid transparent;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--vscode-button-background);
		color: var(--vscode-button-foreground);
		border-color: var(--vscode-button-border, transparent);
	}

	.btn-primary:not(:disabled):hover {
		background: var(--vscode-button-hoverBackground);
	}

	.btn-secondary {
		background: transparent;
		color: var(--text);
		border-color: var(--border);
	}

	.btn-secondary:not(:disabled):hover {
		background: color-mix(in srgb, var(--text) 6%, transparent);
	}

	.error-box {
		padding: 10px 12px;
		border-radius: 6px;
		border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
		background: color-mix(in srgb, var(--error) 8%, transparent);
		color: var(--text);
		font-size: 12px;
	}

	.footer-note {
		margin: 0;
		color: var(--muted);
		font-size: 11px;
		line-height: 1.45;
	}
`;

function buildSignedOutBody(model: SignInPanelViewModel): string {
	const termsChecked = model.hasConsent ? 'checked' : '';
	const analyticsChecked = model.analyticsConsent ? 'checked' : '';

	return /* html */ `
		<span class="status-pill signed-out">Not signed in</span>
		<p class="subtitle">
			Sign in with GitHub to power AI vulnerability explanations through your own
			GitHub Copilot allowance.
		</p>
		<div class="consent-block">
			<div class="consent-item">
				<input type="checkbox" id="terms-checkbox" ${termsChecked} />
				<label for="terms-checkbox">
					I agree to the
					<a href="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>
					for using Ariadne AI feedback.
				</label>
			</div>
			<div class="consent-item">
				<input type="checkbox" id="analytics-checkbox" ${analyticsChecked} />
				<label for="analytics-checkbox">
					I consent to anonymous collection and processing of my extension activity
					to improve Ariadne for student developers.
				</label>
			</div>
		</div>
		<div class="actions">
			<button class="btn btn-primary" id="sign-in-btn" type="button" disabled>
				${GITHUB_MARK_SVG}
				Sign in with GitHub
			</button>
		</div>
		<p class="footer-note">
			Your GitHub credentials are stored securely by VS Code. Ariadne never embeds
			API keys in the extension bundle.
		</p>`;
}

function buildSignedInBody(model: SignInPanelViewModel): string {
	const label = escapeHtml(model.accountLabel ?? 'GitHub user');
	const signedInAt = model.signedInAt
		? escapeHtml(formatSignedInDate(model.signedInAt))
		: 'Unknown';

	return /* html */ `
		<span class="status-pill signed-in">Signed in</span>
		<div class="account-label">${label}</div>
		<div class="meta-line">Signed in ${signedInAt}</div>
		<div class="meta-line">
			AI feedback will use your GitHub Copilot subscription when available.
		</div>
		<div class="actions">
			<button class="btn btn-secondary" id="sign-out-btn" type="button">
				Sign out
			</button>
		</div>`;
}

function buildSigningInBody(): string {
	return /* html */ `
		<span class="status-pill signing-in">Signing in…</span>
		<p class="subtitle">Complete the GitHub authorization prompt in VS Code.</p>`;
}

function buildErrorBody(model: SignInPanelViewModel): string {
	const message = escapeHtml(model.errorMessage ?? 'Sign-in failed.');
	return /* html */ `
		<span class="status-pill error">Error</span>
		<div class="error-box">${message}</div>
		<div class="actions">
			<button class="btn btn-primary" id="retry-btn" type="button">Try again</button>
		</div>`;
}

function buildBody(model: SignInPanelViewModel): string {
	switch (model.status) {
	case 'signed-in':
		return buildSignedInBody(model);
	case 'signing-in':
		return buildSigningInBody();
	case 'error':
		return buildErrorBody(model);
	default:
		return buildSignedOutBody(model);
	}
}

/**
 * Builds the GitHub sign-in panel HTML for the Ariadne sidebar view.
 */
export function buildSignInPanelHtml(model: SignInPanelViewModel): string {
	const body = buildBody(model);

	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy"
			content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne: GitHub Sign-In</title>
		<style>${CSS}</style>
	</head>
	<body>
		<div class="panel">
			<header class="header">
				<div class="header-row">
					${GITHUB_MARK_SVG}
					<h1>GitHub Account</h1>
				</div>
			</header>
			<div class="card" id="auth-card">
				${body}
			</div>
		</div>
		<script>
			const vscode = acquireVsCodeApi();

			const termsCheckbox = document.getElementById('terms-checkbox');
			const analyticsCheckbox = document.getElementById('analytics-checkbox');
			const signInBtn = document.getElementById('sign-in-btn');
			const signOutBtn = document.getElementById('sign-out-btn');
			const retryBtn = document.getElementById('retry-btn');

			function updateSignInEnabled() {
				if (!signInBtn || !termsCheckbox || !analyticsCheckbox) {
					return;
				}
				signInBtn.disabled = !(termsCheckbox.checked && analyticsCheckbox.checked);
			}

			termsCheckbox?.addEventListener('change', updateSignInEnabled);
			analyticsCheckbox?.addEventListener('change', updateSignInEnabled);
			updateSignInEnabled();

			signInBtn?.addEventListener('click', () => {
				if (!termsCheckbox?.checked || !analyticsCheckbox?.checked) {
					return;
				}
				vscode.postMessage({
					type: 'github-sign-in',
					termsAccepted: true,
					analyticsConsent: true,
				});
			});

			signOutBtn?.addEventListener('click', () => {
				vscode.postMessage({ type: 'github-sign-out' });
			});

			retryBtn?.addEventListener('click', () => {
				vscode.postMessage({ type: 'github-auth-refresh' });
			});

			window.addEventListener('message', (event) => {
				const msg = event.data;
				if (msg.type === 'auth-state-updated' && typeof msg.html === 'string') {
					document.open();
					document.write(msg.html);
					document.close();
				}
			});
		</script>
	</body>
</html>`;
}
