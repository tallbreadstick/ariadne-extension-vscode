import * as vscode from 'vscode';

/**
 * HTML Builder and Webview Panel for the Ariadne Onboarding Guide.
 * Implements Option A: Custom Themed Webview Tab with interactive navigation actions.
 */

// ── SVGs ─────────────────────────────────────────────────────────────

const SHIELD_SVG = /* html */ `
<svg class="hero-badge-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<path fill-rule="evenodd" clip-rule="evenodd" d="M8 1.5l5.5 2v4.5c0 3.5-2.5 6-5.5 7-3-1-5.5-3.5-5.5-7V3.5L8 1.5zm0 1.55l4.5 1.7v3.75c0 2.85-1.9 4.85-4.5 5.7-2.6-.85-4.5-2.85-4.5-5.7V4.5L8 3.05z"/>
</svg>`;

const SETTINGS_SVG = /* html */ `
<svg class="feature-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<path fill-rule="evenodd" clip-rule="evenodd" d="M9.1 1h-2.2l-.3 1.6-.8.3-1.3-1-1.6 1.6 1 1.3-.3.8L2 5.9v2.2l1.6.3.3.8-1 1.3 1.6 1.6 1.3-1 .8.3.3 1.6h2.2l.3-1.6.8-.3 1.3 1 1.6-1.6-1-1.3.3-.8 1.6-.3V5.9l-1.6-.3-.3-.8 1-1.3-1.6-1.6-1.3 1-.8-.3L9.1 1zm-1.1 5a2 2 0 100 4 2 2 0 000-4z"/>
</svg>`;

const VULN_SVG = /* html */ `
<svg class="feature-icon vuln" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<path fill-rule="evenodd" clip-rule="evenodd" d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.72L8 2.28zM7.5 5.5h1v4h-1v-4zm.5 6a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
</svg>`;

const REPORT_SVG = /* html */ `
<svg class="feature-icon report" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<rect x="1" y="9" width="3" height="6" rx="0.5"/>
	<rect x="5" y="5" width="3" height="10" rx="0.5"/>
	<rect x="9" y="2" width="3" height="13" rx="0.5"/>
	<rect x="13" y="7" width="3" height="8" rx="0.5"/>
</svg>`;

const HIGHLIGHT_SVG = /* html */ `
<svg class="feature-icon highlight" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z"/>
	<path d="M10 3l3 3"/>
	<path d="M2 15h12"/>
</svg>`;

const LIGHTBULB_SVG = /* html */ `
<svg class="demo-tag-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<path d="M8 1.5a5 5 0 0 0-3.4 8.67l.4.33v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2l.4-.33A5 5 0 0 0 8 1.5zm-2 13h4v1H6v-1z"/>
</svg>`;

const STEP_SAVE_SVG = /* html */ `
<svg class="step-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<path d="M3 2h7.5l3 3V13a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011.5 13V3.5A1.5 1.5 0 013 2z"/>
	<path d="M4.5 2v3.5h6V2"/>
	<path d="M4.5 14.5v-5h7v5"/>
</svg>`;

const STEP_SCAN_SVG = /* html */ `
<svg class="step-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<path d="M14 2.5A8 8 0 002.5 14"/>
	<circle cx="8" cy="8" r="2.5"/>
	<path d="M8 8l4-4"/>
</svg>`;

const STEP_DURABILITY_SVG = /* html */ `
<svg class="step-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<path d="M8 1.5l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6v-4l5-2z"/>
	<path d="M5.5 7.5l2 2 3-3"/>
</svg>`;

const STEP_TIMER_SVG = /* html */ `
<svg class="step-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<circle cx="8" cy="8" r="6"/>
	<path d="M8 4.5v3.5l2.5 1.5"/>
</svg>`;

const STEP_TERMINATION_SVG = /* html */ `
<svg class="step-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<path d="M8 2v5"/>
	<path d="M4.8 4.8a5.5 5.5 0 106.4 0"/>
</svg>`;

const STEP_COMMON_VULN_SVG = /* html */ `
<svg class="step-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<circle cx="8" cy="8" r="6.25"/>
	<path d="M8 5v3.5"/>
	<circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
</svg>`;

const READY_CHECK_SVG = /* html */ `
<svg class="closing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	<circle cx="12" cy="12" r="10"/>
	<path d="m8.5 12.5 2.5 2.5 5-5"/>
</svg>`;

export interface OnboardingMediaUris {
	step21GifUri?: string;
	step24GifUri?: string;
	step25GifUri?: string;
	cspSource?: string;
}

const CSS = /* css */ `
	:root {
		color-scheme: dark;
		--bg: var(--vscode-editor-background);
		--fg: var(--vscode-foreground);
		--muted: var(--vscode-descriptionForeground);
		--border: var(--vscode-panel-border, #333333);
		--card-bg: var(--vscode-editorWidget-background, #1e1e1e);
		--badge-bg: var(--vscode-badge-background, #3c3c3c);
		--badge-fg: var(--vscode-badge-foreground, #ffffff);
		--btn-bg: var(--vscode-button-background, #007acc);
		--btn-fg: var(--vscode-button-foreground, #ffffff);
		--btn-hover: var(--vscode-button-hoverBackground, #0062a3);
		--btn-sec-bg: var(--vscode-button-secondaryBackground, #3a3d41);
		--btn-sec-fg: var(--vscode-button-secondaryForeground, #ffffff);
		--btn-sec-hover: var(--vscode-button-secondaryHoverBackground, #45494e);
		--accent: var(--vscode-textLink-foreground, #3794ff);
		--accent-hover: var(--vscode-textLink-activeForeground, #70b4ff);
		--success: #4ec9b0;
		--warning: #cca700;
	}

	* {
		box-sizing: border-box;
	}

	body {
		margin: 0;
		padding: 32px 24px 64px;
		background: var(--bg);
		color: var(--fg);
		font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
		font-size: 13px;
		line-height: 1.6;
		display: flex;
		justify-content: center;
	}

	.container {
		width: 100%;
		max-width: 820px;
	}

	/* Hero Header */
	.hero {
		text-align: center;
		padding: 24px 16px 32px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 32px;
	}

	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
		padding: 4px 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 14px;
	}

	.hero-badge-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.hero h1 {
		margin: 0 0 10px;
		font-size: 26px;
		font-weight: 700;
		letter-spacing: -0.4px;
	}

	.hero p {
		margin: 0 auto;
		max-width: 620px;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.6;
	}

	/* Section Headings */
	.section {
		margin-bottom: 40px;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 18px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 10px;
	}

	.section-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--btn-bg);
		color: var(--btn-fg);
		font-weight: 700;
		font-size: 12px;
	}

	.section-title {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	/* Process List */
	.process-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
	}

	.process-card {
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 14px 16px;
		display: flex;
		gap: 14px;
		align-items: flex-start;
		transition: border-color 0.15s ease;
	}

	.process-card:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}

	.process-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.process-icon-wrap {
		width: 32px;
		height: 32px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.step-svg {
		width: 16px;
		height: 16px;
	}

	.process-step {
		font-weight: 600;
		font-size: 11px;
		background: var(--badge-bg);
		color: var(--badge-fg);
		padding: 2px 6px;
		border-radius: 3px;
		white-space: nowrap;
	}

	.process-body {
		flex: 1;
		min-width: 0;
	}

	.process-body h4 {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 600;
	}

	.process-body p {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
		line-height: 1.5;
	}

	.demo-media-wrapper {
		margin-top: 10px;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
		background: color-mix(in srgb, var(--card-bg) 60%, black);
		display: flex;
		flex-direction: column;
	}

	.demo-media {
		width: 100%;
		height: auto;
		display: block;
		border: none;
		max-height: 280px;
		object-fit: contain;
		background: #1e1e1e;
	}

	.demo-media-caption {
		font-size: 11px;
		color: var(--muted);
		padding: 5px 10px;
		background: color-mix(in srgb, var(--card-bg) 80%, black);
		border-top: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 6px;
		line-height: 1.4;
	}

	.demo-media-caption .caption-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		display: inline-block;
		flex-shrink: 0;
	}

	/* Feature Cards Grid */
	.features-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	@media (max-width: 680px) {
		.features-grid {
			grid-template-columns: 1fr;
		}
	}

	.feature-card {
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		transition: border-color 0.15s ease;
	}

	.feature-card:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.feature-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
		gap: 8px;
	}

	.feature-title-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.feature-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.feature-icon {
		width: 16px;
		height: 16px;
		color: var(--accent);
		flex-shrink: 0;
	}

	.feature-icon.vuln {
		color: var(--warning);
	}

	.feature-icon.report {
		color: var(--accent);
	}

	.feature-icon.highlight {
		color: var(--success);
	}

	.location-badge {
		font-size: 11px;
		font-weight: 500;
		padding: 2px 6px;
		border-radius: 3px;
		background: var(--badge-bg);
		color: var(--badge-fg);
		white-space: nowrap;
	}

	.feature-desc {
		margin: 0 0 14px;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.5;
		flex-grow: 1;
	}

	/* Action Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: var(--btn-bg);
		color: var(--btn-fg);
		border: 1px solid var(--vscode-button-border, transparent);
		border-radius: 2px;
		padding: 7px 12px;
		font-size: 13px;
		font-weight: 400;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s ease-out, border-color 0.15s ease-out;
		width: 100%;
	}

	.btn:hover {
		background: var(--btn-hover);
	}

	.btn-secondary {
		background: transparent;
		color: var(--fg);
		border-color: var(--input-border, var(--border));
	}

	.btn-secondary:hover {
		background: color-mix(in srgb, var(--fg) 6%, transparent);
	}

	/* Highlight Demonstration Box */
	.demo-box {
		background: color-mix(in srgb, var(--card-bg) 60%, black);
		border-left: 3px solid var(--warning);
		padding: 8px 10px;
		border-radius: 0 3px 3px 0;
		font-family: var(--vscode-editor-font-family, Consolas, monospace);
		font-size: 11px;
		margin-bottom: 12px;
		color: var(--fg);
		overflow-x: auto;
	}

	.demo-tag {
		color: var(--warning);
		font-style: italic;
		font-size: 11px;
		margin-left: 8px;
		display: inline-flex;
		align-items: center;
	}

	.demo-tag-icon {
		width: 12px;
		height: 12px;
		margin-right: 4px;
		vertical-align: text-bottom;
	}

	/* Closing Hero */
	.closing {
		text-align: center;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 28px 24px;
		margin-top: 16px;
	}

	.closing-badge {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--success) 14%, transparent);
		color: var(--success);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
	}

	.closing-icon {
		width: 24px;
		height: 24px;
	}

	.closing h3 {
		margin: 0 0 8px;
		font-size: 18px;
		font-weight: 600;
	}

	.closing p {
		margin: 0 auto 20px;
		max-width: 520px;
		color: var(--muted);
		font-size: 13px;
	}

	.closing .btn {
		width: auto;
		min-width: 180px;
		padding: 9px 24px;
		font-size: 13px;
		font-weight: 500;
	}
`;

export function buildOnboardingHtml(mediaUris?: OnboardingMediaUris): string {
	const cspSource = mediaUris?.cspSource;
	const step21GifUri = mediaUris?.step21GifUri ?? 'media/Step 2.1 Session Started (Optimized).gif';
	const step24GifUri = mediaUris?.step24GifUri ?? 'media/Step 2.4 Session Started (Optimized).gif';
	const step25GifUri = mediaUris?.step25GifUri ?? 'media/Step 2.45 Session Started (optimized).gif';

	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy"
			content="default-src 'none'; img-src ${cspSource ? cspSource + ' data:' : "'self' data:"}; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Welcome to Ariadne</title>
		<style>${CSS}</style>
	</head>
	<body>
		<div class="container">
			<!-- Hero Header -->
			<header class="hero">
				<div class="hero-badge">
					${SHIELD_SVG}
					<span>Student Security Companion</span>
				</div>
				<h1>Welcome to Ariadne</h1>
				<p>
					Ariadne is a pedagogical static analysis assistant for Java in VS Code. It automatically monitors 
					your code for security vulnerabilities as you write, providing guided conceptual explanations 
					to help you fix security flaws independently without giving away the solutions.
				</p>
			</header>

			<!-- Section 1: Saving & Scanning Process -->
			<section class="section">
				<div class="section-header">
					<span class="section-number">1</span>
					<h2 class="section-title">The Saving &amp; Scanning Lifecycle</h2>
				</div>
				<div class="process-grid">
					<div class="process-card">
						<div class="process-indicator">
							<span class="process-icon-wrap">${STEP_SAVE_SVG}</span>
							<span class="process-step">Step 2.1</span>
						</div>
						<div class="process-body">
							<h4>Session Begins on First Save</h4>
							<p>
								Your active coding session starts automatically on your <strong>first file save (Ctrl+S)</strong>. 
								If you have worked on this project before, your historical security metrics and baselines 
								will be restored seamlessly.
							</p>
							${step21GifUri ? /* html */ `
							<div class="demo-media-wrapper">
								<img src="${step21GifUri}" alt="Session start transition" class="demo-media" loading="lazy" />
								<div class="demo-media-caption">
									<span class="caption-dot"></span>
									<span>Visual indicator: Session status transitions from "NOT STARTED" to active on first save.</span>
								</div>
							</div>` : ''}
						</div>
					</div>

					<div class="process-card">
						<div class="process-indicator">
							<span class="process-icon-wrap">${STEP_SCAN_SVG}</span>
							<span class="process-step">Step 2.2</span>
						</div>
						<div class="process-body">
							<h4>Near Real-Time Vulnerability Scanning</h4>
							<p>
								Scanning is near real-time as you write. Each detected vulnerability instance is logged, 
								fingerprinted, and tracked throughout its entire lifecycle.
							</p>
						</div>
					</div>

					<div class="process-card">
						<div class="process-indicator">
							<span class="process-icon-wrap">${STEP_DURABILITY_SVG}</span>
							<span class="process-step">Step 2.3</span>
						</div>
						<div class="process-body">
							<h4>Full Report Multi-Save Durability</h4>
							<p>
								The Full Report updates over multiple saves to verify the <strong>durability</strong> of your fixes, 
								preventing accidental regressions or commented-out code from distorting your progress.
							</p>
						</div>
					</div>

					<div class="process-card">
						<div class="process-indicator">
							<span class="process-icon-wrap">${STEP_TIMER_SVG}</span>
							<span class="process-step">Step 2.4</span>
						</div>
						<div class="process-body">
							<h4>Periodic Hourly Auto-Scan</h4>
							<p>
								An automatic full-workspace scan runs every 60 minutes to ensure vulnerability records 
								reflect the current state of your entire project.
							</p>
							${step24GifUri ? /* html */ `
							<div class="demo-media-wrapper">
								<img src="${step24GifUri}" alt="Hourly auto-scan notification" class="demo-media" loading="lazy" />
								<div class="demo-media-caption">
									<span class="caption-dot"></span>
									<span>Visual indicator: Background scan checkpoint completes every 60 minutes.</span>
								</div>
							</div>` : ''}
						</div>
					</div>

					<div class="process-card">
						<div class="process-indicator">
							<span class="process-icon-wrap">${STEP_COMMON_VULN_SVG}</span>
							<span class="process-step">Step 2.5</span>
						</div>
						<div class="process-body">
							<h4>2-Hour Habit Tracking in Common Vulnerabilities</h4>
							<p>
								If the same vulnerability remains unfixed and persists for 2 hours across your coding session, 
								it is recognized as a recurring habit and appears under <strong>Common Vulnerabilities</strong> 
								in your Full Report so you can focus on mastering that security pattern.
							</p>
							${step25GifUri ? /* html */ `
							<div class="demo-media-wrapper">
								<img src="${step25GifUri}" alt="Common vulnerabilities promotion" class="demo-media" loading="lazy" />
								<div class="demo-media-caption">
									<span class="caption-dot"></span>
									<span>Visual indicator: Persistent vulnerability promoted to Common Vulnerabilities in the Full Report.</span>
								</div>
							</div>` : ''}
						</div>
					</div>

					<div class="process-card">
						<div class="process-indicator">
							<span class="process-icon-wrap">${STEP_TERMINATION_SVG}</span>
							<span class="process-step">Step 2.6</span>
						</div>
						<div class="process-body">
							<h4>Safe Session Termination</h4>
							<p>
								Your session terminates and safely persists when VS Code is closed. In the event of an abrupt close 
								or crash, Ariadne's crash recovery system protects your historical learning baselines.
							</p>
						</div>
					</div>
				</div>
			</section>

			<!-- Section 2: Extension Features & Navigation -->
			<section class="section">
				<div class="section-header">
					<span class="section-number">2</span>
					<h2 class="section-title">Core Features &amp; Where to Find Them</h2>
				</div>
				<div class="features-grid">
					<!-- Settings Feature -->
					<div class="feature-card">
						<div>
							<div class="feature-header">
								<div class="feature-title-group">
									${SETTINGS_SVG}
									<h3 class="feature-title">Sidebar Settings</h3>
								</div>
								<span class="location-badge">Activity Bar (Left)</span>
							</div>
							<p class="feature-desc">
								Manage your GitHub authentication, toggle inline code highlight visibility, 
								access the help guide, and manage custom rule scripts across organized accordions.
							</p>
						</div>
						<button class="btn btn-secondary" data-action="openSettings">
							Open Settings Panel
						</button>
					</div>

					<!-- Active Vulnerabilities Feature -->
					<div class="feature-card">
						<div>
							<div class="feature-header">
								<div class="feature-title-group">
									${VULN_SVG}
									<h3 class="feature-title">Active Vulnerabilities</h3>
								</div>
								<span class="location-badge">Bottom Panel (Left)</span>
							</div>
							<p class="feature-desc">
								View all active vulnerability findings from your scans. Features the <strong>Session Progress Bar</strong>, 
								the <strong>Next Focus</strong> recommendation chip, collapsible filter drawer, click-to-navigate code links, 
								and <strong>Explain Vulnerability</strong> learning actions.
							</p>
						</div>
						<button class="btn" data-action="openActiveVulnerabilities">
							Open Active Vulnerabilities
						</button>
					</div>

					<!-- Full Report Feature -->
					<div class="feature-card">
						<div>
							<div class="feature-header">
								<div class="feature-title-group">
									${REPORT_SVG}
									<h3 class="feature-title">Full Report</h3>
								</div>
								<span class="location-badge">Bottom Panel (Right)</span>
							</div>
							<p class="feature-desc">
								Inspect your comprehensive security dashboard. Displays finding counts by severity, qualitative trend badges 
								(<em>Some progress</em>, <em>Clear progress</em>), recurring <strong>Common Vulnerability</strong> habit tracking, 
								and interactive click-to-filter support.
							</p>
						</div>
						<button class="btn" data-action="openFullReport">
							Open Full Report
						</button>
					</div>

					<!-- Inline Code Highlighting Feature -->
					<div class="feature-card">
						<div>
							<div class="feature-header">
								<div class="feature-title-group">
									${HIGHLIGHT_SVG}
									<h3 class="feature-title">Inline Highlighting</h3>
								</div>
								<span class="location-badge">Editor Pane</span>
							</div>
							<p class="feature-desc">
								Affected code lines are highlighted with a soft whole-line background tint, an overview scrollbar tick, and an italic label. 
								Hover over any highlight to inspect flaw details or click <strong>[💡 Explain Vulnerability]</strong>.
							</p>
							<div class="demo-box">
								<code>String q = "SELECT * FROM users WHERE id=" + id;</code>
								<span class="demo-tag">${LIGHTBULB_SVG} [Ariadne] SQL Injection</span>
							</div>
						</div>
						<button class="btn btn-secondary" data-action="openActiveVulnerabilities">
							Inspect Current Findings
						</button>
					</div>
				</div>
			</section>

			<!-- Section 3: Friendly Exit / Closing Message -->
			<section class="closing">
				<div class="closing-badge">
					${READY_CHECK_SVG}
				</div>
				<h3>You're Ready to Code!</h3>
				<p>
					Enjoy your experience with Ariadne. Remember: Ariadne is designed to guide your learning, 
					helping you identify weaknesses and understand secure coding principles along the way.
				</p>
				<button class="btn" data-action="startCoding">
					Start Coding with Ariadne
				</button>
			</section>
		</div>

		<script>
			const vscode = acquireVsCodeApi();

			document.querySelectorAll('[data-action]').forEach(btn => {
				btn.addEventListener('click', () => {
					const action = btn.getAttribute('data-action');
					vscode.postMessage({ action });
				});
			});
		</script>
	</body>
</html>`;
}

/**
 * Controller to show and manage the Onboarding Guide Webview Panel.
 */
let currentOnboardingPanel: vscode.WebviewPanel | undefined;

export function showOnboardingPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
	if (currentOnboardingPanel) {
		currentOnboardingPanel.reveal(vscode.ViewColumn.One);
		return currentOnboardingPanel;
	}

	const panel = vscode.window.createWebviewPanel(
		'ariadne.onboardingGuide',
		'Welcome to Ariadne — Onboarding Guide',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [
				vscode.Uri.joinPath(context.extensionUri, 'media'),
			],
		},
	);

	const step21GifUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'media', 'Step 2.1 Session Started (Optimized).gif'),
	).toString();

	const step24GifUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'media', 'Step 2.4 Session Started (Optimized).gif'),
	).toString();

	const step25GifUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'media', 'Step 2.45 Session Started (optimized).gif'),
	).toString();

	panel.webview.html = buildOnboardingHtml({
		step21GifUri,
		step24GifUri,
		step25GifUri,
		cspSource: panel.webview.cspSource,
	});

	panel.webview.onDidReceiveMessage(
		async (message: { action?: string }) => {
			switch (message.action) {
				case 'openSettings':
					await vscode.commands.executeCommand('ariadne.sidebar.signIn.focus');
					break;
				case 'openActiveVulnerabilities':
					await vscode.commands.executeCommand('ariadne.panel.activeVulnerabilities.focus');
					break;
				case 'openFullReport':
					await vscode.commands.executeCommand('ariadne.panel.sessionMetrics.focus');
					break;
				case 'startCoding':
					panel.dispose();
					break;
			}
		},
		undefined,
		context.subscriptions,
	);

	panel.onDidDispose(() => {
		currentOnboardingPanel = undefined;
	});

	currentOnboardingPanel = panel;
	return panel;
}

/**
 * Checks if the user has completed or seen onboarding.
 * If not, automatically opens the onboarding panel and sets the flag in global storage.
 *
 * @param context ExtensionContext
 * @returns true if onboarding panel was newly opened, false if already seen
 */
export async function checkAndShowOnboarding(context: vscode.ExtensionContext): Promise<boolean> {
	const hasSeen = context.globalState.get<boolean>('ariadne.hasSeenOnboarding');
	if (hasSeen) {
		return false;
	}

	showOnboardingPanel(context);
	await context.globalState.update('ariadne.hasSeenOnboarding', true);
	return true;
}

/**
 * Resets the onboarding state for testing/debugging.
 */
export async function resetOnboardingState(globalState: vscode.Memento): Promise<void> {
	await globalState.update('ariadne.hasSeenOnboarding', undefined);
}
