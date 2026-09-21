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
		findingsBySeverity,
		vulnerabilityTypes,
		reason: 'Process terminated or closed before clean deactivation could execute',
		trendsImpact:
			'This session is classified as "incomplete" and withheld from your trend baseline to protect your progress scores.',
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
		--critical: #f85149;
		--high: #e06c75;
		--medium: #d19a66;
		--low: #61afef;
	}

	* { box-sizing: border-box; }

	body {
		margin: 0;
		padding: 24px 32px 48px;
		background: var(--bg);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		font-size: 13px;
		line-height: 1.5;
		max-width: 800px;
	}

	.header-banner {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 16px 20px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--warning) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
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
		font-weight: 600;
		color: var(--text);
	}

	.header-banner p {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
	}

	.section-title {
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--muted);
		margin: 24px 0 12px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}

	.grid-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.meta-box {
		padding: 12px 14px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.meta-label {
		font-size: 11px;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: 4px;
	}

	.meta-value {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.meta-badge-incomplete {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 600;
		border-radius: 12px;
		background: color-mix(in srgb, var(--warning) 20%, transparent);
		color: var(--warning);
	}

	.notice-card {
		padding: 12px 16px;
		background: var(--card);
		border-left: 3px solid var(--accent);
		border-radius: 4px;
		margin-bottom: 20px;
		color: var(--text);
		font-size: 12px;
	}

	.severity-row {
		display: flex;
		gap: 12px;
		margin-bottom: 16px;
	}

	.severity-pill {
		flex: 1;
		padding: 10px 14px;
		border-radius: 6px;
		background: var(--card);
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.severity-pill .count {
		font-size: 18px;
		font-weight: 700;
	}

	.severity-pill .label {
		font-size: 11px;
		text-transform: uppercase;
		color: var(--muted);
		margin-top: 2px;
	}

	.c-critical { color: var(--critical); }
	.c-high { color: var(--high); }
	.c-medium { color: var(--medium); }
	.c-low { color: var(--low); }

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
		margin-bottom: 24px;
	}

	th, td {
		padding: 8px 12px;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	th {
		color: var(--muted);
		font-weight: 600;
		background: color-mix(in srgb, var(--card) 40%, transparent);
	}

	.actions {
		display: flex;
		gap: 10px;
		margin-top: 28px;
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
`;

export function buildAbruptSessionHtml(d: AbruptSessionDiagnostics): string {
	const startedDate = new Date(d.startedAt).toLocaleString();
	const recoveredDate = new Date(d.recoveredAt).toLocaleString();
	const duration = formatDuration(d.estimatedDurationMs);

	const vulnRows = d.vulnerabilityTypes.length > 0
		? d.vulnerabilityTypes.map((v) => `
			<tr>
				<td><strong>${v.type}</strong></td>
				<td style="color: var(--muted);">${v.cweId}</td>
				<td style="text-align: right; font-weight: 600;">${v.count}</td>
			</tr>
		`).join('')
		: '<tr><td colspan="3" style="text-align: center; color: var(--muted);">No active vulnerabilities at termination</td></tr>';

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
			<div class="meta-label">Session ID</div>
			<div class="meta-value" style="font-family: monospace; font-size: 12px;">${d.sessionId}</div>
		</div>
		<div class="meta-box">
			<div class="meta-label">Status</div>
			<div class="meta-value"><span class="meta-badge-incomplete">Incomplete</span></div>
		</div>
		<div class="meta-box">
			<div class="meta-label">Session Duration</div>
			<div class="meta-value">${duration}</div>
		</div>
		<div class="meta-box">
			<div class="meta-label">Checkpoints</div>
			<div class="meta-value">${d.hourlyCheckpointsCount} completed</div>
		</div>
	</div>

	<div class="notice-card">
		This session is classified as <strong>incomplete</strong> and withheld from your trend baseline to protect your progress scores.
	</div>

	<div class="section-title">Findings Active at Termination</div>
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
