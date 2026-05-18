// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from '../src/modules/detection/bridge/iostream';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "ariadne-extension-vscode" is now active!',
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand(
		'ariadne-extension-vscode.helloWorld',
		() => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage('Hello World from ariadne!');
		},
	);

	const baseHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
	const sessionMetricsHtml = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Session Metrics</title>
		<style>
			:root {
				color-scheme: dark;
				--bg: var(--vscode-editor-background);
				--panel: var(--vscode-sideBar-background);
				--card: var(--vscode-editorWidget-background);
				--border: var(--vscode-panel-border);
				--text: var(--vscode-foreground);
				--muted: var(--vscode-descriptionForeground);
				--accent: #46d5c4; 
				--accent-strong: #5ce6d7;
				--red: var(--vscode-errorForeground);
				--blue: var(--vscode-textLink-activeForeground);
				--radius: 8px;
				--shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent), 0 0 16px color-mix(in srgb, var(--accent) 10%, transparent);
			}

			* {
				box-sizing: border-box;
			}

			body {
				margin: 0;
				padding: 16px;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				background: var(--bg);
				color: var(--text);
			}

			.dashboard {
				display: grid;
				gap: 16px;
			}

			.metrics-grid {
				display: grid;
				gap: 12px;
				grid-template-columns: repeat(2, minmax(0, 1fr));
			}

			.metric-card {
				background: var(--card);
				border: 1px solid var(--border);
				border-radius: var(--radius);
				padding: 12px 14px;
				display: grid;
				gap: 8px;
				min-height: 90px;
				transition: border-color 0.2s ease, box-shadow 0.2s ease;
			}

			.metric-card:hover {
				border-color: rgba(70, 213, 196, 0.55);
				box-shadow: var(--shadow);
			}

			.metric-title {
				font-weight: 600;
				font-size: 13px;
				text-transform: uppercase;
				color: var(--muted);
			}

			.metric-value {
				font-size: 28px;
				font-weight: 600;
				color: #f1f1f1;
			}

			.metric-row {
				display: flex;
				align-items: flex-end;
				justify-content: space-between;
				gap: 8px;
			}

			.metric-trend {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				color: var(--accent);
				font-size: 12px;
				font-weight: 500;
			}

			.trend-icon {
				width: 16px;
				height: 16px;
				display: inline-block;
			}

			.trends-card {
				background: var(--panel);
				border: 1px solid var(--border);
				border-radius: var(--radius);
				padding: 12px 14px 10px;
				display: grid;
				gap: 10px;
			}

			.trends-title {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				font-size: 12px;
				text-transform: uppercase;
				font-weight: 600;
				color: var(--muted);
			}

			.trend-row {
				display: grid;
				grid-template-columns: auto 1fr auto;
				align-items: center;
				gap: 10px;
				padding: 6px 0;
				border-top: 1px solid rgba(58, 58, 58, 0.6);
			}

			.trend-row:first-of-type {
				border-top: none;
			}

			.trend-label {
				font-size: 13px;
				color: var(--text);
			}

			.trend-value {
				font-size: 14px;
				font-weight: 600;
			}

			.trend-red {
				color: var(--red);
			}

			.trend-teal {
				color: var(--accent-strong);
			}

			.trend-blue {
				color: var(--blue);
			}

			.divider {
				height: 1px;
				background: rgba(58, 58, 58, 0.7);
			}

			@media (max-width: 520px) {
				body {
					padding: 12px;
				}

				.metrics-grid {
					grid-template-columns: 1fr;
				}
			}
		</style>
	</head>
	<body>
		<section class="dashboard">
			<div class="metrics-grid">
				<div class="metric-card">
					<div class="metric-title">CRITICAL ISSUES</div>
					<div class="metric-row">
						<div class="metric-value">1</div>
						<div class="metric-trend">
							<svg class="trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M4 16l5-5 4 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
							</svg>
							<span>1</span>
						</div>
					</div>
				</div>
				<div class="metric-card">
					<div class="metric-title">HIGH ISSUES</div>
					<div class="metric-row">
						<div class="metric-value">1</div>
						<div class="metric-trend">
							<svg class="trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M4 16l5-5 4 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
							</svg>
							<span>1</span>
						</div>
					</div>
				</div>
				<div class="metric-card">
					<div class="metric-title">MEDIUM ISSUES</div>
					<div class="metric-row">
						<div class="metric-value">1</div>
						<div class="metric-trend">
							<svg class="trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M4 16l5-5 4 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
							</svg>
							<span>1</span>
						</div>
					</div>
				</div>
				<div class="metric-card">
					<div class="metric-title">LOW ISSUES</div>
					<div class="metric-row">
						<div class="metric-value">1</div>
						<div class="metric-trend">
							<svg class="trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M4 16l5-5 4 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
							</svg>
							<span>1</span>
						</div>
					</div>
				</div>
			</div>

			<div class="divider"></div>

			<div class="trends-card">
				<div class="trends-title">
					<svg class="trend-icon trend-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M4 18V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<path d="M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<path d="M8 14l4-4 3 2 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					TRENDS
				</div>
				<div class="trend-row">
					<svg class="trend-icon trend-red" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M4 8l6 6 4-4 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<div class="trend-label">Persisting Patterns</div>
					<div class="trend-value trend-red">1</div>
				</div>
				<div class="trend-row">
					<svg class="trend-icon trend-teal" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M4 16l6-6 4 4 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<div class="trend-label">Improving Trends</div>
					<div class="trend-value trend-teal">2</div>
				</div>
				<div class="trend-row">
					<svg class="trend-icon trend-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
						<path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<div class="trend-label">Resolved This Session</div>
					<div class="trend-value trend-blue">4</div>
				</div>
			</div>

			<div class="divider"></div>
			
		</section>
	</body>
</html>`;
	const activeVulnsProvider = new AriadneViewProvider(baseHtml);
	const sessionMetricsProvider = new AriadneViewProvider(sessionMetricsHtml);
	const activeVulnsDisposable = vscode.window.registerWebviewViewProvider(
		'ariadne.panel.activeVulnerabilities',
		activeVulnsProvider,
	);
	const sessionMetricsDisposable = vscode.window.registerWebviewViewProvider(
		'ariadne.panel.sessionMetrics',
		sessionMetricsProvider,
	);

	context.subscriptions.push(
		disposable,
		activeVulnsDisposable,
		sessionMetricsDisposable,
	);
	// console.log('test');
	runSession();
}

// This method is called when your extension is deactivated
export function deactivate() {}
