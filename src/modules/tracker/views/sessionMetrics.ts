/**
 * View builder for the Session Metrics panel.
 *
 * This is a pure function: given a SessionMetrics object it returns a
 * complete HTML string ready to be stamped into a webview.
 * It contains zero data — all data flows in from the caller.
 */

import { SessionMetrics, SessionNotification, TrendSubItem, ImprovingSubItem, CommonVulnerabilityItem, Severity } from '../../presentation/panelTypes.js';
import { SEVERITY_COLORS } from '../../presentation/severityColors.js';
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

const GEAR_SVG =
	`<svg class="gear-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
		<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const SAVE_ICON_SVG =
	`<svg class="status-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
		<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		<polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		<polyline points="7 3 7 8 15 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const CHECK_ICON_SVG =
	`<svg class="status-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
		<polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const ARIADNE_EMPTY_LOGO_SVG =
	`<svg class="empty-state-logo" width="28" height="28" viewBox="0 0 798 798" fill="none" aria-hidden="true">
		<g fill="currentColor" transform="translate(88,798) scale(0.1,-0.1)">
			<path d="M3068 7965 c-15 -8 -136 -88 -270 -178 -408 -274 -816 -505 -1238 -703 -479 -223 -810 -344 -1273 -465 -126 -32 -237 -64 -247 -69 -16 -8 -19 -30 -26 -177 -12 -274 -10 -1286 4 -1503 48 -751 160 -1516 282 -1935 56 -190 160 -504 169 -510 4 -2 84 174 176 393 211 497 270 627 517 1142 110 228 202 422 205 431 3 12 -25 38 -101 93 -58 42 -110 76 -115 76 -5 0 -120 -234 -257 -520 -143 -299 -252 -514 -256 -507 -10 18 -73 459 -102 712 -36 313 -54 564 -66 925 -10 282 -6 949 6 992 3 11 47 29 137 58 505 160 1104 416 1608 685 76 41 141 75 144 75 14 0 -3 -38 -87 -194 -51 -93 -176 -330 -278 -524 l-185 -355 -100 -56 c-180 -102 -326 -211 -430 -322 -236 -251 -241 -513 -14 -741 94 -94 163 -140 344 -228 322 -156 699 -268 1400 -415 487 -102 729 -167 970 -260 267 -103 483 -245 553 -364 23 -40 27 -57 27 -126 0 -69 -4 -87 -29 -132 -81 -146 -306 -324 -561 -444 -55 -25 -192 -81 -305 -124 -262 -99 -334 -133 -436 -200 -131 -88 -199 -179 -241 -326 -15 -55 -18 -103 -18 -341 l0 -277 -31 -23 c-40 -30 -86 -84 -110 -128 -30 -56 -27 -190 6 -254 32 -62 107 -130 167 -150 64 -22 167 -20 220 3 107 49 175 150 181 269 4 66 1 79 -27 137 -30 59 -65 99 -120 136 l-24 15 -5 255 c-6 313 0 344 82 424 64 62 154 108 386 195 254 96 357 141 502 219 445 238 686 571 614 848 -69 271 -319 473 -801 648 -272 99 -457 147 -1050 275 -565 121 -785 181 -1055 287 -223 88 -366 170 -461 265 -128 128 -118 235 38 399 92 96 103 88 44 -30 -23 -44 -41 -87 -41 -95 0 -35 200 -181 220 -160 4 5 129 248 277 539 249 488 446 864 871 1660 88 165 179 334 202 374 l43 75 24 -30 c25 -29 72 -114 413 -749 255 -477 376 -709 813 -1570 610 -1201 919 -1850 1232 -2590 129 -305 147 -345 155 -345 20 0 133 311 190 525 128 480 224 1129 272 1860 14 209 15 1405 1 1600 l-8 109 -75 23 c-41 12 -162 45 -268 73 -419 110 -814 260 -1287 489 -403 196 -735 386 -1098 630 -256 172 -336 221 -357 221 -8 -1 -27 -7 -42 -15z M2856 5367 c-137 -292 -258 -549 -268 -570 l-19 -37 28 -11 c16 -6 208 -49 428 -95 220 -46 479 -104 575 -128 96 -25 176 -44 177 -42 3 3 -187 414 -367 791 -34 72 -102 220 -152 330 -94 208 -137 295 -147 295 -3 0 -118 -240 -255 -533z M2242 4050 c-7 -12 -50 -107 -96 -213 -46 -106 -164 -370 -261 -587 -97 -217 -235 -530 -305 -695 -164 -383 -268 -617 -277 -626 -5 -4 -75 -12 -158 -18 -135 -11 -215 -20 -312 -36 l-32 -6 29 -47 c82 -131 395 -495 602 -698 258 -254 466 -419 818 -652 300 -198 444 -284 640 -380 139 -68 184 -86 220 -86 119 -2 795 395 1200 704 363 278 695 609 996 997 96 123 121 163 102 164 -7 0 -121 12 -253 27 l-239 27 -154 347 -154 346 -112 -73 c-160 -104 -304 -178 -477 -245 -83 -32 -156 -63 -162 -69 -7 -7 -5 -18 7 -33 198 -276 289 -468 350 -740 31 -136 32 -180 9 -204 -62 -62 -496 -363 -723 -501 -149 -90 -374 -213 -391 -213 -17 0 -212 109 -419 233 -411 248 -720 482 -1009 763 -152 148 -148 136 -84 242 138 228 467 492 853 688 251 127 652 291 1014 414 274 93 407 149 538 227 176 104 220 158 220 272 0 64 -14 106 -45 140 -49 52 -308 161 -557 235 -186 54 -225 64 -730 172 -217 46 -446 98 -509 114 -63 17 -117 30 -120 30 -3 0 -12 -9 -19 -20z"/>
		</g>
	</svg>`;

function buildSeverityBadge(shortLabel: string, fullTitle: string, value: number, severity: Severity): string {
	const accent = SEVERITY_COLORS[severity];
	return /* html */ `
		<span class="severity-text-badge filterable-metric-card"
		      data-severity="${severity}"
		      role="button"
		      tabindex="0"
		      aria-pressed="false"
		      title="Click to filter ${fullTitle} in the Ariadne Active Vulnerabilities bottom panel"
		      style="--badge-color: ${accent};">
			<span class="severity-badge-dot" style="background: ${accent};"></span>
			<span class="severity-badge-count" style="color: ${accent};">${value}</span>
			<span class="severity-badge-label">${shortLabel}</span>
		</span>`;
}

// ── Partial builders ──────────────────────────────────────────────────

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
		const subtitleText = item.subtitle ?? `Across ${countStr}`;
		const commentedOutCount = item.commentedOutCount ?? 0;
		const commentedOutLabel = commentedOutCount > 0
			? (commentedOutCount < item.instances ? `${commentedOutCount} commented out` : 'Commented out')
			: '';
		const commentedOutBadge = commentedOutLabel
			? `<span class="commented-out-badge" title="Hidden from Live Scan because code is commented out — still tracked in Full Report until fixed or removed">${escapeHtml(commentedOutLabel)}</span>`
			: '';
		return /* html */ `
			<div class="trend-sub-item filterable-type-item"
			     data-vuln-type="${escapeHtml(item.type)}"
			     role="button"
			     tabindex="0"
			     title="Filter active vulnerabilities by ${escapeHtml(item.type)}">
				<span class="sub-label-group">
					<span class="persisting-report-circle" title="${escapeHtml(subtitleText)}" aria-label="${escapeHtml(subtitleText)}">${reportCount}</span>
					<span class="sub-label" title="${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>
					${commentedOutBadge}
				</span>
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
	const stateClass = count > 0 ? 'is-populated' : 'is-empty';
	return /* html */ `
		<div class="trend-group ${stateClass}" data-trend-id="${id}">
			<button class="trend-header" type="button" aria-expanded="false"
			        aria-controls="trend-body-${id}" data-trend-toggle="${id}"${tooltipAttr}>
				<span class="trend-header-left">
					${icon}
					<span class="trend-header-text">
						<span class="trend-header-label">${label}</span>
						<span class="trend-instance-sub">${instanceLabel}</span>
					</span>
				</span>
				<span class="trend-header-right">
					<span class="trend-count-badge">${count}</span>
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
		content = /* html */ `
			<div class="panel-empty">
				${ARIADNE_EMPTY_LOGO_SVG}
				<span class="panel-empty-text">${emptyMessage}</span>
			</div>`;
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
					<div class="cv-row-top">
						<span class="cv-type">${escapeHtml(item.type)}</span>
						<span class="cv-cwe">${escapeHtml(item.cweId)}</span>
					</div>
					<div class="cv-row-bottom">
						${statusLabel}
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


	@keyframes panelSpotlightPulse {
		0% {
			box-shadow: inset 0 0 0 2px var(--vscode-focusBorder, #007acc);
			background-color: color-mix(in srgb, var(--vscode-focusBorder, #007acc) 12%, var(--bg));
		}
		50% {
			box-shadow: inset 0 0 0 2px var(--vscode-focusBorder, #007acc);
			background-color: color-mix(in srgb, var(--vscode-focusBorder, #007acc) 8%, var(--bg));
		}
		100% {
			box-shadow: inset 0 0 0 0 transparent;
			background-color: var(--bg);
		}
	}

	body.panel-spotlight {
		animation: panelSpotlightPulse 1.4s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	* { box-sizing: border-box; }

	body {
		margin: 0;
		padding: 4px 6px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		background: var(--bg);
		color: var(--text);
	}

	.dashboard { display: grid; gap: 0; }

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

	.full-report-header-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	/* ── Full Report Settlement Status Indicator ── */
	.report-status-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.01em;
		text-transform: none;
		padding: 2px 8px;
		border-radius: 10px;
		border: 1px solid var(--border);
		white-space: nowrap;
	}

	.report-status-updating {
		color: var(--vscode-descriptionForeground);
		background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 25%, transparent);
	}

	.report-status-updated {
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
	}

	.report-status-spinner {
		width: 11px;
		height: 11px;
		border: 1.75px solid color-mix(in srgb, var(--vscode-descriptionForeground) 35%, transparent);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: report-spin 0.75s linear infinite;
		display: inline-block;
		flex-shrink: 0;
	}

	@keyframes report-spin {
		to { transform: rotate(360deg); }
	}

	/* ── Session Context Badge ── */
	.session-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 9.5px;
		font-weight: 600;
		letter-spacing: 0.3px;
		padding: 2px 6px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 35%, transparent);
		color: var(--vscode-badge-foreground, var(--text));
		border: 1px solid var(--border);
		text-transform: uppercase;
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-badge.not-started {
		border-color: color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 30%, var(--border));
	}

	.session-dot {
		font-size: 7px;
		color: var(--accent);
		line-height: 1;
		flex-shrink: 0;
	}

	.session-dot.not-started {
		color: var(--vscode-errorForeground, #f14c4c);
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

	@keyframes slideInFromLeft {
		from {
			opacity: 0;
			transform: translateX(-14px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.dashboard {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0;
		width: 100%;
		min-width: 0;
		overflow-x: hidden;
		animation: slideInFromLeft 0.18s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.trends-title-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
	}

	.trends-header-right {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.settings-gear-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		height: 22px;
		padding: 0 7px;
		border-radius: 5px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: color 0.15s ease, background-color 0.15s ease;
	}

	.settings-gear-btn:hover {
		color: var(--text);
		background: rgba(255, 255, 255, 0.08);
	}

	.severity-status-section {
		background: var(--panel);
		border-bottom: 1px solid var(--border);
		padding: 9px 10px 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.report-status-idle {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 7px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 45%, transparent);
		border: 1px solid var(--border);
		color: var(--muted);
		font-size: 10px;
		font-weight: 600;
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-icon {
		flex-shrink: 0;
	}

	.full-report-status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: nowrap;
		gap: 6px;
		padding-top: 2px;
		min-width: 0;
	}

	@media (max-width: 245px) {
		.severity-badges-bar {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 4px 6px;
		}
		.settings-label,
		.report-status-text {
			display: none;
		}
		.settings-gear-btn {
			padding: 0 5px;
		}
		.report-status-idle,
		.report-status-updating,
		.report-status-updated {
			padding: 3px 6px;
		}
	}

	.severity-status-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--border);
	}

	.severity-status-header {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.severity-badges-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 4px 6px;
	}

	.severity-text-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		border-radius: 999px;
		border: 1px solid transparent;
		font-size: 10.5px;
		line-height: 1.3;
		cursor: pointer;
		user-select: none;
		transition: background-color 0.12s ease, border-color 0.12s ease, transform 0.08s ease;
	}

	.severity-text-badge:hover {
		background: rgba(255, 255, 255, 0.07);
	}

	.severity-text-badge:active {
		transform: scale(0.95);
	}

	.severity-text-badge.is-active {
		background: color-mix(in srgb, var(--badge-color, var(--accent)) 18%, transparent);
		border-color: color-mix(in srgb, var(--badge-color, var(--accent)) 55%, transparent);
	}

	.severity-text-badge.is-active .severity-badge-label {
		color: var(--text);
		font-weight: 600;
	}

	.severity-badge-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.severity-badge-count {
		font-weight: 700;
	}

	.severity-badge-label {
		color: var(--muted);
		font-weight: 500;
	}

	/* ── Trends card (edge-to-edge sidebar section) ── */
	.trends-card {
		background: transparent;
		border: none;
		border-radius: 0;
		overflow: hidden;
		min-width: 0;
		margin-top: 4px;
	}

	.trends-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		padding: 8px 10px;
		flex-wrap: wrap;
		min-width: 0;
	}

	.trends-title-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		min-width: 0;
	}

	.trends-title {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--muted);
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trends-subtitle {
		font-size: 11px;
		color: var(--muted);
		font-weight: 400;
		line-height: 1.3;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── Collapsible trend row ── */
	.trend-group {
		border-top: 1px solid var(--vscode-panel-border);
		transition: background 0.15s ease;
	}

	.trend-group.is-populated {
		background: color-mix(in srgb, var(--vscode-editor-background) 62%, black 38%);
	}

	.trend-group.is-empty .trend-header {
		opacity: 0.45;
		color: var(--muted);
	}

	.trend-group.is-empty .trend-icon,
	.trend-group.is-empty .chevron-icon {
		color: var(--muted);
	}

	.trend-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		padding: 8px 10px;
		background: transparent;
		border: none;
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}

	.trend-header:hover { background: rgba(255, 255, 255, 0.04); }
	.trend-group.is-populated .trend-header:hover { background: rgba(255, 255, 255, 0.05); }

	.trend-count-num {
		color: var(--text);
		font-weight: 700;
	}

	.trend-group.is-empty .trend-count-num {
		color: var(--muted);
		font-weight: 500;
	}

	.trend-header-left {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}

	.trend-header-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.trend-header-label {
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trend-instance-sub {
		font-size: 10.5px;
		font-weight: 400;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trend-header-right {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.trend-count-badge {
		min-width: 24px;
		padding: 2px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text) 12%, transparent);
		color: var(--text);
		font-size: 11px;
		font-weight: 700;
		text-align: center;
		white-space: nowrap;
	}

	.trend-group.is-empty .trend-count-badge {
		background: transparent;
		color: var(--muted);
		font-weight: 500;
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
		padding: 8px 10px 8px 14px;
		font-size: 12px;
		color: var(--text);
	}

	.trend-sub-item:last-child { padding-bottom: 8px; }

	.persisting-report-circle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 999px;
		background: color-mix(in srgb, #E24B4A 22%, transparent);
		border: 1px solid color-mix(in srgb, #E24B4A 50%, transparent);
		color: #f87171;
		font-size: 10.5px;
		font-weight: 700;
		line-height: 1;
		flex-shrink: 0;
		cursor: pointer;
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s ease;
	}

	.persisting-report-circle:hover {
		transform: scale(1.18) translateY(-1px);
		background: color-mix(in srgb, #E24B4A 34%, transparent);
	}

	.sub-label-group {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 8px;
	}

	.sub-label {
		flex: 1;
		min-width: 0;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sub-label-group .sub-label {
		flex: 1 1 auto;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

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
		font-size: 11px;
		color: var(--muted);
		background: color-mix(in srgb, var(--vscode-badge-background, #4d4d4d) 25%, transparent);
		border: 1px solid var(--border);
		padding: 2px 8px;
		border-radius: 10px;
	}

	.commented-out-badge {
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		padding: 2px 8px;
		border-radius: 10px;
		color: var(--orange);
		background: color-mix(in srgb, var(--orange) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--orange) 35%, transparent);
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
		flex-shrink: 0;
		text-align: right;
	}

	.trend-sub-placeholder { color: var(--muted); }

	.trend-red   { color: #E24B4A; }
	.trend-teal  { color: var(--accent-strong); }
	.trend-blue  { color: var(--blue); }

	.divider { height: 1px; background: rgba(58, 58, 58, 0.7); }

	/* ── Common vulnerabilities panel (edge-to-edge sidebar section) ── */
	.common-vuln-panel {
		background: transparent;
		border: none;
		border-top: 1px solid var(--border);
		border-radius: 0;
		display: flex;
		flex-direction: column;
		max-height: 280px;
		overflow: hidden;
	}

	.common-vuln-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px;
		padding: 10px 10px 8px;
		border-bottom: 1px solid rgba(58, 58, 58, 0.6);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.common-vuln-header-left {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
	}

	.common-vuln-title {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--muted);
		letter-spacing: 0.04em;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.common-vuln-subtitle {
		font-size: 11px;
		color: var(--muted);
		font-weight: 400;
		line-height: 1.3;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 12px;
		color: var(--muted);
		text-align: center;
		padding: 18px 8px;
	}

	.empty-state-logo {
		opacity: 0.45;
		color: var(--muted);
	}

	.panel-empty-text {
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── Common vulnerability cards ── */
	.cv-card {
		padding: 8px 10px;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.cv-card:last-child { border-bottom: none; }

	.cv-row-top,
	.cv-row-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
		width: 100%;
	}

	.cv-type {
		flex: 1;
		min-width: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cv-cwe {
		font-size: 10px;
		color: var(--muted);
		flex-shrink: 0;
		white-space: nowrap;
	}

	.cv-instances {
		font-size: 11px;
		font-weight: 700;
		color: var(--accent);
		flex-shrink: 0;
		white-space: nowrap;
	}

	.cv-active,
	.cv-resolved {
		white-space: nowrap;
		flex-shrink: 0;
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
	const isSessionActive = metrics.isSessionActive !== false;
	const sessionLabel = (metrics.sessionLabel || 'Session 1').toUpperCase();
	const fullSessionBadgeText = escapeHtml(sessionLabel);
	const sessionTitle = isSessionActive
		? 'Session active'
		: 'Session not started yet — save a file to begin';
	const badgeClass = isSessionActive ? 'session-badge' : 'session-badge not-started';
	const dotClass = isSessionActive ? 'session-dot' : 'session-dot not-started';
	const reportStatusHtml = metrics.reportUpdateStatus === 'updating'
		? '<span class="report-status-indicator report-status-updating" role="status" aria-live="polite" title="Settling recent save to update Full Report metrics and trends..."><span class="report-status-spinner" aria-hidden="true"></span><span class="report-status-text">Updating...</span></span>'
		: metrics.reportUpdateStatus === 'updated'
			? `<span class="report-status-indicator report-status-updated" role="status" aria-live="polite" title="Full Report records and trends are up to date with the latest settled save.">${CHECK_ICON_SVG}<span class="report-status-text">Updated</span></span>`
			: `<span class="report-status-indicator report-status-idle" role="status" aria-live="polite" title="Hit Save to update Full Report records.">${SAVE_ICON_SVG}<span class="report-status-text">Hit Save to update</span></span>`;

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
			<div class="severity-status-section" aria-label="Full Report">
				<div class="severity-status-header-row">
					<div class="severity-status-header">
						${FULL_REPORT_SVG}
						<span>Full Report</span>
					</div>
					<button type="button" class="settings-gear-btn" id="open-settings-btn"
					        title="Open Ariadne Settings" aria-label="Open Ariadne Settings">
						${GEAR_SVG}
						<span class="settings-label">Settings</span>
					</button>
				</div>
				<div class="severity-badges-bar" aria-label="Severity Breakdown">
					${buildSeverityBadge('Crit', 'Critical Issues', critical, 'critical')}
					${buildSeverityBadge('High', 'High Issues', high, 'high')}
					${buildSeverityBadge('Med', 'Medium Issues', medium, 'medium')}
					${buildSeverityBadge('Low', 'Low Issues', low, 'low')}
				</div>
				<div class="full-report-status-row">
					<span class="${badgeClass}" title="${sessionTitle}"><span class="${dotClass}">●</span> ${fullSessionBadgeText}</span>
					${reportStatusHtml}
				</div>
			</div>
			<div class="trends-card">
				<div class="trends-header-row">
					<div class="trends-title-bar">
						<div class="trends-title">
							${TRENDS_HEADER_SVG}
							<span>Trends</span>
						</div>
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
			
			${buildCommonVulnerabilitiesPanel(metrics.commonVulnerabilities, metrics.totalSessionsAnalyzed)}
		</section>
		<script>
			(function () {
				const vscode = acquireVsCodeApi();

				document.getElementById('open-settings-btn')?.addEventListener('click', function () {
					vscode.postMessage({ type: 'open-settings' });
				});

				window.addEventListener('message', function (event) {
					var msg = event.data;
					if (msg && msg.type === 'highlight-panel') {
						document.body.classList.remove('panel-spotlight');
						void document.body.offsetWidth;
						document.body.classList.add('panel-spotlight');
						setTimeout(function () {
							document.body.classList.remove('panel-spotlight');
						}, 1500);
					}
				});


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
				function setActiveSeverityBadge(clickedEl) {
					const shouldActivate = !clickedEl.classList.contains('is-active');
					document.querySelectorAll('.filterable-metric-card').forEach(function (el) {
						const active = shouldActivate && el === clickedEl;
						el.classList.toggle('is-active', active);
						el.setAttribute('aria-pressed', String(active));
					});
				}

				document.addEventListener('click', function (e) {
					const metricCard = e.target.closest('.filterable-metric-card');
					if (metricCard && metricCard.dataset.severity) {
						setActiveSeverityBadge(metricCard);
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
							setActiveSeverityBadge(target);
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