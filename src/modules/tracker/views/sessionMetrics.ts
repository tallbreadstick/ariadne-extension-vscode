/**
 * View builder for the Session Metrics panel.
 *
 * This is a pure function: given a SessionMetrics object it returns a
 * complete HTML string ready to be stamped into a webview.
 * It contains zero data — all data flows in from the caller.
 */

import { SessionMetrics, SessionNotification, TrendSubItem, ImprovingSubItem, CommonVulnerabilityItem } from '../../presentation/panelTypes.js';
import { SEVERITY_COLORS } from '../../presentation/severityColors.js';
import type { Severity } from '../../presentation/panelTypes.js';
import { COMMON_VULN_POLICY } from '../analysis/commonVulnerabilities.js';
import { buildStartupLoadingHtml } from '../../presentation/views/startupLoading.js';

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

// ── SVGs ─────────────────────────────────────────────────────────────

const TREND_CHART_SVG =
	`<svg class="trend-icon severity-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<rect x="3" y="15" width="3" height="6" rx="1" fill="currentColor" />
		<rect x="8" y="11" width="3" height="10" rx="1" fill="currentColor" />
		<rect x="18" y="7" width="3" height="14" rx="1" fill="currentColor" />
		<rect x="13" y="3" width="3" height="18" rx="1" fill="currentColor" />
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
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;





const RESOLVED_SVG =
	`<svg class="trend-icon trend-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
		<path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const COMMON_VULN_SVG =
	`<svg class="section-icon" style="color: #E24B4A;" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
		<path d="M12 8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		<circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="currentColor" stroke-width="1.5" />
	</svg>`;

const FULL_REPORT_SVG =
	`<svg class="section-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2m-10 0H5a2 2 0 01-2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		<line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
	</svg>`;

const FULL_SCAN_SVG = FULL_REPORT_SVG;

// ── Partial builders ──────────────────────────────────────────────────

function buildMetricCard(title: string, value: number, severity: Severity): string {
	const accent = SEVERITY_COLORS[severity];
	return /* html */ `
		<div class="metric-card filterable-metric-card"
		     data-severity="${severity}"
		     role="button"
		     tabindex="0"
		     title="Filter active vulnerabilities by ${title}"
		     style="border-left: 3px solid ${accent};">
			<div class="metric-title">${title}</div>
			<div class="metric-trend" style="color: ${accent};">
				${TREND_CHART_SVG}
				<span>${value}</span>
			</div>
		</div>`;
}

function buildBasicSubItems(items: TrendSubItem[] | undefined, count: number): string {
	if (!items || items.length === 0) {
		return '';
	}
	return items.map((item) => /* html */ `
		<div class="trend-sub-item filterable-type-item"
		     data-vuln-type="${escapeHtml(item.type)}"
		     role="button"
		     tabindex="0"
		     title="Filter active vulnerabilities by ${escapeHtml(item.type)}">
			<span class="sub-label">${item.type}</span>
			${item.subtitle ? `<span class="sub-subtitle">${item.subtitle}</span>` : ''}
			<span class="sub-count">${item.instances}</span>
		</div>`).join('');
}

function buildPersistingSubItems(items: TrendSubItem[] | undefined, count: number): string {
	if (!items || items.length === 0) {
		return '';
	}
	return items.map((item) => {
		const reportCount = item.reportCount ?? 2;
		const countStr = reportCount === 1 ? '1 report' : `${reportCount} reports`;
		const subtitleText = item.subtitle ?? `Present since ${countStr}`;
		return /* html */ `
			<div class="trend-sub-item filterable-type-item"
			     data-vuln-type="${escapeHtml(item.type)}"
			     role="button"
			     tabindex="0"
			     title="Filter active vulnerabilities by ${escapeHtml(item.type)}">
				<span class="sub-label">${item.type}</span>
				<span class="sub-subtitle persisting-subtitle">${subtitleText}</span>
				<span class="sub-count">${item.instances}</span>
			</div>`;
	}).join('');
}

function buildImprovingSubItems(items: ImprovingSubItem[] | undefined, count: number): string {
	if (!items || items.length === 0) {
		return '';
	}
	return items.map((item) => {
		const progressClass = item.progressLabel === 'Some progress'
			? 'progress-some'
			: item.progressLabel === 'Clear progress'
				? 'progress-clear'
				: item.progressLabel === 'Major progress'
					? 'progress-major'
					: 'progress-nochange';
		const vulnType = item.type || 'Unknown';
		return /* html */ `
			<div class="trend-sub-item filterable-type-item"
			     data-vuln-type="${escapeHtml(vulnType)}"
			     role="button"
			     tabindex="0"
			     title="Filter active vulnerabilities by ${escapeHtml(vulnType)}">
				<span class="sub-label">${vulnType}</span>
				<span class="sub-progress ${progressClass}">${item.progressLabel}</span>
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
 * @param instanceLabel - Text label describing instance count
 * @param tooltip  - Optional explanatory tooltip description
 */
function buildCollapsibleTrendRow(
	id: string,
	icon: string,
	label: string,
	count: number,
	subItems: string,
	instanceLabel: string,
	tooltip?: string,
): string {
	const tooltipAttr = tooltip ? ` title="${escapeHtml(tooltip)}"` : '';
	return /* html */ `
		<div class="trend-group" data-trend-id="${id}">
			<button class="trend-header" type="button" aria-expanded="false"
			        aria-controls="trend-body-${id}" data-trend-toggle="${id}"${tooltipAttr}>
				<span class="trend-header-left">
					${icon}
					<span class="trend-header-label">${label}</span>
				</span>
				<span class="trend-header-right">
					<span class="trend-instance-count">${instanceLabel} :  <span style="color: var(--text); font-weight: 700;">${count}</span></span>
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

function buildCommonVulnerabilitiesPanel(
	items?: CommonVulnerabilityItem[],
	totalSessionsAnalyzed?: number,
): string {
	let content: string;

	if (!items || items.length === 0) {
		const totalSessions = totalSessionsAnalyzed ?? items?.[0]?.totalSessions ?? 0;
		const emptyMessage = totalSessions < COMMON_VULN_POLICY.K
			? 'Not enough session data yet'
			: 'No common vulnerabilities';
		content = /* html */ `<div class="panel-empty">${emptyMessage}</div>`;
	} else {
		content = items.map(item => {
			const statusLabel = item.activeFindingCount > 0
				? /* html */ `<span class="cv-active">${item.activeFindingCount} active</span>`
				: /* html */ `<span class="cv-resolved">all resolved</span>`;
			return /* html */ `
				<div class="cv-card filterable-type-item"
				     data-vuln-type="${escapeHtml(item.type)}"
				     role="button"
				     tabindex="0"
				     title="Filter active vulnerabilities by ${escapeHtml(item.type)}">
					<div class="cv-card-left">
						<span class="cv-type">${item.type}</span>
						${statusLabel}
					</div>
					<div class="cv-card-body">
						<span class="cv-cwe">${item.cweId}</span>
						<span class="cv-instances">found ${item.totalInstanceCount} time${item.totalInstanceCount !== 1 ? 's' : ''}</span>
					</div>
				</div>`;
		}).join('');
	}

	return /* html */ `
		<div class="common-vuln-panel">
			<div class="common-vuln-header">
				<div class="common-vuln-header-left">
					${COMMON_VULN_SVG}
					<span class="common-vuln-title">Common Vulnerabilities</span>
				</div>
				<span class="common-vuln-subtitle">Tracks recurring vulnerability patterns across your sessions.</span>
			</div>
			<div class="common-vuln-feed">
				${content}
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
		--border: var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
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

	/* ── Full report section ── */
	.full-report-section,
	.full-scan-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.full-report-header,
	.full-scan-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--muted);
		letter-spacing: 0.04em;
		padding-bottom: 10px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}

	.full-report-header-left {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* ── Session Context Badge ── */
	.session-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.3px;
		padding: 2px 8px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 35%, transparent);
		color: var(--vscode-badge-foreground, var(--text));
		border: 1px solid var(--border);
		text-transform: uppercase;
	}

	.session-dot {
		font-size: 8px;
		color: var(--accent);
		line-height: 1;
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
	}

	.metric-card:hover {
		border-color: rgba(70, 213, 196, 0.55);
		box-shadow: var(--shadow);
	}

	.filterable-metric-card {
		cursor: pointer;
		user-select: none;
	}

	.filterable-metric-card:hover {
		transform: translateY(-1px);
	}

	.filterable-metric-card:active {
		transform: translateY(0);
	}

	.filterable-metric-card:focus-visible,
	.filterable-type-item:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: -1px;
	}

	.filterable-type-item {
		cursor: pointer;
		user-select: none;
		transition: background-color 0.15s ease;
		border-radius: 4px;
	}

	.filterable-type-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.metric-title {
		font-weight: 600;
		font-size: 13px;
		text-transform: uppercase;
		color: var(--muted);
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

	.trends-header-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px 8px;
		flex-wrap: wrap;
	}

	.trends-title {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--muted);
	}

	.trends-subtitle {
		font-size: 11px;
		color: var(--muted);
		font-weight: 400;
		line-height: 1.3;
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
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.sub-subtitle {
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}

	.persisting-subtitle {
		color: var(--muted);
	}

	.progress-some     { color: var(--orange); background: color-mix(in srgb, var(--orange) 15%, transparent); }
	.progress-clear    { color: var(--accent-strong); background: color-mix(in srgb, var(--accent) 15%, transparent); }
	.progress-major    { color: var(--blue); background: color-mix(in srgb, var(--blue) 15%, transparent); }
	.progress-nochange { color: var(--muted); background: color-mix(in srgb, var(--muted) 15%, transparent); }

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

	/* ── Common vulnerabilities panel ── */
	.common-vuln-panel {
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		max-height: 280px;
		overflow: hidden;
	}

	.common-vuln-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px 8px;
		border-bottom: 1px solid rgba(58, 58, 58, 0.6);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.common-vuln-header-left {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.common-vuln-title {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--muted);
		letter-spacing: 0.04em;
	}

	.common-vuln-subtitle {
		font-size: 11px;
		color: var(--muted);
		font-weight: 400;
		line-height: 1.3;
	}

	.section-icon {
		width: 16px;
		height: 16px;
		color: var(--muted);
		flex-shrink: 0;
	}

	.common-vuln-feed {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 8px;
		scrollbar-width: thin;
		scrollbar-color: rgba(70, 213, 196, 0.3) transparent;
	}

	.common-vuln-feed:has(.panel-empty) {
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

	/* ── Common vulnerability cards ── */
	.cv-card {
		padding: 8px 10px;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.cv-card:last-child { border-bottom: none; }

	.cv-card-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.cv-type {
		font-size: 12px;
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cv-card-body {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 3px;
		flex-shrink: 0;
	}

	.cv-cwe {
		font-size: 10px;
		color: var(--muted);
	}

	.cv-instances {
		font-size: 11px;
		font-weight: 700;
		color: var(--accent);
	}

	.cv-active {
		font-size: 10px;
		font-weight: 500;
		color: #E24B4A;
	}

	.cv-resolved {
		font-size: 10px;
		font-weight: 500;
		color: var(--accent);
	}

	.signin-state {
		display: grid;
		gap: 10px;
		align-content: center;
		justify-items: center;
		min-height: 220px;
		padding: 32px 20px;
		text-align: center;
	}

	.signin-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}

	.signin-copy {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
		max-width: 340px;
		color: var(--muted);
	}

	.signin-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 6px;
		padding: 7px 14px;
		border-radius: 2px;
		background: var(--vscode-button-background);
		color: var(--vscode-button-foreground);
		text-decoration: none;
		font-size: 13px;
	}

	.signin-cta:hover {
		background: var(--vscode-button-hoverBackground);
	}

	@media (max-width: 520px) {
		body { padding: 12px; }
		.metrics-grid { grid-template-columns: 1fr; gap: 8px; }
		.metric-title {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.metric-trend { flex-shrink: 0; }
	}
`;

// ── Public API ────────────────────────────────────────────────────────

/**
 * Builds the complete HTML document for the Session Metrics panel.
 *
 * @param metrics - Aggregated session metrics from the current scan session.
 * @returns A complete HTML string ready to be set on a VS Code webview.
 */
export function buildSessionMetricsHtml(
	metrics: SessionMetrics,
	options: { signedIn?: boolean; loading?: boolean } = {},
): string {
	if (options.loading) {
		return buildStartupLoadingHtml('Session Metrics');
	}
	if (options.signedIn === false) {
		return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Session Metrics</title>
		<style>${CSS}</style>
	</head>
	<body>
		<section class="signin-state" role="status">
			<p class="signin-title">Sign in required</p>
			<p class="signin-copy">
				GitHub sign-in is needed to generate reports and show session metrics for
				this workspace.
			</p>
			<a class="signin-cta" href="command:ariadne-extension-vscode.openSignInPanel">Sign in to Ariadne</a>
		</section>
	</body>
</html>`;
	}

	const { critical, high, medium, low, trends } = metrics;
	const sessionLabel = (metrics.sessionLabel || 'Session 1').toUpperCase();

	const persistingSubItems = buildPersistingSubItems(trends.persistingItems, trends.persistingPatterns);
	const improvingSubItems = buildImprovingSubItems(trends.improvingItems, trends.improvingTrends);
	const recurringSubItems = buildBasicSubItems(trends.recurringItems, trends.recurringPatterns);
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
			<div class="full-report-section">
				<div class="full-report-header">
					<div class="full-report-header-left">
						${FULL_REPORT_SVG}
						<span>Full Report</span>
					</div>
					<span class="session-badge"><span class="session-dot">●</span> ${escapeHtml(sessionLabel)}</span>
				</div>
				<div class="metrics-grid">
					${buildMetricCard('Critical Issues', critical, 'critical')}
					${buildMetricCard('High Issues', high, 'high')}
					${buildMetricCard('Medium Issues', medium, 'medium')}
					${buildMetricCard('Low Issues', low, 'low')}
				</div>
			</div>

			<div class="divider"></div>

			<div class="trends-card">
				<div class="trends-header-row">
					<div class="trends-title">
						${TRENDS_HEADER_SVG}
						<span>Trends</span>
					</div>
					<span class="trends-subtitle">Compares reports to track progress and unresolved risks.</span>
				</div>

				${buildCollapsibleTrendRow(
		'persisting',
		PERSISTING_SVG,
		'Persisting Patterns',
		trends.persistingPatterns,
		persistingSubItems,
		'Instances Open',
		'Vulnerabilities that remain unaddressed across multiple reports.',
	)}

				${buildCollapsibleTrendRow(
		'improving',
		IMPROVING_SVG,
		'Improving Trends',
		trends.improvingTrends,
		improvingSubItems,
		'Instances Remaining',
		'Vulnerabilities where occurrences are decreasing.',
	)}

				${buildCollapsibleTrendRow(
		'recurring',
		RECURRING_SVG,
		'Recurring Patterns',
		trends.recurringPatterns,
		recurringSubItems,
		'Instances Returned',
		'Previously resolved vulnerabilities that have reappeared.',
	)}

				${buildCollapsibleTrendRow(
		'resolved',
		RESOLVED_SVG,
		'Resolved This Session',
		trends.resolvedThisSession,
		resolvedSubItems,
		'Instances Fixed',
		'Vulnerabilities successfully and durably remediated in this session.',
	)}
			</div>
			
			<div class="divider"></div>
			
			${buildCommonVulnerabilitiesPanel(metrics.commonVulnerabilities, metrics.totalSessionsAnalyzed)}
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

				// ── Cross-filtering to Active Vulnerabilities ────────────
				document.addEventListener('click', function (e) {
					const metricCard = e.target.closest('.filterable-metric-card');
					if (metricCard && metricCard.dataset.severity) {
						vscode.postMessage({ type: 'filter-severity', severity: metricCard.dataset.severity });
						return;
					}
					const typeItem = e.target.closest('.filterable-type-item');
					if (typeItem && typeItem.dataset.vulnType) {
						vscode.postMessage({ type: 'filter-type', vulnType: typeItem.dataset.vulnType });
						return;
					}
				});

				document.addEventListener('keydown', function (e) {
					if (e.key === 'Enter' || e.key === ' ') {
						const target = e.target;
						if (target && target.classList && target.classList.contains('filterable-metric-card') && target.dataset.severity) {
							e.preventDefault();
							vscode.postMessage({ type: 'filter-severity', severity: target.dataset.severity });
						} else if (target && target.classList && target.classList.contains('filterable-type-item') && target.dataset.vulnType) {
							e.preventDefault();
							vscode.postMessage({ type: 'filter-type', vulnType: target.dataset.vulnType });
						}
					}
				});
			})();
		</script>
	</body>
</html>`;
}