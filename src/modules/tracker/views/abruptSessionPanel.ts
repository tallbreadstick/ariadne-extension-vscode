/**
 * Diagnostic Webview Panel for Abruptly Terminated Sessions.
 *
 * Rendered when Ariadne detects an unfinalized session upon startup
 * (e.g. VS Code crashed or closed abruptly before clean deactivation).
 */

import * as vscode from 'vscode';
import type { FindingLifecycleRecord, SessionRecord } from '../analysis/lifecycleTypes.js';

export interface AbruptSessionDiagnostics {
	sessionId: string;
	startedAt: number;
	recoveredAt: number;
	estimatedDurationMs: number;
	status: 'incomplete';
	hourlyCheckpointsCount: number;
	activeFindingCount: number;
	persistingFindingCount: number;
	resolvedFindingCount: number;
	recurredFindingCount: number;
	findingsBySeverity: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	vulnerabilityTypes: Array<{
		type: string;
		cweId: string;
		count: number;
	}>;
	reason: string;
	trendsImpact: string;
}

/**
 * Formats internal session IDs (e.g. "session-005") into friendly display labels ("Session 5").
 */
export function formatSessionDisplayId(sessionId: string): string {
	const match = /^session-0*(\d+)$/i.exec(sessionId.trim());
	if (match) {
		return `Session ${match[1]}`;
	}
	if (sessionId.startsWith('session-simulated-')) {
		return 'Session 4 (Simulated)';
	}
	return sessionId;
}

/**
 * Builds diagnostic details from an unfinalized session record and lifecycle data.
 */
export function buildAbruptSessionDiagnostics(
	staleSession: SessionRecord,
	lifecycles: FindingLifecycleRecord[],
	recoveredAt: number = Date.now(),
): AbruptSessionDiagnostics {
	const startedAt = staleSession.startedAt;
	const estimatedDurationMs = Math.max(0, recoveredAt - startedAt);

	const activeLifecycles = lifecycles.filter(
		(flc) => flc.missingSince === null && flc.durableResolutionAt === null,
	);

	const persistingLifecycles = activeLifecycles.filter(
		(flc) => flc.confirmationCount >= 2,
	);

	const resolvedLifecycles = lifecycles.filter(
		(flc) => flc.durableResolutionAt !== null && flc.durableResolutionAt >= startedAt,
	);

	const recurredLifecycles = lifecycles.filter(
		(flc) =>
			(flc.lastRecurredAt !== null && flc.lastRecurredAt >= startedAt) ||
			(flc.recurrenceCount > 0 && flc.lastConfirmedAt >= startedAt),
	);

	const findingsBySeverity = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0,
	};

	const typeMap = new Map<string, { type: string; cweId: string; count: number }>();

	for (const flc of activeLifecycles) {
		const sev = flc.severity;
		if (sev in findingsBySeverity) {
			findingsBySeverity[sev as keyof typeof findingsBySeverity]++;
		}

		const key = `${flc.cweId}::${flc.type}`;
		const existing = typeMap.get(key);
		if (existing) {
			existing.count++;
		} else {
			typeMap.set(key, {
				type: flc.type,
				cweId: flc.cweId,
				count: 1,
			});
		}
	}

	const vulnerabilityTypes = Array.from(typeMap.values()).sort(
		(a, b) => b.count - a.count,
	);

	return {
		sessionId: staleSession.sessionId,
		startedAt,
		recoveredAt,
		estimatedDurationMs,
		status: 'incomplete',
		hourlyCheckpointsCount: staleSession.hourlyCheckpoints?.length ?? 0,
		activeFindingCount: activeLifecycles.length,
		persistingFindingCount: persistingLifecycles.length,
		resolvedFindingCount: resolvedLifecycles.length,
		recurredFindingCount: recurredLifecycles.length,
		findingsBySeverity,
		vulnerabilityTypes,
		reason: 'Process terminated or closed before clean deactivation could execute',
		trendsImpact:
			'All modifications and resolved vulnerabilities from this session will be recognized when your next session begins. To protect your progress metrics from skewed data, your Trend score will be measured against your last completed session rather than this interrupted one.',
	};
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	return `${seconds}s`;
}

const CSS = /* css */ `
	:root {
		color-scheme: dark;
		--bg: var(--vscode-editor-background);
		--card: var(--vscode-editorWidget-background);
		--text: var(--vscode-foreground);
		--muted: var(--vscode-descriptionForeground);
		--border: var(--vscode-panel-border);
		--accent: var(--vscode-textLink-foreground);
		--warning: var(--vscode-editorWarning-foreground, #cca700);
		--error: var(--vscode-errorForeground, #f14c4c);
		--critical: #E24B4A; /* Red */
		--high: #F0883E;     /* Orange */
		--medium: #E3B341;   /* Yellow */
		--low: #3FB950;      /* Green */
	}

	* { box-sizing: border-box; }

	html {
		background: var(--bg);
	}

	body {
		margin: 0 auto;
		padding: 24px 32px 48px;
		background: var(--bg);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: 13px;
		line-height: 1.5;
		max-width: 860px;
		width: 100%;
	}

	.header-banner {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 18px 20px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--warning) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
		margin-bottom: 24px;
	}

	.header-banner svg {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		stroke: var(--warning);
	}

	.header-banner h1 {
		margin: 0 0 4px;
		font-size: 16px;
		font-weight: 700;
		color: var(--text);
	}

	.header-banner p {
		margin: 0;
		color: var(--text);
		opacity: 0.85;
		font-size: 13px;
	}

	.section-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--text);
		margin: 28px 0 14px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--border);
	}

	.grid-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.meta-box {
		padding: 14px 16px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.meta-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text);
		opacity: 0.75;
		margin-bottom: 6px;
	}

	.meta-value {
		font-size: 16px;
		font-weight: 700;
		color: var(--text);
	}

	.meta-sub {
		font-size: 11px;
		font-weight: 500;
		color: var(--muted);
		margin-top: 3px;
	}

	.notice-card {
		padding: 16px 18px;
		background: color-mix(in srgb, var(--accent) 10%, var(--card));
		border-left: 4px solid var(--accent);
		border-radius: 6px;
		border-top: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
		border-right: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
		margin-bottom: 24px;
	}

	.notice-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 14px;
		color: var(--text);
		margin-bottom: 8px;
	}

	.notice-title svg {
		width: 18px;
		height: 18px;
		color: var(--accent);
		flex-shrink: 0;
	}

	.notice-card p {
		margin: 0;
		color: var(--text);
		opacity: 0.9;
		font-size: 12.5px;
		font-weight: 500;
		line-height: 1.6;
	}

	.grid-activity {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.activity-box {
		padding: 14px 16px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 6px;
		text-align: center;
	}

	.activity-count {
		font-size: 24px;
		font-weight: 800;
		line-height: 1.2;
		margin-bottom: 4px;
	}

	.activity-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text);
	}

	.activity-sub {
		font-size: 11px;
		font-weight: 500;
		color: var(--muted);
		margin-top: 3px;
	}

	.severity-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
		margin-bottom: 16px;
	}

	.severity-pill {
		padding: 12px 14px;
		border-radius: 6px;
		background: var(--card);
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.severity-pill .count {
		font-size: 22px;
		font-weight: 800;
	}

	.severity-pill .label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text);
		margin-top: 4px;
	}

	.c-active { color: var(--text); }
	.c-resolved { color: var(--low); }
	.c-recurred { color: var(--high); }
	.c-persisting { color: var(--medium); }
	.c-critical { color: var(--critical); }
	.c-high { color: var(--high); }
	.c-medium { color: var(--medium); }
	.c-low { color: var(--low); }

	.table-container {
		width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--card);
		margin-bottom: 24px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		min-width: 340px;
		margin: 0;
	}

	th {
		padding: 12px 16px;
		text-align: left;
		color: var(--muted);
		font-weight: 700;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		background: color-mix(in srgb, var(--border) 35%, var(--card));
		border-bottom: 2px solid var(--border);
	}

	td {
		padding: 12px 16px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		word-break: break-word;
	}

	tbody tr:nth-child(even) td {
		background: color-mix(in srgb, var(--bg) 35%, transparent);
	}

	tbody tr:hover td {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	.vuln-name {
		font-weight: 600;
		font-size: 13px;
		color: var(--text);
	}

	.cwe-pill {
		display: inline-block;
		font-family: var(--vscode-editor-font-family, monospace);
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--text) 8%, var(--card));
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		color: var(--text);
	}

	.count-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		padding: 2px 8px;
		font-size: 12px;
		font-weight: 700;
		border-radius: 12px;
		background: color-mix(in srgb, var(--accent) 15%, var(--card));
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
	}

	.actions {
		display: flex;
		gap: 10px;
		margin-top: 24px;
	}

	button {
		padding: 8px 16px;
		font-size: 12px;
		font-weight: 600;
		border-radius: 4px;
		cursor: pointer;
		border: 1px solid var(--border);
		background: var(--card);
		color: var(--text);
	}

	button.primary {
		background: var(--vscode-button-background);
		color: var(--vscode-button-foreground);
		border: none;
	}

	button:hover {
		opacity: 0.9;
	}

	@media (max-width: 600px) {
		body {
			padding: 16px 16px 36px;
		}
		.header-banner {
			padding: 14px 16px;
			gap: 12px;
		}
	}

	@media (max-width: 480px) {
		.grid-meta {
			grid-template-columns: 1fr;
			gap: 8px;
		}
		.grid-activity {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}
		.severity-row {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}
	}
`;

export function buildAbruptSessionHtml(d: AbruptSessionDiagnostics): string {
	const startedDate = new Date(d.startedAt).toLocaleString();
	const recoveredDate = new Date(d.recoveredAt).toLocaleString();
	const duration = formatDuration(d.estimatedDurationMs);
	const displayId = formatSessionDisplayId(d.sessionId);

	const vulnRows = d.vulnerabilityTypes.length > 0
		? d.vulnerabilityTypes.map((v) => `
			<tr>
				<td><span class="vuln-name">${v.type}</span></td>
				<td><span class="cwe-pill">${v.cweId}</span></td>
				<td style="text-align: right;"><span class="count-pill">${v.count}</span></td>
			</tr>
		`).join('')
		: '<tr><td colspan="3" style="text-align: center; color: var(--muted); padding: 20px; font-weight: 500;">No active vulnerabilities at termination</td></tr>';

	const jsonPayload = JSON.stringify(d, null, 2);

	return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
	<title>Ariadne: Session Recovery Diagnostics</title>
	<style>${CSS}</style>
</head>
<body>
	<div class="header-banner">
		<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
			<line x1="12" y1="9" x2="12" y2="13"/>
			<line x1="12" y1="17" x2="12.01" y2="17"/>
		</svg>
		<div>
			<h1>Session Ended Abruptly</h1>
			<p>An unfinalized session was detected upon startup and safely recovered as <strong>incomplete</strong>.</p>
		</div>
	</div>

	<div class="section-title">Session Metadata</div>
	<div class="grid-meta">
		<div class="meta-box">
			<div class="meta-label">Session</div>
			<div class="meta-value">${displayId}</div>
			${displayId !== d.sessionId ? `<div class="meta-sub">${d.sessionId}</div>` : ''}
		</div>
		<div class="meta-box">
			<div class="meta-label">Checkpoints</div>
			<div class="meta-value">${d.hourlyCheckpointsCount} completed</div>
			<div class="meta-sub">Hourly snapshots</div>
		</div>
		<div class="meta-box">
			<div class="meta-label">Duration</div>
			<div class="meta-value">${duration}</div>
			<div class="meta-sub">Before termination</div>
		</div>
	</div>

	<div class="notice-card">
		<div class="notice-title">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
			</svg>
			<span>Your code changes are safe</span>
		</div>
		<p>${d.trendsImpact}</p>
	</div>

	<div class="section-title">Session Activity Overview</div>
	<div class="grid-activity">
		<div class="activity-box">
			<div class="activity-count c-active">${d.activeFindingCount}</div>
			<div class="activity-label">Active at Crash</div>
			<div class="activity-sub">Unresolved findings</div>
		</div>
		<div class="activity-box">
			<div class="activity-count c-resolved">${d.resolvedFindingCount}</div>
			<div class="activity-label">Resolved</div>
			<div class="activity-sub">Fixed this session</div>
		</div>
		<div class="activity-box">
			<div class="activity-count c-recurred">${d.recurredFindingCount}</div>
			<div class="activity-label">Recurred</div>
			<div class="activity-sub">Re-introduced</div>
		</div>
		<div class="activity-box">
			<div class="activity-count c-persisting">${d.persistingFindingCount}</div>
			<div class="activity-label">Persisting</div>
			<div class="activity-sub">&ge; 2 confirmations</div>
		</div>
	</div>

	<div class="section-title">Active Findings at Termination</div>
	<div class="severity-row">
		<div class="severity-pill">
			<span class="count c-critical">${d.findingsBySeverity.critical}</span>
			<span class="label">Critical</span>
		</div>
		<div class="severity-pill">
			<span class="count c-high">${d.findingsBySeverity.high}</span>
			<span class="label">High</span>
		</div>
		<div class="severity-pill">
			<span class="count c-medium">${d.findingsBySeverity.medium}</span>
			<span class="label">Medium</span>
		</div>
		<div class="severity-pill">
			<span class="count c-low">${d.findingsBySeverity.low}</span>
			<span class="label">Low</span>
		</div>
	</div>

	<div class="table-container">
		<table>
			<thead>
				<tr>
					<th>Vulnerability Type</th>
					<th>CWE</th>
					<th style="text-align: right;">Active Instances</th>
				</tr>
			</thead>
			<tbody>
				${vulnRows}
			</tbody>
		</table>
	</div>

	<div style="font-size: 11px; color: var(--muted);">
		Started: ${startedDate} &bull; Recovered: ${recoveredDate}
	</div>

	<div class="actions">
		<button class="primary" id="copyJsonBtn">Copy Diagnostics JSON</button>
	</div>

	<textarea id="jsonPayload" style="display: none;">${jsonPayload}</textarea>

	<script>
		document.getElementById('copyJsonBtn').addEventListener('click', () => {
			const text = document.getElementById('jsonPayload').value;
			navigator.clipboard.writeText(text).then(() => {
				const btn = document.getElementById('copyJsonBtn');
				btn.textContent = 'Copied to Clipboard!';
				setTimeout(() => { btn.textContent = 'Copy Diagnostics JSON'; }, 2000);
			});
		});
	</script>
</body>
</html>`;
}

let activePanel: vscode.WebviewPanel | null = null;

/**
 * Displays the Abrupt Session Diagnostic Panel in a new webview tab.
 */
export function showAbruptSessionDiagnosticPanel(
	context: vscode.ExtensionContext,
	diagnostics: AbruptSessionDiagnostics,
): vscode.WebviewPanel {
	if (activePanel) {
		activePanel.webview.html = buildAbruptSessionHtml(diagnostics);
		activePanel.reveal(vscode.ViewColumn.Active);
		return activePanel;
	}

	const panel = vscode.window.createWebviewPanel(
		'ariadne.abruptSessionDiagnostics',
		'Ariadne: Session Recovery Diagnostics',
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
		},
	);

	panel.webview.html = buildAbruptSessionHtml(diagnostics);

	panel.onDidDispose(() => {
		if (activePanel === panel) {
			activePanel = null;
		}
	}, null, context.subscriptions);

	activePanel = panel;
	return panel;
}
