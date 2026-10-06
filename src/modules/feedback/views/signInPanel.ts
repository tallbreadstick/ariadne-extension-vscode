/**
 * View builder for the Ariadne sidebar (accordion settings).
 */

import type { ScannerSettingsViewModel, SignInPanelViewModel } from '../auth/authTypes.js';
import {
	SCANNER_TARGET_LABELS,
	targetsForOs,
	type ScannerOs,
	type ScannerTarget,
} from '../../core/scannerRelease.js';
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
const OPEN_PRIVACY_COMMAND = 'ariadne-extension-vscode.openPrivacyPolicy';

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
		max-width: 560px;
	}

	.settings-title {
		margin: 0;
		padding: 12px 8px 0;
		font-size: 16px;
		font-weight: 600;
	}

	.accordion-item {
		border-bottom: 1px solid var(--border);
	}

	.accordion-item > summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		user-select: none;
	}

	.accordion-item > summary::-webkit-details-marker {
		display: none;
	}

	.accordion-item > summary:focus-visible {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: -1px;
	}

	.chevron {
		width: 0;
		height: 0;
		border-left: 4px solid transparent;
		border-right: 4px solid transparent;
		border-top: 5px solid var(--muted);
		transition: transform 0.15s ease-out;
		flex-shrink: 0;
	}

	.accordion-item[open] > summary .chevron {
		transform: rotate(180deg);
	}

	.accordion-body {
		padding: 0 8px 12px;
		display: grid;
		gap: 8px;
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
		padding: 8px 12px;
		border-radius: 2px;
		border: 1px solid transparent;
		font-size: 13px;
		font-weight: 400;
		cursor: pointer;
		transition: background 0.15s ease-out, border-color 0.15s ease-out, opacity 0.15s ease-out;
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

	.btn-danger {
		background: transparent;
		color: var(--error);
		border-color: color-mix(in srgb, var(--error) 45%, transparent);
	}

	.btn-danger:not(:disabled):hover {
		background: color-mix(in srgb, var(--error) 10%, transparent);
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
		transition: width 0.2s ease-out;
	}

	.usage-meta {
		color: var(--muted);
		font-size: 11px;
	}

	.github-mark {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}

	.switch-track {
		width: 32px;
		height: 18px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--muted) 35%, transparent);
		position: relative;
		flex-shrink: 0;
	}

	.switch[aria-checked="true"] .switch-track {
		background: var(--vscode-button-background);
	}

	.switch-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--vscode-foreground);
		transition: transform 0.15s ease-out;
	}

	.switch[aria-checked="true"] .switch-knob {
		transform: translateX(14px);
	}

	.core-toggle {
		margin: 0 0 10px;
	}

	.scanner-controls.is-busy {
		opacity: 0.45;
	}

	.scanner-controls.is-busy,
	.scanner-controls.is-busy * {
		cursor: default;
		pointer-events: none;
	}

	.spin {
		width: 14px;
		height: 14px;
		border: 2px solid color-mix(in srgb, var(--muted) 45%, transparent);
		border-top-color: var(--text);
		border-radius: 50%;
		animation: ariadne-spin 0.7s linear infinite;
		display: inline-block;
	}

	@keyframes ariadne-spin {
		to { transform: rotate(360deg); }
	}

	.binary-bad {
		color: #f14c4c;
		font-size: 14px;
		font-weight: 700;
		line-height: 1;
	}

	.field {
		display: grid;
		gap: 4px;
	}

	.field-label {
		font-size: 12px;
		color: var(--muted);
	}

	.field select {
		width: 100%;
		background: var(--input-bg);
		color: var(--input-fg);
		border: 1px solid var(--input-border);
		padding: 4px 6px;
		font: inherit;
	}

	.binary-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
	}

	.binary-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 0;
	}

	.binary-meta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.binary-check {
		color: var(--success);
		font-size: 14px;
		font-weight: 700;
		line-height: 1;
	}

	.status-slot,
	.trash-slot {
		width: 16px;
		height: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--text);
		cursor: pointer;
	}

	.icon-btn[data-delete-target]:hover {
		color: var(--error);
	}

	.icon-btn:disabled {
		color: var(--muted);
		opacity: 0.35;
		cursor: default;
	}

	.trash-icon,
	.download-icon {
		width: 14px;
		height: 14px;
	}
`;

function buildCopilotUsageBlock(model: SignInPanelViewModel): string {
	const usage = model.copilotUsage;
	if (!usage) {
		return /* html */ `
		<div class="usage-block">
			<div class="usage-label">Token usage</div>
			<div class="usage-meta">Usage data unavailable right now.</div>
		</div>`;
	}

	if (usage.isUnlimited) {
		return /* html */ `
		<div class="usage-block">
			<div class="usage-header">
				<span class="usage-label">Token usage</span>
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
				<span class="usage-label">Token usage</span>
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
	const privacyChecked = model.analyticsConsent ? 'checked' : '';

	return /* html */ `
		<span class="status-pill signed-out">Not signed in</span>
		<p class="subtitle">
			Sign in with GitHub to use Ariadne — scanning, rule scripts, and AI
			explanations.
		</p>
		<div class="consent-block">
			<div class="consent-item">
				<input type="checkbox" id="terms-checkbox" ${termsChecked} />
				<label for="terms-checkbox">
					I agree to the Ariadne
					<a href="command:${OPEN_TERMS_COMMAND}">Terms of Use</a>.
				</label>
			</div>
			<div class="consent-item">
				<input type="checkbox" id="privacy-checkbox" ${privacyChecked} />
				<label for="privacy-checkbox">
					I agree to the Ariadne
					<a href="command:${OPEN_PRIVACY_COMMAND}">Privacy Policy</a>,
					including anonymous activity collection.
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

function buildScriptingSection(model: SignInPanelViewModel): string {
	const signedIn = model.status === 'signed-in';
	const disabled = signedIn ? '' : 'disabled';
	const settings: SidebarSettingsViewModel = model.settings;
	const statusLine = signedIn
		? (settings.rulesPresent
			? 'Rule scripts are present in this workspace.'
			: 'This workspace has no Ariadne rule scripts yet.')
		: 'Sign in to initialize or reset rule scripts.';

	return /* html */ `
		<p class="subtitle">${statusLine}</p>
		<div class="actions">
			<button class="btn btn-primary" id="init-rules-btn" type="button" ${disabled}>
				Initialize rule scripts
			</button>
			<button class="btn btn-danger" id="reset-rules-btn" type="button" ${disabled}>
				Reset rule scripts
			</button>
		</div>
		<p class="footer-note">
			Initialize runs <code>ariadne init</code> in the open folder. Reset restores
			the default scripts after a confirmation prompt.
		</p>`;
}

const TRASH_SVG = /* html */ `
	<svg class="trash-icon" viewBox="0 0 16 16" aria-hidden="true">
		<path fill="currentColor" d="M5.5 2h5l.5 1H14v1.2H2V3h3l.5-1zM3.2 5h9.6l-.7 8.2H3.9L3.2 5z"/>
	</svg>`;

const DOWNLOAD_SVG = /* html */ `
	<svg class="download-icon" viewBox="0 0 16 16" aria-hidden="true">
		<path fill="currentColor" d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/>
		<path fill="currentColor" d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06Z"/>
	</svg>`;

function defaultScannerSettings(): ScannerSettingsViewModel {
	return {
		auto: true,
		os: 'linux',
		osOptions: [
			{ id: 'windows', label: 'Windows' },
			{ id: 'linux', label: 'Linux' },
			{ id: 'macos', label: 'macOS' },
		],
		target: 'x86_64-unknown-linux-gnu',
		binaries: [],
		downloaded: [],
	};
}

function scannerCatalog(): Record<ScannerOs, { id: ScannerTarget; label: string }[]> {
	return {
		windows: targetsForOs('windows').map((id) => ({ id, label: SCANNER_TARGET_LABELS[id] })),
		linux: targetsForOs('linux').map((id) => ({ id, label: SCANNER_TARGET_LABELS[id] })),
		macos: targetsForOs('macos').map((id) => ({ id, label: SCANNER_TARGET_LABELS[id] })),
	};
}

const SPINNER_HTML = '<span class="spin" role="status" aria-label="Loading"></span>';

function buildScannerSection(model: SignInPanelViewModel): string {
	const scanner = model.scanner ?? defaultScannerSettings();
	const catalog = scannerCatalog();
	const os = (scanner.os === 'windows' || scanner.os === 'linux' || scanner.os === 'macos')
		? scanner.os
		: 'linux';
	const downloaded = new Set([
		...scanner.downloaded.filter((binary) => binary.downloaded).map((binary) => binary.id),
		...scanner.binaries.filter((binary) => binary.downloaded).map((binary) => binary.id),
	]);
	const options = catalog[os];
	const selectedId = options.some((binary) => binary.id === scanner.target)
		? scanner.target
		: options[0]?.id ?? scanner.target;
	const activeId = scanner.auto
		? (scanner.activeTarget && SCANNER_TARGET_LABELS[scanner.activeTarget as ScannerTarget]
			? scanner.activeTarget
			: selectedId)
		: selectedId;
	const activeLabel = SCANNER_TARGET_LABELS[activeId as ScannerTarget] ?? activeId;
	const isDownloaded = downloaded.has(activeId);
	const osOptions = [
		{ id: 'windows', label: 'Windows' },
		{ id: 'linux', label: 'Linux' },
		{ id: 'macos', label: 'macOS' },
	].map((option) => {
		const selected = option.id === os ? 'selected' : '';
		return `<option value="${option.id}" ${selected}>${option.label}</option>`;
	}).join('');
	const binaryOptions = options.map((binary) => {
		const selected = binary.id === selectedId ? 'selected' : '';
		return `<option value="${escapeHtml(binary.id)}" ${selected}>${escapeHtml(binary.label)}</option>`;
	}).join('');
	const manualHidden = scanner.auto ? 'hidden' : '';
	const busy = scanner.busy === true;
	const disabled = busy ? 'disabled' : '';
	const highlightsOn = scanner.highlightsVisible !== false;
	const openOnStartup = scanner.openPanelOnStartup !== false;
	const spinnerInTrash = busy && scanner.busyAction === 'delete';
	const statusIcon = busy && !spinnerInTrash
		? SPINNER_HTML
		: !isDownloaded
			? `<button class="icon-btn" type="button" data-download-target="${escapeHtml(activeId)}" title="Download" aria-label="Download">${DOWNLOAD_SVG}</button>`
			: scanner.working === false
				? '<span class="binary-bad" title="Incompatible" aria-label="Incompatible">✕</span>'
				: '<span class="binary-check" title="Running" aria-label="Running">✓</span>';
	const trash = spinnerInTrash
		? SPINNER_HTML
		: isDownloaded && !busy
			? `<button class="icon-btn" type="button" data-delete-target="${escapeHtml(activeId)}" title="Delete" aria-label="Delete">${TRASH_SVG}</button>`
			: `<button class="icon-btn" type="button" disabled>${TRASH_SVG}</button>`;

	return /* html */ `
		<button class="switch core-toggle" id="highlights-visible" type="button" role="switch" aria-checked="${highlightsOn ? 'true' : 'false'}">
			<span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
			<span>Highlights</span>
		</button>
		<button class="switch core-toggle" id="open-panel-on-startup" type="button" role="switch" aria-checked="${openOnStartup ? 'true' : 'false'}">
			<span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
			<span>Open on startup</span>
		</button>
		<div id="scanner-controls" class="scanner-controls${busy ? ' is-busy' : ''}" data-host-target="${escapeHtml(scanner.hostTarget ?? '')}" aria-busy="${busy ? 'true' : 'false'}">
			<button class="switch" id="scanner-auto" type="button" role="switch" aria-checked="${scanner.auto ? 'true' : 'false'}" ${disabled}>
				<span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
				<span>Auto</span>
			</button>
			<div id="scanner-manual" ${manualHidden}>
				<label class="field">
					<span class="field-label">Operating system</span>
					<select id="scanner-os" aria-label="Operating system" ${disabled}>${osOptions}</select>
				</label>
				<label class="field">
					<span class="field-label">Binary</span>
					<select id="scanner-target" aria-label="Scanner binary" ${disabled}>${binaryOptions}</select>
				</label>
			</div>
			<div class="binary-row" id="scanner-current">
				<span id="scanner-current-label">${escapeHtml(activeLabel)}</span>
				<span class="binary-meta" id="scanner-current-actions">
					<span class="status-slot" id="scanner-status">${statusIcon}</span>
					<span class="trash-slot" id="scanner-trash">${trash}</span>
				</span>
			</div>
		</div>
		<script type="application/json" id="scanner-catalog">${JSON.stringify(catalog)}</script>`;
}

function buildSessionSection(): string {
	return /* html */ `
		<p class="subtitle">Manage local scan history and metrics for this workspace.</p>
		<div class="actions">
			<button class="btn btn-primary" id="export-session-btn" type="button">
				Export session data
			</button>
			<button class="btn btn-danger" id="clear-session-btn" type="button">
				Clear session data
			</button>
		</div>
		<p class="footer-note">
			Export saves a JSON file of this workspace's session history. Clear
			permanently deletes all local session tracking after a confirmation prompt.
		</p>`;
}

/**
 * Builds the Ariadne sidebar HTML (accordion settings).
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
			<h1 class="settings-title">Ariadne Settings</h1>
			<details class="accordion-item" id="accordion-account" name="ariadne-settings" open>
				<summary>Account<span class="chevron" aria-hidden="true"></span></summary>
				<div class="accordion-body">
					${buildAuthBody(model)}
				</div>
			</details>
			<details class="accordion-item" id="accordion-session" name="ariadne-settings">
				<summary>Sessions<span class="chevron" aria-hidden="true"></span></summary>
				<div class="accordion-body">
					${buildSessionSection()}
				</div>
			</details>
			<details class="accordion-item" id="accordion-scanner" name="ariadne-settings">
				<summary>Core<span class="chevron" aria-hidden="true"></span></summary>
				<div class="accordion-body">
					${buildScannerSection(model)}
				</div>
			</details>
			<details class="accordion-item" id="accordion-scripting" name="ariadne-settings">
				<summary>Scripting<span class="chevron" aria-hidden="true"></span></summary>
				<div class="accordion-body">
					${buildScriptingSection(model)}
				</div>
			</details>
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			const accordionIds = ['accordion-account', 'accordion-session', 'accordion-scanner', 'accordion-scripting'];

			function restoreAccordion() {
				const saved = vscode.getState()?.openSection;
				const openId = saved === null
					? null
					: (accordionIds.includes(saved) ? saved : 'accordion-account');
				for (const id of accordionIds) {
					const section = document.getElementById(id);
					if (section) {
						section.open = id === openId;
					}
				}
			}

			restoreAccordion();

			for (const id of accordionIds) {
				document.getElementById(id)?.addEventListener('toggle', (event) => {
					const section = event.currentTarget;
					const state = vscode.getState() ?? {};
					if (section.open) {
						vscode.setState({ ...state, openSection: section.id });
						return;
					}
					if (state.openSection === section.id) {
						vscode.setState({ ...state, openSection: null });
					}
				});
			}

			const termsCheckbox = document.getElementById('terms-checkbox');
			const privacyCheckbox = document.getElementById('privacy-checkbox');
			const signInBtn = document.getElementById('sign-in-btn');
			const signOutBtn = document.getElementById('sign-out-btn');
			const retryBtn = document.getElementById('retry-btn');
			const initRulesBtn = document.getElementById('init-rules-btn');
			const resetRulesBtn = document.getElementById('reset-rules-btn');
			const exportSessionBtn = document.getElementById('export-session-btn');
			const clearSessionBtn = document.getElementById('clear-session-btn');

			function updateSignInEnabled() {
				if (!signInBtn || !termsCheckbox || !privacyCheckbox) {
					return;
				}
				signInBtn.disabled = !(termsCheckbox.checked && privacyCheckbox.checked);
			}

			termsCheckbox?.addEventListener('change', updateSignInEnabled);
			privacyCheckbox?.addEventListener('change', updateSignInEnabled);
			updateSignInEnabled();

			signInBtn?.addEventListener('click', () => {
				if (!termsCheckbox?.checked || !privacyCheckbox?.checked) {
					return;
				}
				vscode.postMessage({
					type: 'github-sign-in',
					termsAccepted: true,
					privacyAccepted: true,
				});
			});

			signOutBtn?.addEventListener('click', () => {
				vscode.postMessage({ type: 'github-sign-out' });
			});

			retryBtn?.addEventListener('click', () => {
				vscode.postMessage({ type: 'github-auth-refresh' });
			});

			initRulesBtn?.addEventListener('click', () => {
				if (initRulesBtn.disabled) {
					return;
				}
				vscode.postMessage({ type: 'init-rule-scripts' });
			});

			resetRulesBtn?.addEventListener('click', () => {
				if (resetRulesBtn.disabled) {
					return;
				}
				vscode.postMessage({ type: 'reset-rule-scripts' });
			});

			exportSessionBtn?.addEventListener('click', () => {
				vscode.postMessage({ type: 'export-session-data' });
			});

			clearSessionBtn?.addEventListener('click', () => {
				vscode.postMessage({ type: 'clear-session-data' });
			});

			const scannerSpinner = '<span class="spin" role="status" aria-label="Loading"></span>';

			function readScannerCatalog() {
				const node = document.getElementById('scanner-catalog');
				try {
					return JSON.parse(node && node.textContent ? node.textContent : '{}');
				} catch {
					return {};
				}
			}

			function labelForTarget(id) {
				const catalog = readScannerCatalog();
				for (const items of Object.values(catalog)) {
					if (!Array.isArray(items)) {
						continue;
					}
					const match = items.find((item) => item && item.id === id);
					if (match) {
						return match.label;
					}
				}
				return '';
			}

			function setScannerBusy(icon) {
				const controls = document.getElementById('scanner-controls');
				if (!controls) {
					return;
				}
				controls.classList.add('is-busy');
				controls.setAttribute('aria-busy', 'true');
				for (const el of controls.querySelectorAll('button, select')) {
					el.disabled = true;
				}
				if (icon && icon.hasAttribute('data-delete-target')) {
					icon.outerHTML = scannerSpinner;
					return;
				}
				const status = document.getElementById('scanner-status');
				if (status) {
					status.innerHTML = scannerSpinner;
				}
			}

			function showCurrentTarget(id) {
				const label = document.getElementById('scanner-current-label');
				const text = labelForTarget(id);
				if (label && text) {
					label.textContent = text;
				}
			}

			function fillBinarySelect(os) {
				const select = document.getElementById('scanner-target');
				const items = readScannerCatalog()[os] || [];
				if (!select || items.length === 0) {
					return select ? select.value : '';
				}
				const current = select.value;
				const next = items.some((item) => item.id === current) ? current : items[0].id;
				select.replaceChildren();
				for (const item of items) {
					const option = document.createElement('option');
					option.value = item.id;
					option.textContent = item.label;
					if (item.id === next) {
						option.selected = true;
					}
					select.appendChild(option);
				}
				showCurrentTarget(next);
				return next;
			}

			document.getElementById('scanner-auto')?.addEventListener('click', (event) => {
				const button = event.currentTarget;
				if (button.disabled) {
					return;
				}
				const auto = button.getAttribute('aria-checked') !== 'true';
				button.setAttribute('aria-checked', auto ? 'true' : 'false');
				const manual = document.getElementById('scanner-manual');
				if (manual) {
					if (auto) {
						manual.setAttribute('hidden', '');
					} else {
						manual.removeAttribute('hidden');
					}
				}
				const controls = document.getElementById('scanner-controls');
				const host = controls ? controls.getAttribute('data-host-target') : '';
				const selected = document.getElementById('scanner-target');
				showCurrentTarget(auto ? host : (selected ? selected.value : ''));
				setScannerBusy();
				vscode.postMessage({ type: 'scanner-set-auto', auto });
			});

			document.getElementById('scanner-os')?.addEventListener('change', (event) => {
				const select = event.currentTarget;
				if (select.disabled) {
					return;
				}
				fillBinarySelect(select.value);
				setScannerBusy();
				vscode.postMessage({ type: 'scanner-set-os', os: select.value });
			});

			document.getElementById('scanner-target')?.addEventListener('change', (event) => {
				const select = event.currentTarget;
				if (select.disabled) {
					return;
				}
				showCurrentTarget(select.value);
				setScannerBusy();
				vscode.postMessage({ type: 'scanner-set-target', target: select.value });
			});

			for (const button of document.querySelectorAll('[data-download-target]')) {
				button.addEventListener('click', () => {
					if (button.disabled) {
						return;
					}
					setScannerBusy(button);
					vscode.postMessage({
						type: 'scanner-download',
						target: button.getAttribute('data-download-target'),
					});
				});
			}

			for (const button of document.querySelectorAll('[data-delete-target]')) {
				button.addEventListener('click', () => {
					if (button.disabled) {
						return;
					}
					setScannerBusy(button);
					vscode.postMessage({
						type: 'scanner-delete',
						target: button.getAttribute('data-delete-target'),
					});
				});
			}

			document.getElementById('highlights-visible')?.addEventListener('click', (event) => {
				const button = event.currentTarget;
				const visible = button.getAttribute('aria-checked') !== 'true';
				button.setAttribute('aria-checked', visible ? 'true' : 'false');
				vscode.postMessage({ type: 'highlights-set-visible', visible });
			});

			document.getElementById('open-panel-on-startup')?.addEventListener('click', (event) => {
				const button = event.currentTarget;
				const enabled = button.getAttribute('aria-checked') !== 'true';
				button.setAttribute('aria-checked', enabled ? 'true' : 'false');
				vscode.postMessage({ type: 'open-panel-on-startup', enabled });
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
