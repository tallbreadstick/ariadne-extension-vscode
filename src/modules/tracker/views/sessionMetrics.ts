/**
 * View builder for the Session Metrics panel.
 *
 * This is a pure function: given a SessionMetrics object it returns a
 * complete HTML string ready to be stamped into a webview.
 * It contains zero data — all data flows in from the caller.
 */

import { SessionMetrics, SessionNotification } from '../../presentation/panelTypes.js';
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

const RESOLVED_SVG =
	`<svg class="trend-icon trend-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
		<path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
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

function buildNotificationFeed(metrics: SessionMetrics): string {
	if (!metrics.notifications || metrics.notifications.length === 0) {
		return '';
	}
	const items = metrics.notifications.map(buildNotificationItem).join('\n');
	return /* html */ `
		<div class="divider"></div>
		<div class="notif-feed">
			${items}
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

	.trend-icon { width: 16px; height: 16px; display: inline-block; }

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

	.trend-row:first-of-type { border-top: none; }

	.trend-label { font-size: 13px; color: var(--text); }
	.trend-value { font-size: 14px; font-weight: 600; }
	.trend-red   { color: var(--red); }
	.trend-teal  { color: var(--accent-strong); }
	.trend-blue  { color: var(--blue); }

	.divider { height: 1px; background: rgba(58, 58, 58, 0.7); }

	/* ── Notification feed (scrollable) ── */
	.notif-feed {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 260px;
		overflow-y: auto;
		padding-right: 2px;

		/* Custom scrollbar */
		scrollbar-width: thin;
		scrollbar-color: rgba(70, 213, 196, 0.3) transparent;
	}

	.notif-feed::-webkit-scrollbar {
		width: 4px;
	}

	.notif-feed::-webkit-scrollbar-track {
		background: transparent;
	}

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
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 12px 14px;
		flex-shrink: 0;
	}

	.notif-body {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-width: 0;
	}

	.notif-icon {
		width: 18px;
		height: 18px;
		flex: 0 0 auto;
		color: var(--accent);
		margin-top: 1px;
	}

	.notif-text { display: grid; gap: 4px; min-width: 0; }

	.notif-message { font-size: 13px; font-weight: 600; color: var(--text); }
	.notif-detail  { font-size: 12px; color: var(--text); line-height: 1.4; }
	.notif-timestamp { font-size: 11px; color: var(--muted); }

	.notif-dismiss {
		background: transparent;
		border: none;
		color: var(--muted);
		cursor: pointer;
		font-size: 14px;
		padding: 0;
		line-height: 1;
		flex: 0 0 auto;
	}

	.notif-dismiss:hover { color: var(--text); }

	/* Slide-out animation for dismissed notifications */
	@keyframes notif-slide-out {
		0%   { opacity: 1; transform: translateX(0); max-height: 200px; margin-bottom: 0; }
		60%  { opacity: 0; transform: translateX(40px); max-height: 200px; margin-bottom: 0; }
		100% { opacity: 0; transform: translateX(40px); max-height: 0; margin-bottom: -8px; padding: 0 14px; border-width: 0; }
	}

	.notif-card.dismissing {
		animation: notif-slide-out 0.35s ease forwards;
		pointer-events: none;
		overflow: hidden;
	}

	@media (max-width: 520px) {
		body { padding: 12px; }
		.metrics-grid { grid-template-columns: 1fr; }
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
				<div class="trend-row">
					${PERSISTING_SVG}
					<div class="trend-label">Persisting Patterns</div>
					<div class="trend-value trend-red">${trends.persistingPatterns}</div>
				</div>
				<div class="trend-row">
					${IMPROVING_SVG}
					<div class="trend-label">Improving Trends</div>
					<div class="trend-value trend-teal">${trends.improvingTrends}</div>
				</div>
				<div class="trend-row">
					${RESOLVED_SVG}
					<div class="trend-label">Resolved This Session</div>
					<div class="trend-value trend-blue">${trends.resolvedThisSession}</div>
				</div>
			</div>

			${buildNotificationFeed(metrics)}
		</section>
		<script>
			(function () {
				const vscode = acquireVsCodeApi();
				document.addEventListener('click', (e) => {
					const btn = e.target.closest('.notif-dismiss');
					if (!btn) return;
					const id = btn.dataset.notifId;
					if (!id) return;

					// Animate the card out, then remove from DOM
					const card = btn.closest('.notif-card');
					if (card) {
						card.classList.add('dismissing');
						card.addEventListener('animationend', () => {
							card.remove();
							// If no notifications remain, remove the divider + feed wrapper
							const feed = document.querySelector('.notif-feed');
							if (feed && feed.children.length === 0) {
								const divider = feed.previousElementSibling;
								if (divider && divider.classList.contains('divider')) {
									divider.remove();
								}
								feed.remove();
							}
						});
					}

					// Persist the dismissal in the extension host
					vscode.postMessage({ type: 'dismiss-notification', notifId: id });
				});
			})();
		</script>
	</body>
</html>`;
}
