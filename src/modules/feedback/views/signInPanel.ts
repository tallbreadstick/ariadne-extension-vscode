/**
 * View builder for the Ariadne sidebar (GitHub account + extension settings).
 */

import type { SignInPanelViewModel } from '../auth/authTypes.js';
import type { SidebarSettingsViewModel } from '../settings/extensionSettings.js';

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

const OPEN_TERMS_COMMAND = 'ariadne-extension-vscode.openTermsOfUse';
const OPEN_SETTINGS_COMMAND = 'workbench.action.openSettings';
const OPEN_SETTINGS_ARGS = encodeURIComponent(JSON.stringify('ariadne'));

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
		--bg: var(--vscode-sideBar-background, var(--vscode-editor-background));
		--border: var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
		--text: var(--vscode-foreground);
		--muted: var(--vscode-descriptionForeground);
		--accent: var(--vscode-textLink-foreground);
		--accent-hover: var(--vscode-textLink-activeForeground);
		--success: #3fb950;
		--error: var(--vscode-errorForeground);
		--input-bg: var(--vscode-input-background);
		--input-fg: var(--vscode-input-foreground);
		--input-border: var(--vscode-input-border, var(--vscode-panel-border));
	}

	* { box-sizing: border-box; }

	body {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
		font-size: var(--vscode-font-size, 13px);
		line-height: 1.5;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}

	.section {
		padding: 7px 8px;
		display: grid;
		gap: 6px;
	}

	.section + .section {
		border-top: 1px solid var(--border);
	}

	.section-title {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.subtitle {
		margin: 0;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.45;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 10px;
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

	.status-pill.signing-in,
	.status-pill.loading {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--accent);
	}

	.status-pill.error {
		background: color-mix(in srgb, var(--error) 18%, transparent);
		color: var(--error);
	}

	.loading-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid color-mix(in srgb, var(--accent) 25%, transparent);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
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

	.consent-item a,
	.link-row a {
		color: var(--accent);
		text-decoration: none;
	}

	.consent-item a:hover,
	.link-row a:hover {
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
		padding: 8px 12px;
		border-radius: 2px;
		border: 1px solid transparent;
		font-size: 13px;
		font-weight: 400;
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
		border-color: var(--input-border);
	}

	.btn-secondary:not(:disabled):hover {
		background: color-mix(in srgb, var(--text) 6%, transparent);
	}

	.error-box {
		padding: 10px 12px;
		border-radius: 2px;
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

	.usage-block {
		display: grid;
		gap: 8px;
	}

	.usage-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		font-size: 12px;
	}

	.usage-label {
		color: var(--muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 11px;
	}

	.usage-value {
		color: var(--text);
		font-weight: 600;
	}

	.usage-bar-track {
		height: 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--muted) 18%, transparent);
		overflow: hidden;
	}

	.usage-bar-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--accent);
		transition: width 0.2s ease;
	}

	.usage-meta {
		color: var(--muted);
		font-size: 11px;
	}

	.setting-field {
		display: grid;
		gap: 6px;
	}

	.setting-label {
		font-size: 12px;
		color: var(--text);
	}

	.setting-hint {
		margin: 0;
		font-size: 11px;
		color: var(--muted);
		line-height: 1.4;
	}

	.select {
		width: 100%;
		padding: 6px 8px;
		border-radius: 2px;
		border: 1px solid var(--input-border);
		background: var(--input-bg);
		color: var(--input-fg);
		font: inherit;
	}

	.select:focus {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: -1px;
	}

	.link-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 3px 0;
		font-size: 12px;
	}

	.link-row span {
		color: var(--text);
	}

	.github-mark {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
`;

function buildCopilotUsageBlock(model: SignInPanelViewModel): string {
	const usage = model.copilotUsage;
	if (!usage) {
		return /* html */ `
		<div class="usage-block">
			<div class="usage-label">Copilot usage</div>
			<div class="usage-meta">Usage data unavailable right now.</div>
		</div>`;
	}

	if (usage.isUnlimited) {
		return /* html */ `
		<div class="usage-block">
			<div class="usage-header">
				<span class="usage-label">Copilot usage</span>
				<span class="usage-value">Unlimited</span>
			</div>
			<div class="usage-meta">${escapeHtml(usage.label)} plan</div>
		</div>`;
	}

	const resetLine = usage.resetDate
		? `<div class="usage-meta">Resets ${escapeHtml(new Date(usage.resetDate).toLocaleDateString())}</div>`
		: '';

	return /* html */ `
		<div class="usage-block">
			<div class="usage-header">
				<span class="usage-label">Copilot usage</span>
				<span class="usage-value">${usage.remainingPercent}% remaining</span>
			</div>
			<div class="usage-bar-track" aria-hidden="true">
				<div class="usage-bar-fill" style="width: ${usage.usedPercent}%;"></div>
			</div>
			<div class="usage-meta">${escapeHtml(usage.label)} · ${usage.usedPercent}% used this period</div>
			${resetLine}
		</div>`;
}

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
					I agree to the Ariadne
					<a href="command:${OPEN_TERMS_COMMAND}">Terms of Use</a>
					for AI feedback and anonymous activity collection.
				</label>
			</div>
			<div class="consent-item">
				<input type="checkbox" id="analytics-checkbox" ${analyticsChecked} />
				<label for="analytics-checkbox">
					I consent to anonymous collection of vulnerability trends, persisting
					patterns, and other extension activity as described in the
					<a href="command:${OPEN_TERMS_COMMAND}">Terms of Use</a>.
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
		${buildCopilotUsageBlock(model)}
		<div class="actions">
			<button class="btn btn-secondary" id="sign-out-btn" type="button">
				Sign out
			</button>
		</div>`;
}

function buildLoadingBody(): string {
	return /* html */ `
		<div class="loading-row">
			<div class="spinner" aria-hidden="true"></div>
			<span class="status-pill loading">Loading…</span>
		</div>
		<p class="subtitle">Checking GitHub sign-in status…</p>`;
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

function buildAuthBody(model: SignInPanelViewModel): string {
	switch (model.status) {
	case 'loading':
		return buildLoadingBody();
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

function buildModelOptions(settings: SidebarSettingsViewModel): string {
	return settings.copilotModelOptions
		.map((option) => {
			const selected = option === settings.copilotModel ? ' selected' : '';
			return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
		})
		.join('');
}

function buildSettingsSection(settings: SidebarSettingsViewModel): string {
	return /* html */ `
		<h2 class="section-title">Settings</h2>
		<div class="setting-field">
			<label class="setting-label" for="copilot-model-select">Copilot model</label>
			<select class="select" id="copilot-model-select" aria-label="Copilot model">
				${buildModelOptions(settings)}
			</select>
			<p class="setting-hint">
				Model used for plain-English vulnerability explanations. Lighter models respond faster.
			</p>
		</div>
		<div class="link-row">
			<span>Terms of Use</span>
			<a href="command:${OPEN_TERMS_COMMAND}">View</a>
		</div>
		<div class="link-row">
			<span>All Ariadne settings</span>
			<a href="command:${OPEN_SETTINGS_COMMAND}?${OPEN_SETTINGS_ARGS}">Open</a>
		</div>`;
}

/**
 * Builds the Ariadne sidebar HTML (account status + extension settings).
 */
export function buildSignInPanelHtml(model: SignInPanelViewModel): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy"
			content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne</title>
		<style>${CSS}</style>
	</head>
	<body>
		<div class="sidebar">
			<section class="section">
				<h2 class="section-title">GitHub account</h2>
				${buildAuthBody(model)}
			</section>
			<section class="section">
				${buildSettingsSection(model.settings)}
			</section>
		</div>
		<script>
			const vscode = acquireVsCodeApi();

			const termsCheckbox = document.getElementById('terms-checkbox');
			const analyticsCheckbox = document.getElementById('analytics-checkbox');
			const signInBtn = document.getElementById('sign-in-btn');
			const signOutBtn = document.getElementById('sign-out-btn');
			const retryBtn = document.getElementById('retry-btn');
			const modelSelect = document.getElementById('copilot-model-select');

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

			modelSelect?.addEventListener('change', () => {
				vscode.postMessage({
					type: 'update-copilot-model',
					model: modelSelect.value,
				});
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
