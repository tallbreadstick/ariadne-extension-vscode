/**
 * View builder for the Session Metrics panel.
 *
 * This is a pure function: given a SessionMetrics object it returns a
 * complete HTML string ready to be stamped into a webview.
 * It contains zero data — all data flows in from the caller.
 */

import { SessionMetrics, SessionNotification, TrendSubItem, ImprovingSubItem } from '../../presentation/panelTypes.js';
import { SEVERITY_COLORS } from '../../presentation/severityColors.js';
import type { Severity } from '../../presentation/panelTypes.js';

// ── SVGs ─────────────────────────────────────────────────────────────

const TREND_CHART_SVG =
	`<svg class="trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M4 16l5-5 4 3 6-7" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
		<path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
	</svg>`;

const TRENDS_HEADER_SVG =
	`<svg class="trend-icon trend-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M4 18V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		<path d="M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		<path d="M8 14l4-4 3 2 5-6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const PERSISTING_SVG =
	`<svg class="trend-icon trend-red" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M4 8l6 6 4-4 6 6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const IMPROVING_SVG =
	`<svg class="trend-icon trend-teal" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M4 16l6-6 4 4 6-6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const RECURRING_SVG =
	`<svg class="trend-icon trend-red" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M4 8l6 6 4-4 6 6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const RESOLVED_SVG =
	`<svg class="trend-icon trend-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
		<path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const NOTIFICATION_BELL_SVG =
	`<svg class="section-icon notif-bell" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const COMMON_VULN_SVG =
	`<svg class="section-icon" style="color: #E24B4A;" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
		<path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		<circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="1.5" />
	</svg>`;

const NOTIFICATION_ICON_SVG =
	`<svg class="notif-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
		<path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" />
	</svg>`;

// ── Partial builders ──────────────────────────────────────────────────

function buildMetricCard(title: string, value: number, severity: Severity): string {
	const accent = SEVERITY_COLORS[severity];
	return /* html */ `
		<div class="metric-card" style="border-left: 3px solid ${accent};">
			<div class="metric-title">${title}</div>
			<div class="metric-row">
				<div class="metric-value" style="color: ${accent};">${value}</div>
				<div class="metric-trend">
					${TREND_CHART_SVG}
					<span>${value}</span>
				</div>
			</div>
		</div>`;
}

function buildBasicSubItems(items: TrendSubItem[] | undefined, count: number): string {
	if (!items || items.length === 0) {
		if (count === 0) { return ''; }
		return /* html */ `
			<div class="trend-sub-item trend-sub-placeholder">
				<span class="sub-label">—</span>
				<span class="sub-count">${count}</span>
			</div>`;
	}
	return items.map((item) => /* html */ `
		<div class="trend-sub-item">
			<span class="sub-label">${item.type}</span>
			<span class="sub-count">${item.instances}</span>
		</div>`).join('');
}

function buildImprovingSubItems(items: ImprovingSubItem[] | undefined, count: number): string {
	if (!items || items.length === 0) {
		if (count === 0) { return ''; }
		return /* html */ `
			<div class="trend-sub-item trend-sub-placeholder">
				<span class="sub-label">—</span>
				<span class="sub-count">${count}</span>
			</div>`;
	}
	return items.map((item) => {
		const progressClass = item.progressLabel === 'Some progress'
			? 'progress-some'
			: item.progressLabel === 'Clear progress'
				? 'progress-clear'
				: 'progress-major';
		return /* html */ `
			<div class="trend-sub-item">
				<span class="sub-label">${item.type}</span>
				<span class="sub-progress ${progressClass}">${item.progressLabel} (+${item.progressDelta})</span>
				<span class="sub-count">${item.instances}</span>
			</div>`;
	}).join('');
}

/**
 * Builds a single collapsible trend row.
 *
 * @param id       - Unique ID prefix for toggling (e.g. "persisting")
 * @param icon     - SVG icon string for the row header
 * @param label    - Row label text
 * @param count    - Instance count shown in the header
 * @param subItems - Rendered HTML string of sub-item rows
 */
function buildCollapsibleTrendRow(
	id: string,
	icon: string,
	label: string,
	count: number,
	subItems: string,
): string {
	return /* html */ `
		<div class="trend-group" data-trend-id="${id}">
			<button class="trend-header" type="button" aria-expanded="false"
			        aria-controls="trend-body-${id}" data-trend-toggle="${id}">
				<span class="trend-header-left">
					${icon}
					<span class="trend-header-label">${label}</span>
				</span>
				<span class="trend-header-right">
					<span class="trend-instance-count">Instances :  <span style="color: var(--text); font-weight: 700;">${count}</span></span>
					<svg class="chevron-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2"
							stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</span>
			</button>
			<div class="trend-body" id="trend-body-${id}" aria-hidden="true">
				<div class="trend-body-inner">
					${subItems}
				</div>
			</div>
		</div>`;
}

function buildNotificationItem(notif: SessionNotification): string {
	const { id, message, detail, timestamp } = notif;
	return /* html */ `
		<div class="notif-card" data-notif-id="${id}">
			<div class="notif-body">
				${NOTIFICATION_ICON_SVG}
				<div class="notif-text">
					<div class="notif-message">${message}</div>
					<div class="notif-detail">${detail}</div>
					<div class="notif-timestamp">${timestamp} · Ariadne</div>
				</div>
			</div>
			<button class="notif-dismiss" type="button" aria-label="Dismiss"
			        data-notif-id="${id}">&#x2715;</button>
		</div>`;
}

function buildNotificationsPanel(metrics: SessionMetrics): string {
	const items = metrics.notifications && metrics.notifications.length > 0
		? metrics.notifications.map(buildNotificationItem).join('\n')
		: /* html */ `<div class="panel-empty">No notifications</div>`;

	return /* html */ `
		<div class="split-panel notif-panel">
			<div class="split-panel-header">
				${NOTIFICATION_BELL_SVG}
				<span class="split-panel-title">NOTIFICATIONS</span>
			</div>
			<div class="notif-feed" id="notif-feed">
				${items}
			</div>
		</div>`;
}

function buildCommonVulnerabilitiesPanel(): string {
	return /* html */ `
		<div class="split-panel common-vuln-panel">
			<div class="split-panel-header">
				${COMMON_VULN_SVG}
				<span class="split-panel-title">COMMON VULNERABILITIES</span>
			</div>
			<div class="common-vuln-feed">
				<div class="panel-empty">No data yet</div>
			</div>
		</div>`;
}

// ── CSS ───────────────────────────────────────────────────────────────

const CSS = /* css */ `
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
		--orange: #e09850;
		--radius: 8px;
		--shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent),
		          0 0 16px color-mix(in srgb, var(--accent) 10%, transparent);
	}

	* { box-sizing: border-box; }

	body {
		margin: 0;
		padding: 16px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		background: var(--bg);
		color: var(--text);
	}

	.dashboard { display: grid; gap: 16px; }

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

	.metric-value { font-size: 28px; font-weight: 600; color: #f1f1f1; }

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

	.trend-icon { width: 18px; height: 18px; display: inline-block; }

	/* ── Trends card ── */
	.trends-card {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.trends-title {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--muted);
		padding: 12px 14px 8px;
	}

	/* ── Collapsible trend row ── */
	.trend-group {
		border-top: 1px solid var(--vscode-panel-border);
	}

	.trend-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px 8px;
		background: transparent;
		border: none;
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}

	.trend-header:hover { background: rgba(255, 255, 255, 0.04); }

	.trend-header-left {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		font-weight: 600;
	}

	.trend-header-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.trend-instance-count {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
		white-space: nowrap;
	}

	.chevron-icon {
		margin-left: 2px;
		width: 16px;
		height: 16px;
		color: var(--text);
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.trend-header[aria-expanded="true"] .chevron-icon {
		transform: rotate(90deg);
	}

	/* ── Collapsible body — grid-row trick for smooth animation ── */
	.trend-body {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.25s ease;
	}

	.trend-body.open {
		grid-template-rows: 1fr;
	}

	.trend-body-inner {
		overflow: hidden;
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--vscode-editor-background) 70%, black);
	}

	/* ── Sub-item rows ── */
	.trend-sub-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px 8px 38px;
		font-size: 12px;
		color: var(--text);
	}

	.trend-sub-item:last-child { padding-bottom: 10px; }

	.sub-label { flex: 1; color: var(--text); }

	.sub-progress {
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}

	.progress-some  { color: var(--orange); }
	.progress-clear { color: var(--accent-strong); }
	.progress-major { color: var(--blue); }

	.sub-count {
		font-size: 12px;
		font-weight: 700;
		color: var(--text);
		min-width: 20px;
		margin-right: 12px;
		
	}

	.trend-sub-placeholder { color: var(--muted); }

	.trend-red   { color: #E24B4A; }
	.trend-teal  { color: var(--accent-strong); }
	.trend-blue  { color: var(--blue); }

	.divider { height: 1px; background: rgba(58, 58, 58, 0.7); }

	/* ── Split panel section ── */
	.split-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		min-height: 180px;
	}

	.split-panel {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		max-height: 260px;
		overflow: hidden;
	}

	.split-panel-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 8px;
		border-bottom: 1px solid rgba(58, 58, 58, 0.6);
		flex-shrink: 0;
	}

	.split-panel-title {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--muted);
		letter-spacing: 0.04em;
	}

	.section-icon {
		width: 16px;
		height: 16px;
		color: var(--muted);
		flex-shrink: 0;
	}

	.section-icon.notif-bell { color: var(--accent); }

	/* ── Common vulnerabilities panel ── */
	.common-vuln-feed {
	
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 8px;
		scrollbar-width: thin;
		scrollbar-color: rgba(70, 213, 196, 0.3) transparent;
	}

	.common-vuln-feed:has(.panel-empty),
	.notif-feed:has(.panel-empty) {
		background: color-mix(in srgb, var(--vscode-editor-background) 70%, black);
	}

	.common-vuln-feed::-webkit-scrollbar { width: 4px; }
	.common-vuln-feed::-webkit-scrollbar-track { background: transparent; }
	.common-vuln-feed::-webkit-scrollbar-thumb {
		background-color: rgba(70, 213, 196, 0.3);
		border-radius: 4px;
	}

	.panel-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		color: var(--muted);
		text-align: center;
		padding: 20px 8px;
	}

	/* ── Notification feed (scrollable) ── */
	.notif-feed {
		flex: 1;
		display: flex;
		flex-direction: column;
		
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(70, 213, 196, 0.3) transparent;
	}

	.notif-feed::-webkit-scrollbar { width: 4px; }
	.notif-feed::-webkit-scrollbar-track { background: transparent; }
	.notif-feed::-webkit-scrollbar-thumb {
		background-color: rgba(70, 213, 196, 0.3);
		border-radius: 4px;
	}
	.notif-feed::-webkit-scrollbar-thumb:hover {
		background-color: rgba(70, 213, 196, 0.6);
	}

	.notif-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		background: var(--card);
		border-bottom: 1px solid var(--border);
		
		padding: 10px 12px;
		flex-shrink: 0;
	}

	.notif-body {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		min-width: 0;
	}

	.notif-icon {
		width: 16px;
		height: 16px;
		flex: 0 0 auto;
		color: var(--accent);
		margin-top: 1px;
	}

	.notif-text { display: grid; gap: 3px; min-width: 0; }

	.notif-message { font-size: 12px; font-weight: 600; color: var(--text); }
	.notif-detail  { font-size: 11px; color: var(--text); line-height: 1.4; }
	.notif-timestamp { font-size: 10px; color: var(--muted); }

	.notif-dismiss {
		background: transparent;
		border: none;
		color: var(--muted);
		cursor: pointer;
		font-size: 13px;
		padding: 0;
		line-height: 1;
		flex: 0 0 auto;
	}

	.notif-dismiss:hover { color: var(--text); }

	/* Slide-out animation for dismissed notifications */
	@keyframes notif-slide-out {
		0%   { opacity: 1; transform: translateX(0); max-height: 200px; margin-bottom: 0; }
		60%  { opacity: 0; transform: translateX(40px); max-height: 200px; margin-bottom: 0; }
		100% { opacity: 0; transform: translateX(40px); max-height: 0; margin-bottom: -6px; padding: 0 12px; border-width: 0; }
	}

	.notif-card.dismissing {
		animation: notif-slide-out 0.35s ease forwards;
		pointer-events: none;
		overflow: hidden;
	}

	@media (max-width: 520px) {
		body { padding: 12px; }
		.metrics-grid { grid-template-columns: 1fr; }
		.split-section { grid-template-columns: 1fr; }
	}
`;

// ── Public API ────────────────────────────────────────────────────────

/**
 * Builds the complete HTML document for the Session Metrics panel.
 *
 * @param metrics - Aggregated session metrics from the current scan session.
 * @returns A complete HTML string ready to be set on a VS Code webview.
 */
export function buildSessionMetricsHtml(metrics: SessionMetrics): string {
	const { critical, high, medium, low, trends } = metrics;

	const persistingSubItems = buildBasicSubItems(trends.persistingItems, trends.persistingPatterns);
	const improvingSubItems = buildImprovingSubItems(trends.improvingItems, trends.improvingTrends);
	// recurringPatterns is not yet in TrendData — placeholder count until the overhaul task is implemented
	const recurringCount = 0;
	const recurringSubItems = buildBasicSubItems(trends.recurringItems, recurringCount);
	const resolvedSubItems = buildBasicSubItems(trends.resolvedItems, trends.resolvedThisSession);

	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Session Metrics</title>
		<style>${CSS}</style>
	</head>
	<body>
		<section class="dashboard">
			<div class="metrics-grid">
				${buildMetricCard('Critical Issues', critical, 'critical')}
				${buildMetricCard('High Issues', high, 'high')}
				${buildMetricCard('Medium Issues', medium, 'medium')}
				${buildMetricCard('Low Issues', low, 'low')}
			</div>

			<div class="divider"></div>

			<div class="trends-card">
				<div class="trends-title">
					${TRENDS_HEADER_SVG}
					Trends
				</div>

				${buildCollapsibleTrendRow(
					'persisting',
					PERSISTING_SVG,
					'Persisting Patterns',
					trends.persistingPatterns,
					persistingSubItems,
				)}

				${buildCollapsibleTrendRow(
					'improving',
					IMPROVING_SVG,
					'Improving Trends',
					trends.improvingTrends,
					improvingSubItems,
				)}

				${buildCollapsibleTrendRow(
					'recurring',
					RECURRING_SVG,
					'Recurring Patterns',
					recurringCount,
					recurringSubItems,
				)}

				${buildCollapsibleTrendRow(
					'resolved',
					RESOLVED_SVG,
					'Resolved This Session',
					trends.resolvedThisSession,
					resolvedSubItems,
				)}
			</div>
			
			<div class="divider"></div>
			
			<div class="split-section">
				${buildCommonVulnerabilitiesPanel()}
				${buildNotificationsPanel(metrics)}
			</div>
		</section>
		<script>
			(function () {
				const vscode = acquireVsCodeApi();

				// ── Collapsible trend rows ──────────────────────────────
				document.querySelectorAll('[data-trend-toggle]').forEach(function (btn) {
					btn.addEventListener('click', function () {
						const id = btn.getAttribute('data-trend-toggle');
						const body = document.getElementById('trend-body-' + id);
						if (!body) { return; }

						const isOpen = btn.getAttribute('aria-expanded') === 'true';
						btn.setAttribute('aria-expanded', String(!isOpen));
						body.setAttribute('aria-hidden', String(isOpen));
						body.classList.toggle('open', !isOpen);
					});
				});

				// ── Notification dismiss ────────────────────────────────
				document.addEventListener('click', function (e) {
					const btn = e.target.closest('.notif-dismiss');
					if (!btn) { return; }
					const id = btn.dataset.notifId;
					if (!id) { return; }

					const card = btn.closest('.notif-card');
					if (card) {
						card.classList.add('dismissing');
						card.addEventListener('animationend', function () {
							card.remove();
							const feed = document.getElementById('notif-feed');
							if (feed && feed.querySelectorAll('.notif-card').length === 0) {
								feed.innerHTML = '<div class="panel-empty">No notifications</div>';
							}
						});
					}

					vscode.postMessage({ type: 'dismiss-notification', notifId: id });
				});
			})();
		</script>
	</body>
</html>`;
}
