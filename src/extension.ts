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
	const activeVulnsHtml = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ariadne Active Vulnerabilities</title>
        <style>
            :root {
                color-scheme: dark;
                --bg: var(--vscode-editor-background);
                --panel: var(--vscode-sideBar-background);
                --card: var(--vscode-editorWidget-background);
                --border: var(--vscode-panel-border);
                --text: var(--vscode-foreground);
                --muted: var(--vscode-descriptionForeground);
                --critical: #E24B4A;
                --high: #BA7517;
                --medium: #227AD0;
                --low: #5CA221;
                --button-bg: var(--vscode-button-background);
                --button-text: var(--vscode-button-foreground);
                --radius: 10px;
            }

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                padding: 14px 16px 18px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: var(--bg);
                color: var(--text);
            }

            .vuln-stack {
                display: grid;
                gap: 12px;
            }

            details {
                border: 1px solid var(--border);
                border-radius: var(--radius);
                background: var(--card);
                overflow: hidden;
            }

            summary {
                list-style: none;
                cursor: pointer;
                padding: 12px 14px;
                display: grid;
                gap: 8px;
            }

            summary::-webkit-details-marker {
                display: none;
            }

            .summary-row {
                display: flex;
                gap: 10px;
                align-items: center;
                justify-content: space-between;
            }

            /* --- UPDATED SUMMARY LAYOUT --- */
            .summary-left {
                display: flex;
                gap: 12px;
                align-items: flex-start; 
                min-width: 0;
            }

            .summary-content {
                display: flex;
                flex-direction: column;
                gap: 8px; 
                min-width: 0; 
            }

            .summary-header {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .warning-icon {
                width: 16px;
                height: 16px;
                flex: 0 0 auto;
                margin-top: 3px; 
                color: var(--muted); /* Fallback color */
            }

            /* Added severity colors for the warning icons */
            .warning-icon.critical { color: var(--critical); }
            .warning-icon.high { color: var(--high); }
            .warning-icon.medium { color: var(--medium); }
            .warning-icon.low { color: var(--low); }

            .summary-file {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: var(--muted);
            }

            .file-icon {
                width: 14px;
                height: 14px;
                flex: 0 0 auto;
            }
            /* ------------------------------ */

            .badge {
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                color: var(--text);
            }

            .badge.critical { color: white; background-color: var(--critical); }
            .badge.high { color: white; background-color: var(--high); }
            .badge.medium { color: white; background-color: var(--medium); }
            .badge.low { color: white; background-color: var(--low); }

            .issue-title {
                font-weight: 600;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .issue-meta {
                font-size: 12px;
                color: var(--muted);
            }

            .chevron {
                width: 16px;
                height: 16px;
                flex: 0 0 auto;
                color: var(--muted);
                transition: transform 0.2s ease;
            }

            details[open] .chevron {
                transform: rotate(180deg);
            }

            /* --- DETAILS PANEL --- */
            .details-panel {
                border-top: 1px solid var(--border);
                background: var(--panel);
                padding: 12px 14px 14px;
                display: grid;
                gap: 12px;
            }

            .detail-grid {
                display: grid;
                gap: 12px;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .detail-row.span-2 {
                grid-column: 1 / -1;
            }

            .detail-row {
                display: grid;
                gap: 6px;
            }

            .detail-label {
                font-size: 11px;
                text-transform: uppercase;
                color: var(--muted);
                font-weight: 600;
            }

            .detail-value {
                font-size: 13px;
                color: var(--text);
                line-height: 1.4;
            }

            .cta-row {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
            }

            .action-button {
                border: none;
                border-radius: 3px;
                padding: 8px 14px;
                font-size: 12px;
                font-weight: 600;
                background: var(--button-bg);
                color: var(--button-text);
                opacity: 0.6;
                cursor: not-allowed;
            }

            @media (max-width: 560px) {
                body {
                    padding: 12px;
                }

                .detail-grid {
                    grid-template-columns: 1fr;
                }

                .summary-row {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .cta-row {
                    flex-direction: column;
                    align-items: flex-start;
                }
            }
        </style>
    </head>
    <body>
        <section class="vuln-stack">
            <details open>
                <summary>
                    <div class="summary-row">
                        <div class="summary-left">
                            <svg class="warning-icon critical" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.72L8 2.28zM7.5 5.5h1v4h-1v-4zm.5 6a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
                            </svg>
                            <div class="summary-content">
                                <div class="summary-header">
                                    <span class="badge critical">Critical</span>
                                    <span class="issue-meta">CWE-89 · OWASP A03</span>
                                </div>
                                <div class="issue-title">SQL Injection — unsanitized input in query string</div>
                                <div class="summary-file">
                                    <svg class="file-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                        <path d="M13.71 4.29l-3-3L10 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5l-.29-.71zM10 2.41L12.59 5H10V2.41zM4 14V2h5v4h4v8H4z"/>
                                    </svg>
                                    <span>src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java : Line 3</span>
                                </div>
                            </div>
                        </div>
                        <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                </summary>
                <div class="details-panel">
                    <div class="detail-grid">
                        <div class="detail-row span-2">
                            <div class="detail-label">Description</div>
                            <div class="detail-value">
                                Unsanitized user input is concatenated directly into a SQL query string. An attacker can manipulate the
                                query to bypass authentication or exfiltrate the database.
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">File Location</div>
                            <div class="detail-value">src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java : Line 3</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">CWE · OWASP Reference</div>
                            <div class="detail-value">CWE-89 · OWASP A03</div>
                        </div>
                    </div>
                    <div class="cta-row">
                        <button class="action-button" type="button" disabled>View Details</button>
                    </div>
                </div>
            </details>

            <details>
                <summary>
                    <div class="summary-row">
                        <div class="summary-left">
                            <svg class="warning-icon high" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.72L8 2.28zM7.5 5.5h1v4h-1v-4zm.5 6a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
                            </svg>
                            <div class="summary-content">
                                <div class="summary-header">
                                    <span class="badge high">High</span>
                                    <span class="issue-meta">CWE-798</span>
                                </div>
                                <div class="issue-title">Hardcoded Secret — API key in variable assignment</div>
                                <div class="summary-file">
                                    <svg class="file-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                        <path d="M13.71 4.29l-3-3L10 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5l-.29-.71zM10 2.41L12.59 5H10V2.41zM4 14V2h5v4h4v8H4z"/>
                                    </svg>
                                    <span>src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java : Line 7</span>
                                </div>
                            </div>
                        </div>
                        <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                </summary>
                <div class="details-panel">
                    <div class="detail-grid">
                        <div class="detail-row span-2">
                            <div class="detail-label">Description</div>
                            <div class="detail-value">An API key is hardcoded in a variable assignment, which exposes a secret in source control.</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">File Location</div>
                            <div class="detail-value">src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java : Line 7</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">CWE · OWASP Reference</div>
                            <div class="detail-value">CWE-798</div>
                        </div>
                    </div>
                    <div class="cta-row">
                        <button class="action-button" type="button" disabled>View Details</button>
                    </div>
                </div>
            </details>

            <details>
                <summary>
                    <div class="summary-row">
                        <div class="summary-left">
                            <svg class="warning-icon medium" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.72L8 2.28zM7.5 5.5h1v4h-1v-4zm.5 6a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
                            </svg>
                            <div class="summary-content">
                                <div class="summary-header">
                                    <span class="badge medium">Medium</span>
                                    <span class="issue-meta">CWE-789</span>
                                </div>
                                <div class="issue-title">Sensitive Data in Log — user value exposed in log statement</div>
                                <div class="summary-file">
                                    <svg class="file-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                        <path d="M13.71 4.29l-3-3L10 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5l-.29-.71zM10 2.41L12.59 5H10V2.41zM4 14V2h5v4h4v8H4z"/>
                                    </svg>
                                    <span>src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java : Line 8</span>
                                </div>
                            </div>
                        </div>
                        <svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                </summary>
                <div class="details-panel">
                    <div class="detail-grid">
                        <div class="detail-row span-2">
                            <div class="detail-label">Description</div>
                            <div class="detail-value">User-supplied values are logged verbatim, which may leak sensitive data to logs.</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">File Location</div>
                            <div class="detail-value">src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java : Line 8</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">CWE · OWASP Reference</div>
                            <div class="detail-value">CWE-789</div>
                        </div>
                    </div>
                    <div class="cta-row">
                        <button class="action-button" type="button" disabled>View Details</button>
                    </div>
                </div>
            </details>
        </section>
    </body>
</html>`;
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
	const activeVulnsProvider = new AriadneViewProvider(activeVulnsHtml);
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
