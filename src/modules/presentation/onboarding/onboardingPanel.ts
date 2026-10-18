import * as vscode from 'vscode';

/**
 * HTML Builder and Webview Panel for the Ariadne Onboarding Guide.
 * Implements Option A: Custom Themed Webview Tab with interactive navigation actions.
 */

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
		--accent-rgb: 55, 148, 255;
		--success: #4ec9b0;
		--warning: #cca700;
	}

	* {
		box-sizing: border-box;
	}

	body {
		margin: 0;
		padding: 32px 24px 60px;
		background: var(--bg);
		color: var(--fg);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		font-size: 14px;
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
		background: rgba(var(--accent-rgb), 0.12);
		color: var(--accent);
		border: 1px solid rgba(var(--accent-rgb), 0.3);
		padding: 4px 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 14px;
	}

	.hero h1 {
		margin: 0 0 10px;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.5px;
	}

	.hero p {
		margin: 0 auto;
		max-width: 620px;
		color: var(--muted);
		font-size: 15px;
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
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--btn-bg);
		color: var(--btn-fg);
		font-weight: 700;
		font-size: 13px;
	}

	.section-title {
		margin: 0;
		font-size: 18px;
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
		border-radius: 8px;
		padding: 14px 18px;
		display: flex;
		gap: 16px;
		align-items: flex-start;
		transition: border-color 0.15s ease;
	}

	.process-card:hover {
		border-color: rgba(var(--accent-rgb), 0.5);
	}

	.process-step {
		font-weight: 700;
		font-size: 12px;
		background: var(--badge-bg);
		color: var(--badge-fg);
		padding: 3px 8px;
		border-radius: 4px;
		white-space: nowrap;
		margin-top: 2px;
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
		border-radius: 8px;
		padding: 18px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		transition: transform 0.15s ease, border-color 0.15s ease;
	}

	.feature-card:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
	}

	.feature-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 8px;
		gap: 8px;
	}

	.feature-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.location-badge {
		font-size: 11px;
		font-weight: 500;
		padding: 2px 7px;
		border-radius: 4px;
		background: var(--badge-bg);
		color: var(--badge-fg);
		white-space: nowrap;
	}

	.feature-desc {
		margin: 0 0 14px;
		color: var(--muted);
		font-size: 13px;
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
		border: none;
		border-radius: 4px;
		padding: 7px 14px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s ease;
		width: 100%;
	}

	.btn:hover {
		background: var(--btn-hover);
	}

	.btn-secondary {
		background: var(--btn-sec-bg);
		color: var(--btn-sec-fg);
	}

	.btn-secondary:hover {
		background: var(--btn-sec-hover);
	}

	/* Highlight Demonstration Box */
	.demo-box {
		background: rgba(0, 0, 0, 0.25);
		border-left: 3px solid var(--warning);
		padding: 8px 12px;
		border-radius: 0 4px 4px 0;
		font-family: var(--vscode-editor-font-family, Consolas, monospace);
		font-size: 12px;
		margin-bottom: 12px;
		color: var(--fg);
	}

	.demo-tag {
		color: var(--warning);
		font-style: italic;
		font-size: 11px;
		margin-left: 8px;
	}

	/* Closing Hero */
	.closing {
		text-align: center;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 28px 24px;
		margin-top: 16px;
	}

	.closing h3 {
		margin: 0 0 8px;
		font-size: 18px;
		font-weight: 600;
	}

	.closing p {
		margin: 0 auto 20px;
		max-width: 500px;
		color: var(--muted);
		font-size: 14px;
	}

	.closing .btn {
		width: auto;
		min-width: 180px;
		padding: 10px 24px;
		font-size: 14px;
		font-weight: 600;
	}
`;

export function buildOnboardingHtml(): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy"
			content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Welcome to Ariadne</title>
		<style>${CSS}</style>
	</head>
	<body>
		<div class="container">
			<!-- Hero Header -->
			<header class="hero">
				<div class="hero-badge">🛡️ Student Security Companion</div>
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
					<h2 class="section-title">The Saving & Scanning Lifecycle</h2>
				</div>
				<div class="process-grid">
					<div class="process-card">
						<span class="process-step">Step 2.1</span>
						<div class="process-body">
							<h4>Session Begins on First Save</h4>
							<p>
								Your active coding session starts automatically on your <strong>first file save (Ctrl+S)</strong>. 
								If you have worked on this project before, your historical security metrics and baselines 
								will be restored seamlessly.
							</p>
						</div>
					</div>

					<div class="process-card">
						<span class="process-step">Step 2.2</span>
						<div class="process-body">
							<h4>Near Real-Time Vulnerability Scanning</h4>
							<p>
								Scanning is near real-time as you write. Each detected vulnerability instance is logged, 
								fingerprinted, and tracked throughout its entire lifecycle.
							</p>
						</div>
					</div>

					<div class="process-card">
						<span class="process-step">Step 2.3</span>
						<div class="process-body">
							<h4>Full Report Multi-Save Durability</h4>
							<p>
								The Full Report updates over multiple saves to verify the <strong>durability</strong> of your fixes, 
								preventing accidental regressions or commented-out code from distorting your progress.
							</p>
						</div>
					</div>

					<div class="process-card">
						<span class="process-step">Step 2.4</span>
						<div class="process-body">
							<h4>Periodic Hourly Auto-Scan</h4>
							<p>
								An automatic full-workspace scan runs every hour (configurable from 2 to 180 minutes in Settings) 
								to ensure vulnerability records reflect the current state of your entire project.
							</p>
						</div>
					</div>

					<div class="process-card">
						<span class="process-step">Step 2.5</span>
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
					<h2 class="section-title">Core Features & Where to Find Them</h2>
				</div>
				<div class="features-grid">
					<!-- Settings Feature -->
					<div class="feature-card">
						<div>
							<div class="feature-header">
								<h3 class="feature-title">⚙️ Sidebar Settings</h3>
								<span class="location-badge">Activity Bar (Left)</span>
							</div>
							<p class="feature-desc">
								Manage your GitHub authentication, configure background auto-scan intervals (2–180 min), 
								toggle inline code highlight visibility, and manage custom rule scripts across 4 organized accordions.
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
								<h3 class="feature-title">📋 Active Vulnerabilities</h3>
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
								<h3 class="feature-title">📊 Full Report</h3>
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
								<h3 class="feature-title">🖊️ Inline Highlighting</h3>
								<span class="location-badge">Editor Pane</span>
							</div>
							<p class="feature-desc">
								Affected code lines are highlighted with a soft whole-line background tint, an overview scrollbar tick, and an italic label. 
								Hover over any highlight to inspect flaw details or click <strong>[💡 Explain Vulnerability]</strong>.
							</p>
							<div class="demo-box">
								<code>String q = "SELECT * FROM users WHERE id=" + id;</code>
								<span class="demo-tag">[Ariadne] SQL Injection</span>
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
				<h3>🎉 You're Ready to Code!</h3>
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
		},
	);

	panel.webview.html = buildOnboardingHtml();

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
