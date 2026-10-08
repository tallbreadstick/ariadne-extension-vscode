/**
 * View builder for the Active Vulnerabilities panel.
 *
 * This is a pure function: given an array of Vulnerability objects it
 * returns a complete HTML string ready to be stamped into a webview.
 * It contains zero data — all data flows in from the caller.
 */

import { Vulnerability, Severity } from '../panelTypes.js';
import { severityCssVars } from '../severityColors.js';
import { collectVulnFilterFacets, formatCategoryLabel } from './vulnFilters.js';
import { buildStartupLoadingHtml } from './startupLoading.js';
import { askAriadneCommandQuery } from '../../feedback/views/feedbackPanel.js';

const OPEN_FEEDBACK_COMMAND = 'ariadne-extension-vscode.openFeedbackPanel';
const OPEN_SIGN_IN_COMMAND = 'ariadne-extension-vscode.openSignInPanel';
const OPEN_SETTINGS_COMMAND = 'ariadne-extension-vscode.openSettings';

const SEVERITY_OPTIONS: Severity[] = ['critical', 'high', 'medium', 'low'];

export interface ActiveVulnerabilitiesOptions {
	/** Vulnerability key to render expanded when reopening a workspace. */
	expandedKey?: string;
	/** When false, the panel asks the user to sign in instead of showing findings. */
	signedIn?: boolean;
	/** When true, the selected scanner binary failed its health check. */
	scannerBroken?: boolean;
	/** When true, auth has not finished and the panel must not ask for sign-in yet. */
	loading?: boolean;
	/** Number of vulnerabilities resolved so far in this session. */
	resolvedCount?: number;
	/** Common vulnerability habit types (for Next Focus prioritization). */
	commonVulnTypes?: string[];
}

export interface NextFocusTarget {
	vuln: Vulnerability;
	isCommonHabit: boolean;
	reason: string;
}

/**
 * Determines the highest pedagogical priority finding for the student to resolve next.
 * Prioritizes active findings that match recurring Common Vulnerability habits,
 * followed by highest severity (Critical > High > Medium > Low).
 */
export function determineNextFocus(
	vulns: Vulnerability[],
	commonVulnTypes: string[] = [],
): NextFocusTarget | null {
	if (vulns.length === 0) {
		return null;
	}

	const severityWeights: Record<Severity, number> = {
		critical: 4,
		high: 3,
		medium: 2,
		low: 1,
	};

	const normalizedCommon = new Set(
		commonVulnTypes.map((t) => t.trim().toLowerCase()),
	);

	// 1. Check for active findings that match recurring Common Vulnerability habits
	const habitFindings = vulns.filter((v) => {
		const titleKey = v.title.trim().toLowerCase();
		const cweKey = v.cwe.trim().toLowerCase();
		return normalizedCommon.has(titleKey) || normalizedCommon.has(cweKey);
	});

	if (habitFindings.length > 0) {
		habitFindings.sort(
			(a, b) => (severityWeights[b.severity] ?? 0) - (severityWeights[a.severity] ?? 0),
		);
		return {
			vuln: habitFindings[0],
			isCommonHabit: true,
			reason: 'Recurring Habit',
		};
	}

	// 2. Otherwise prioritize highest severity (Critical > High > Medium > Low)
	const sorted = [...vulns].sort(
		(a, b) => (severityWeights[b.severity] ?? 0) - (severityWeights[a.severity] ?? 0),
	);

	return {
		vuln: sorted[0],
		isCommonHabit: false,
		reason: `${capitalize(sorted[0].severity)} Priority`,
	};
}

/** Stable key for accordion persistence across scans and workspace reopens. */
export function buildVulnKey(vuln: Vulnerability): string {
	return `${vuln.cwe}|${vuln.filePath}|${vuln.line}|${vuln.title}`;
}

// ── Helpers ──────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function escapeAttr(value: string): string {
	return escapeHtml(value).replaceAll('\n', ' ');
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildMeta(vuln: Vulnerability): string {
	return vuln.owaspRef ? `${vuln.cwe} · ${vuln.owaspRef}` : vuln.cwe;
}

// ── SVGs ─────────────────────────────────────────────────────────────

const WARNING_SVG = (severity: Severity) =>
	`<svg class="warning-icon ${severity}" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
		<path fill-rule="evenodd" clip-rule="evenodd"
			d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.72L8
			2.28zM7.5 5.5h1v4h-1v-4zm.5 6a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
	</svg>`;

const FILE_SVG =
	`<svg class="file-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
		<path d="M13.71 4.29l-3-3L10 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5l-.29-.71z
			M10 2.41L12.59 5H10V2.41zM4 14V2h5v4h4v8H4z"/>
	</svg>`;

const CHEVRON_SVG =
	`<svg class="chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round" />
	</svg>`;

const FILTER_SVG =
	`<svg class="filter-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" />
	</svg>`;

const SEARCH_SVG =
	`<svg class="search-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
		<path fill-rule="evenodd" clip-rule="evenodd" d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
	</svg>`;

const CLOSE_SVG =
	`<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" aria-hidden="true">
		<path fill-rule="evenodd" clip-rule="evenodd" d="M8 7.293l3.646-3.647.708.708L8.707 8l3.647 3.646-.708.708L8 8.707l-3.646 3.647-.708-.708L7.293 8 3.646 4.354l.708-.708L8 7.293z"/>
	</svg>`;

const CHECK_MARK_SVG =
	`<svg class="check-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
		<path fill-rule="evenodd" clip-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
	</svg>`;

const SPARKLE_SVG =
	`<svg class="sparkle-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
		<path d="M7.5 0.75a.75.75 0 0 1 .7.49l1.32 3.65 3.65 1.32a.75.75 0 0 1 0 1.4l-3.65 1.32-1.32 3.65a.75.75 0 0 1-1.4 0L5.48 8.93 1.83 7.61a.75.75 0 0 1 0-1.4l3.65-1.32 1.32-3.65a.75.75 0 0 1 .7-.49zm5.25 8.25a.5.5 0 0 1 .47.33l.66 1.83 1.83.66a.5.5 0 0 1 0 .94l-1.83.66-.66 1.83a.5.5 0 0 1-.94 0l-.66-1.83-1.83-.66a.5.5 0 0 1 0-.94l1.83-.66.66-1.83a.5.5 0 0 1 .47-.33z"/>
	</svg>`;

const LIVE_SCAN_SVG =
	`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M19.07 4.93A10 10 0 0 0 4.93 19.07"/>
		<path d="M16.24 7.76A6 6 0 0 0 7.76 16.24"/>
		<circle cx="12" cy="12" r="2" fill="currentColor"/>
		<path d="m13.41 10.59 5.66-5.66"/>
	</svg>`;

// ── Card builder ──────────────────────────────────────────────────────

function buildVulnCard(vuln: Vulnerability, expanded: boolean): string {
	const meta = buildMeta(vuln);
	const label = capitalize(vuln.severity);
	const location = `${vuln.filePath} : Line ${vuln.line}`;
	const openAttr = expanded ? ' open' : '';
	const feedbackHref = `command:${OPEN_FEEDBACK_COMMAND}?${askAriadneCommandQuery({
		cwe: vuln.cwe,
		title: vuln.title,
		filePath: vuln.filePath,
		line: vuln.line,
	})}`;
	const vulnKey = encodeURIComponent(buildVulnKey(vuln));
	const searchText = escapeAttr(
		[vuln.title, vuln.filePath].join(' ').toLowerCase(),
	);

	return /* html */ `
		<details
			class="vuln-card"
			data-vuln-key="${vulnKey}"
			data-severity="${vuln.severity}"
			data-cwe="${escapeAttr(vuln.cwe)}"
			data-category="${escapeAttr(vuln.owaspRef ?? '')}"
			data-type="${escapeAttr(vuln.title)}"
			data-file="${escapeAttr(vuln.filePath)}"
			data-search-text="${searchText}"${openAttr}>
			<summary>
				<div class="summary-row">
					<div class="summary-left">
						${WARNING_SVG(vuln.severity)}
						<div class="summary-content">
							<div class="summary-header">
								<span class="badge ${vuln.severity}">${label}</span>
								<span class="issue-meta">${meta}</span>
							</div>
							<div class="issue-title">${vuln.title}</div>
							<div class="summary-file">
								${FILE_SVG}
								<span>${location}</span>
							</div>
						</div>
					</div>
					${CHEVRON_SVG}
				</div>
			</summary>
			<div class="details-panel">
				<div class="detail-grid">
					<div class="detail-row span-2">
						<div class="detail-label">Description</div>
						<div class="detail-value">${vuln.description}</div>
					</div>
					<div class="detail-row">
						<div class="detail-label">File Location</div>
						<button type="button" class="detail-value file goto-location"
						   data-file="${vuln.filePath}"
						   data-line="${vuln.line}"
						   title="Open ${vuln.filePath} at line ${vuln.line}">
							${FILE_SVG}
							<span>${location}</span>
						</button>
					</div>
					<div class="detail-row">
						<div class="detail-label">CWE · OWASP Reference</div>
						<div class="detail-value reference">${meta}</div>
					</div>
				</div>
				<div class="cta-row">
					<a class="action-button btn-explain" role="button" href="${feedbackHref}" title="View AI conceptual explanation">
						${SPARKLE_SVG}
						<span>Explain Vulnerability</span>
					</a>
				</div>
			</div>
		</details>`;
}

// ── CSS ───────────────────────────────────────────────────────────────

const CSS = /* css */ `
    :root {
        color-scheme: dark;
        --bg: var(--vscode-editor-background);
        --list-bg: color-mix(in srgb, var(--vscode-editor-background) 96.5%, white 3.5%);
        --panel: color-mix(in srgb, var(--vscode-editor-background) 70%, black);
        --card: var(--vscode-editorWidget-background);
        --border: var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
        --text: var(--vscode-foreground);
        --muted: var(--vscode-descriptionForeground);
        ${severityCssVars()}
		--file: #569CD6;
		--reference: #CE9178 ;
        --button-bg: var(--vscode-button-background);
        --button-text: var(--vscode-button-foreground);
        --radius: 10px;
    }

    * { box-sizing: border-box; }

    body {
        margin: 0;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--list-bg);
        color: var(--text);
    }

    .sticky-top-bar {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg);
        margin: -16px -16px 12px -16px;
        padding: 16px 16px 6px 16px;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        transition: box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .sticky-top-bar.is-scrolled {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        border-bottom-color: var(--border);
    }

    .live-scan-header,
    .active-vuln-header {
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
        margin-bottom: 10px;
        border-bottom: 1px solid var(--border);
    }

    .live-scan-header-left,
    .active-vuln-header-left {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .section-icon {
        width: 16px;
        height: 16px;
        color: var(--muted);
        flex-shrink: 0;
    }

    .total-badge {
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
        white-space: nowrap;
    }

    /* ── Session Progress & Next Focus ── */
    .session-progress-card {
        margin-bottom: 10px;
        padding: 8px 10px;
        background: color-mix(in srgb, var(--card) 60%, transparent);
        border: 1px solid var(--border);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .session-progress-card.victory {
        background: color-mix(in srgb, #2ea043 15%, var(--card));
        border-color: color-mix(in srgb, #2ea043 40%, var(--border));
    }

    .progress-info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
    }

    .progress-title {
        display: flex;
        align-items: center;
        gap: 5px;
        color: var(--text);
        font-weight: 500;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .progress-title strong {
        color: var(--text);
        font-weight: 700;
    }

    .victory-title {
        color: #3fb950;
        font-weight: 600;
    }

    .progress-icon {
        font-size: 12px;
        flex-shrink: 0;
    }

    .progress-pct {
        font-size: 11px;
        font-weight: 700;
        color: var(--accent-strong, #5ce6d7);
        flex-shrink: 0;
    }

    .victory .progress-pct {
        color: #3fb950;
    }

    .progress-track {
        height: 6px;
        background: color-mix(in srgb, var(--border) 60%, transparent);
        border-radius: 3px;
        overflow: hidden;
        position: relative;
    }

    .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #46d5c4, #5ce6d7);
        border-radius: 3px;
        transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .progress-bar-fill.victory-fill {
        background: linear-gradient(90deg, #3fb950, #2ea043);
    }

    .next-focus-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        padding-top: 2px;
    }

    .next-focus-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--muted);
        white-space: nowrap;
        flex-shrink: 0;
    }

    .next-focus-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--accent, #46d5c4) 12%, var(--card));
        border: 1px solid color-mix(in srgb, var(--accent, #46d5c4) 35%, var(--border));
        color: var(--text);
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        text-align: left;
        min-width: 0;
        max-width: 100%;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    }

    .next-focus-chip:hover {
        background: color-mix(in srgb, var(--accent, #46d5c4) 22%, var(--card));
        border-color: var(--accent, #46d5c4);
        transform: translateY(-0.5px);
    }

    .next-focus-chip:active {
        transform: translateY(0);
    }

    .focus-title {
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .focus-loc {
        font-size: 10px;
        color: var(--file, #569CD6);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .focus-badge {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        padding: 1px 5px;
        border-radius: 3px;
        flex-shrink: 0;
    }

    .focus-badge.habit {
        background: color-mix(in srgb, #e09850 25%, transparent);
        color: #e09850;
        border: 1px solid color-mix(in srgb, #e09850 45%, transparent);
    }

    .focus-badge.critical {
        background: color-mix(in srgb, var(--critical) 25%, transparent);
        color: var(--critical);
        border: 1px solid color-mix(in srgb, var(--critical) 45%, transparent);
    }

    .focus-badge.high {
        background: color-mix(in srgb, var(--high) 25%, transparent);
        color: var(--high);
        border: 1px solid color-mix(in srgb, var(--high) 45%, transparent);
    }

    .focus-badge.medium {
        background: color-mix(in srgb, var(--medium) 25%, transparent);
        color: var(--medium);
        border: 1px solid color-mix(in srgb, var(--medium) 45%, transparent);
    }

    .focus-badge.low {
        background: color-mix(in srgb, var(--low) 25%, transparent);
        color: var(--low);
        border: 1px solid color-mix(in srgb, var(--low) 45%, transparent);
    }

    .focus-arrow {
        color: var(--accent, #46d5c4);
        font-weight: bold;
        flex-shrink: 0;
    }

    @keyframes focusPulse {
        0% {
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent, #46d5c4) 70%, transparent);
            border-color: var(--accent, #46d5c4);
        }
        50% {
            box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #46d5c4) 40%, transparent);
            border-color: var(--accent, #46d5c4);
        }
        100% {
            box-shadow: 0 0 0 0 transparent;
        }
    }

    .vuln-card.highlight-pulse {
        animation: focusPulse 1.6s ease-out;
    }

    .vuln-stack { display: grid; gap: 12px; }

    .toolbar {
        display: grid;
        gap: 8px;
        margin-bottom: 4px;
        padding-bottom: 2px;
        background: transparent;
    }

    .toolbar-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

	.search-wrap {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}

	.search-icon {
		position: absolute;
		left: 9px;
		width: 14px;
		height: 14px;
		color: var(--muted);
		pointer-events: none;
	}

    .search-input {
        width: 100%;
        padding: 6px 26px 6px 28px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: var(--vscode-input-background, var(--card));
        color: var(--vscode-input-foreground, var(--text));
        font: inherit;
        font-size: 12px;
    }

	.search-input::-webkit-search-cancel-button,
	.search-input::-webkit-search-decoration {
		-webkit-appearance: none;
		appearance: none;
	}

	.search-clear-btn {
		position: absolute;
		right: 5px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		border-radius: 50%;
	}

	.search-clear-btn:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--text) 12%, transparent);
	}

	.search-clear-btn[hidden] {
		display: none;
	}

    .filter-select {
        width: 100%;
        padding: 6px 24px 6px 8px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background-color: var(--vscode-input-background, var(--card));
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="%23888888"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.62L3 6.333l.619-.618 4.357 4.357z"/></svg>');
        background-repeat: no-repeat;
        background-position: right 8px center;
        appearance: none;
        -webkit-appearance: none;
        color: var(--vscode-input-foreground, var(--text));
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }

    .search-input:focus,
    .filter-select:focus {
        outline: 1px solid var(--vscode-focusBorder, var(--file));
        outline-offset: -1px;
    }

	.filter-toggle {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--vscode-button-secondaryBackground, var(--card));
		color: var(--vscode-button-secondaryForeground, var(--text));
		cursor: pointer;
		font-family: inherit;
		font-size: 11px;
		font-weight: 500;
		transition: background 0.15s ease-out, border-color 0.15s ease-out;
		white-space: nowrap;
	}

	.filter-toggle:hover,
	.filter-toggle[aria-expanded="true"] {
		background: var(--vscode-button-secondaryHoverBackground, var(--panel));
	}

	.filter-toggle.has-filters {
		border-color: var(--vscode-focusBorder, var(--button-bg));
		background: color-mix(in srgb, var(--button-bg) 16%, var(--card));
	}

	.filter-toggle:focus-visible {
		outline: 1px solid var(--vscode-focusBorder, var(--file));
		outline-offset: 1px;
	}

	.filter-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.filter-toggle-label {
		font-size: 11px;
		font-weight: 500;
	}

	.filter-badge {
		position: absolute;
		top: -5px;
		right: -5px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--button-bg);
		color: var(--button-text);
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
	}

	.filter-badge[hidden] {
		display: none;
	}

	@keyframes filterMenuSlideDown {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

    .filter-menu {
        display: none;
        gap: 12px;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--card);
    }

	.filter-menu.open {
		display: grid;
		animation: filterMenuSlideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.filter-fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		min-width: 0;
	}

	.filter-legend {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
		margin: 0 0 8px 0;
		padding: 0;
	}

	.filter-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.severity-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		border-radius: 4px;
		border: 0;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		user-select: none;
		line-height: 1.2;
		transition: background 0.12s ease-out;
	}

	.severity-chip:hover {
		background: color-mix(in srgb, var(--text) 8%, transparent);
	}

	.severity-chip:active {
		transform: scale(0.97);
	}

	.severity-chip:focus-visible {
		outline: 1px solid var(--vscode-focusBorder, var(--file));
		outline-offset: 2px;
	}

	.severity-check {
		display: inline-grid;
		place-items: center;
		width: 15px;
		height: 15px;
		border-radius: 3px;
		border: 1.5px solid var(--vscode-checkbox-border, var(--border));
		background: transparent;
		flex-shrink: 0;
		pointer-events: none;
		transition: background 0.15s ease-out, border-color 0.15s ease-out;
	}

	.severity-name {
		pointer-events: none;
	}

	.check-icon {
		width: 11px;
		height: 11px;
		opacity: 0;
		transform: scale(0.5);
		transition: opacity 0.12s ease-out, transform 0.12s ease-out;
	}

	.severity-chip[aria-pressed="true"] .severity-name {
		font-weight: 600;
	}

	.severity-chip.critical[aria-pressed="true"] .severity-check {
		border-color: var(--critical);
		background: var(--critical);
	}
	.severity-chip.critical[aria-pressed="true"] .check-icon {
		color: #ffffff;
	}

	.severity-chip.high[aria-pressed="true"] .severity-check {
		border-color: var(--high);
		background: var(--high);
	}
	.severity-chip.high[aria-pressed="true"] .check-icon {
		color: #ffffff;
	}

	.severity-chip.medium[aria-pressed="true"] .severity-check {
		border-color: var(--medium);
		background: var(--medium);
	}
	.severity-chip.medium[aria-pressed="true"] .check-icon {
		color: #1a1a1a;
	}

	.severity-chip.low[aria-pressed="true"] .severity-check {
		border-color: var(--low);
		background: var(--low);
	}
	.severity-chip.low[aria-pressed="true"] .check-icon {
		color: #ffffff;
	}

	.severity-chip[aria-pressed="true"] .check-icon {
		opacity: 1;
		transform: scale(1);
	}

	.filter-grid {
		display: grid;
		gap: 8px;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.filter-field {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.filter-menu-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-top: 6px;
		border-top: 1px solid var(--border);
	}

	.reset-filters {
		padding: 5px 10px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.reset-filters:hover:not(:disabled) {
		background: color-mix(in srgb, var(--text) 6%, transparent);
	}

	.reset-filters:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

    .results-meta {
        font-size: 11px;
        color: var(--muted);
    }

    .filter-empty {
        display: none;
        padding: 16px 12px;
        border: 1px dashed var(--border);
        border-radius: var(--radius);
        background: var(--panel);
        color: var(--muted);
        text-align: center;
        font-size: 12px;
    }

    .filter-empty.visible { display: block; }

    .vuln-card.hidden { display: none; }

    .empty-state {
        display: grid;
        gap: 8px;
        align-content: center;
        justify-items: center;
        min-height: 180px;
        padding: 24px 16px;
        border: 1px dashed var(--border);
        border-radius: var(--radius);
        background: var(--panel);
        color: var(--muted);
        text-align: center;
    }

    .empty-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
    }

    .empty-subtitle {
        font-size: 12px;
        max-width: 360px;
        line-height: 1.5;
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
        min-width: 0; /* Ensures the grid allows its children to shrink */
    }

    summary::-webkit-details-marker { display: none; }

	.detail-value.file {
		color: var(--file);
	}

	button.goto-location {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--file);
		cursor: pointer;
		border-radius: 3px;
		padding: 2px 4px;
		margin: -2px -4px;
		transition: background 0.15s ease, color 0.15s ease;
		background: none;
		border: none;
		font: inherit;
		text-align: left;
	}

	button.goto-location:hover {
		text-decoration: underline;
	}

	button.goto-location .file-icon {
		width: 14px;
		height: 14px;
		flex: 0 0 auto;
	}

	.detail-value.reference {
		color: var(--reference);
	}

    .summary-row {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
        min-width: 0; /* Allows the row to shrink */
    }

    .summary-left {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        min-width: 0; /* Allows left section to shrink */
    }

    .summary-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0; /* Allows content column to shrink */
    }

    .summary-header { 
        display: flex; 
        align-items: center; 
        gap: 10px; 
        min-width: 0; /* Allows the header row to shrink */
    }

    .warning-icon {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
        margin-top: 3px;
        color: var(--muted);
    }

    .warning-icon.critical { color: var(--critical); }
    .warning-icon.high     { color: var(--high); }
    .warning-icon.medium   { color: var(--medium); }
    .warning-icon.low      { color: var(--low); }

    .summary-file {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
        min-width: 0; /* Allows the file container to shrink */
    }

    /* Force the file path text to truncate */
    .summary-file span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
		color: #4EC9B0;
    }

    .file-icon { width: 14px; height: 14px; flex: 0 0 auto; }

    .badge {
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: white;
        flex: 0 0 auto; /* Prevents the badge from shrinking */
    }

    .badge.critical { background-color: var(--critical); }
    .badge.high     { background-color: var(--high); }
    .badge.medium   { background-color: var(--medium); }
    .badge.low      { background-color: var(--low); }

    .issue-title {
        font-weight: 600;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Force the CWE/OWASP meta text to truncate */
    .issue-meta { 
        font-size: 12px; 
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .chevron {
        width: 16px;
        height: 16px;
        flex: 0 0 auto; /* Prevents chevron from shrinking or squishing */
        color: var(--muted);
        transition: transform 0.2s ease;
    }

    details[open] .chevron { transform: rotate(180deg); }

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

    .detail-row.span-2 { grid-column: 1 / -1; }
    .detail-row { display: grid; gap: 6px; }

    .detail-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 600;
    }

    /* Note: Allowing detail values to wrap naturally so they remain readable */
    .detail-value { font-size: 13px; color: var(--text); line-height: 1.4; word-break: break-word; }

    .cta-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
    }

    .action-button,
    .btn-explain {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-decoration: none;
        user-select: none;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        background: var(--button-bg);
        color: var(--button-text);
        cursor: pointer;
        transition: background 0.15s ease, filter 0.15s ease;
    }

    .action-button:hover,
    .btn-explain:hover {
        background: var(--vscode-button-hoverBackground, var(--button-bg));
        filter: brightness(1.08);
    }

    .sparkle-icon {
        width: 14px;
        height: 14px;
        flex: 0 0 auto;
    }

	/* Size and prevent the icon from shrinking */
	.button-icon {
		width: 14px;
		height: 14px;
		flex: 0 0 auto;
	}

    @media (max-width: 560px) {
        body { padding: 12px; }
        .detail-grid { grid-template-columns: 1fr; }
        .cta-row { flex-direction: column; align-items: flex-start; }
        .filter-grid { grid-template-columns: 1fr; }
        /* Removed .summary-row override so the chevron remains horizontally aligned */
    }
`;

// ── Public API ────────────────────────────────────────────────────────

function buildSelectOptions(
	values: string[],
	allLabel: string,
	formatLabel?: (val: string) => string,
): string {
	const all = `<option value="">${escapeHtml(allLabel)}</option>`;
	const options = values.map((value) => {
		const label = formatLabel ? formatLabel(value) : value;
		return `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`;
	});
	return [all, ...options].join('');
}

function buildSeverityChips(): string {
	return SEVERITY_OPTIONS.map((severity) =>
		`<button type="button" class="severity-chip ${severity}" data-severity="${severity}" aria-pressed="false" role="checkbox" aria-checked="false"><span class="severity-check" aria-hidden="true">${CHECK_MARK_SVG}</span><span class="severity-name">${capitalize(severity)}</span></button>`,
	).join('');
}

function buildToolbar(vulns: Vulnerability[]): string {
	if (vulns.length === 0) {
		return '';
	}

	const facets = collectVulnFilterFacets(vulns);

	return /* html */ `
		<div class="toolbar">
			<div class="toolbar-row">
				<button
					class="filter-toggle"
					type="button"
					id="filter-toggle"
					aria-controls="filter-menu"
					aria-expanded="false"
					title="Filter and search vulnerabilities"
					aria-label="Filter and search vulnerabilities"
				>
					${FILTER_SVG}
					<span class="filter-toggle-label">Filter &amp; Search</span>
					<span class="filter-badge" id="filter-badge" hidden>0</span>
				</button>
			</div>
			<div class="filter-menu" id="filter-menu" aria-hidden="true">
				<div class="search-wrap">
					${SEARCH_SVG}
					<input
						class="search-input"
						id="vuln-search"
						type="search"
						placeholder="Search title or file…"
						aria-label="Search vulnerabilities by title or file"
					/>
					<button
						class="search-clear-btn"
						id="search-clear-btn"
						type="button"
						aria-label="Clear search query"
						title="Clear search"
						hidden
					>
						${CLOSE_SVG}
					</button>
				</div>
				<fieldset class="filter-fieldset">
					<legend class="filter-legend">Severity</legend>
					<div class="chip-row" role="group" aria-label="Filter by severity">
						${buildSeverityChips()}
					</div>
				</fieldset>
				<div class="filter-grid">
					<label class="filter-field">
						<span class="filter-label">Category</span>
						<select class="filter-select" id="category-filter" aria-label="Filter by OWASP category">
							${buildSelectOptions(facets.categories, 'All categories', formatCategoryLabel)}
						</select>
					</label>
					<label class="filter-field">
						<span class="filter-label">Type</span>
						<select class="filter-select" id="type-filter" aria-label="Filter by vulnerability type">
							${buildSelectOptions(facets.types, 'All types')}
						</select>
					</label>
				</div>
				<div class="filter-menu-footer">
					<div class="results-meta" id="results-meta" aria-live="polite">Showing ${vulns.length} of ${vulns.length} issues</div>
					<button class="reset-filters" type="button" id="reset-filters-btn" disabled>
						Reset filters
					</button>
				</div>
			</div>
		</div>`;
}

function buildSessionProgressSection(
	vulns: Vulnerability[],
	options: ActiveVulnerabilitiesOptions,
): string {
	const resolvedCount = Math.max(0, options.resolvedCount ?? 0);
	const activeCount = vulns.length;
	const totalSessionIssues = activeCount + resolvedCount;

	if (totalSessionIssues === 0) {
		return '';
	}

	// Victory State: All issues tracked in this session have been resolved
	if (activeCount === 0 && resolvedCount > 0) {
		return /* html */ `
			<section class="session-progress-card victory" aria-label="Session Resolution Progress">
				<div class="progress-info-row">
					<div class="progress-title victory-title">
						<span class="progress-icon">🏆</span>
						<span>All ${resolvedCount} Vulnerabilit${resolvedCount === 1 ? 'y' : 'ies'} Resolved! Workspace is Clean!</span>
					</div>
					<span class="progress-pct">100%</span>
				</div>
				<div class="progress-track">
					<div
						class="progress-bar-fill victory-fill"
						style="width: 100%;"
						role="progressbar"
						aria-valuenow="100"
						aria-valuemin="0"
						aria-valuemax="100"
					></div>
				</div>
			</section>`;
	}

	const pct = Math.min(100, Math.round((resolvedCount / totalSessionIssues) * 100));
	const nextFocus = determineNextFocus(vulns, options.commonVulnTypes);

	const nextFocusHtml = nextFocus
		? /* html */ `
			<div class="next-focus-row">
				<span class="next-focus-label">⚡ Next Focus:</span>
				<button
					class="next-focus-chip"
					type="button"
					data-vuln-key="${encodeURIComponent(buildVulnKey(nextFocus.vuln))}"
					title="Focus ${escapeAttr(nextFocus.vuln.title)} at ${escapeAttr(nextFocus.vuln.filePath)} : Line ${nextFocus.vuln.line}"
					aria-label="Focus ${escapeAttr(nextFocus.vuln.title)}"
				>
					<span class="focus-title">${escapeHtml(nextFocus.vuln.title)}</span>
					<span class="focus-loc">${escapeHtml(nextFocus.vuln.filePath)} : Line ${nextFocus.vuln.line}</span>
					<span class="focus-badge ${nextFocus.isCommonHabit ? 'habit' : nextFocus.vuln.severity}">
						${nextFocus.isCommonHabit ? 'Common Habit' : capitalize(nextFocus.vuln.severity)}
					</span>
					<span class="focus-arrow" aria-hidden="true">→</span>
				</button>
			</div>`
		: '';

	return /* html */ `
		<section class="session-progress-card" aria-label="Session Resolution Progress">
			<div class="progress-info-row">
				<div class="progress-title">
					<span class="progress-icon">🎯</span>
					<span>Session Progress: <strong>${resolvedCount} of ${totalSessionIssues}</strong> Issue${totalSessionIssues === 1 ? '' : 's'} Resolved</span>
				</div>
				<span class="progress-pct">${pct}%</span>
			</div>
			<div class="progress-track">
				<div
					class="progress-bar-fill"
					style="width: ${pct}%;"
					role="progressbar"
					aria-valuenow="${pct}"
					aria-valuemin="0"
					aria-valuemax="100"
				></div>
			</div>
			${nextFocusHtml}
		</section>`;
}

/**
 * Builds the complete HTML document for the Active Vulnerabilities panel.
 *
 * Cards start collapsed on first open. When a workspace is reopened, the
 * previously expanded card is restored via {@link ActiveVulnerabilitiesOptions.expandedKey}.
 */
export function buildActiveVulnerabilitiesHtml(
	vulns: Vulnerability[],
	options: ActiveVulnerabilitiesOptions = {},
): string {
	if (options.loading) {
		return buildStartupLoadingHtml('Ariadne Active Vulnerabilities');
	}
	const signedIn = options.signedIn !== false;
	if (signedIn && options.scannerBroken) {
		return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne Active Vulnerabilities</title>
		<style>${CSS}</style>
	</head>
	<body>
		<section class="empty-state" role="status">
			<div class="empty-title">The current scanner binary is not working</div>
			<div class="empty-subtitle">
				Ariadne could not run the selected scanner, so this panel is not a clean scan.
			</div>
			<a class="signin-cta" href="command:${OPEN_SETTINGS_COMMAND}">Open Ariadne Settings</a>
		</section>
	</body>
</html>`;
	}
	if (!signedIn) {
		return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne Active Vulnerabilities</title>
		<style>${CSS}</style>
	</head>
	<body>
		<section class="signin-state" role="status">
			<p class="signin-title">Sign in required</p>
			<p class="signin-copy">
				GitHub sign-in is needed to scan this workspace and show active
				vulnerabilities.
			</p>
			<a class="signin-cta" href="command:${OPEN_SIGN_IN_COMMAND}">Sign in to Ariadne</a>
		</section>
	</body>
</html>`;
	}

	const expandedKey = options.expandedKey
		? encodeURIComponent(options.expandedKey)
		: undefined;
	const cards = vulns.map((v) => {
		const key = encodeURIComponent(buildVulnKey(v));
		return buildVulnCard(v, key === expandedKey);
	}).join('\n');
	const emptyState = /* html */ `
        <div class="empty-state" role="status" aria-live="polite">
            <div class="empty-title">No active vulnerabilities</div>
            <div class="empty-subtitle">
                You are all clear for this scan cycle.
            </div>
        </div>`;
	const filterEmptyState = /* html */ `
		<div class="filter-empty" id="filter-empty" role="status" aria-live="polite">
			No vulnerabilities match the current search or filters.
		</div>`;

	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne Active Vulnerabilities</title>
		<style>${CSS}</style>
	</head>
	<body>
		<div class="sticky-top-bar">
			<header class="live-scan-header active-vuln-header">
				<div class="live-scan-header-left active-vuln-header-left">
					${LIVE_SCAN_SVG}
					<span>Live Scan</span>
				</div>
				<span class="total-badge" id="total-vuln-badge">${vulns.length} Issue${vulns.length === 1 ? '' : 's'} Total</span>
			</header>
			${buildSessionProgressSection(vulns, options)}
			${buildToolbar(vulns)}
		</div>
		<section class="vuln-stack" id="vuln-stack">
            ${vulns.length === 0 ? emptyState : cards}
		</section>
		${vulns.length === 0 ? '' : filterEmptyState}
		<script>
			(function () {
				const vscode = acquireVsCodeApi();
				const cards = Array.from(document.querySelectorAll('.vuln-card'));
				const searchInput = document.getElementById('vuln-search');
				const searchClearBtn = document.getElementById('search-clear-btn');
				const filterToggle = document.getElementById('filter-toggle');
				const filterMenu = document.getElementById('filter-menu');
				const categoryFilter = document.getElementById('category-filter');
				const typeFilter = document.getElementById('type-filter');
				const severityChips = Array.from(document.querySelectorAll('.severity-chip'));
				const resetBtn = document.getElementById('reset-filters-btn');
				const filterBadge = document.getElementById('filter-badge');
				const resultsMeta = document.getElementById('results-meta');
				const filterEmpty = document.getElementById('filter-empty');
				const stickyTopBar = document.querySelector('.sticky-top-bar');
				const totalCount = cards.length;

				function readUiState() {
					const saved = vscode.getState();
					return saved && typeof saved === 'object' ? saved : {};
				}

				function persistUiState(patch) {
					vscode.setState({ ...readUiState(), ...patch });
				}

				function persistExpandedKey(key) {
					persistUiState({ expandedKey: key ?? null });
					vscode.postMessage({ type: 'vuln-expanded', key: key ?? null });
				}

				function selectedSeverities() {
					return severityChips
						.filter((chip) => chip.getAttribute('aria-pressed') === 'true')
						.map((chip) => chip.dataset.severity);
				}

				function activeFilterCount() {
					let count = 0;
					if ((searchInput?.value ?? '').trim()) count += 1;
					if (selectedSeverities().length) count += 1;
					if (categoryFilter?.value) count += 1;
					if (typeFilter?.value) count += 1;
					return count;
				}

				function syncFilterChrome() {
					const count = activeFilterCount();
					if (filterBadge) {
						filterBadge.hidden = count === 0;
						filterBadge.textContent = String(count);
					}
					if (filterToggle) {
						filterToggle.classList.toggle('has-filters', count > 0);
					}
					if (resetBtn) {
						resetBtn.disabled = count === 0;
					}
					if (searchClearBtn && searchInput) {
						searchClearBtn.hidden = searchInput.value.length === 0;
					}
				}

				function setFilterVisibility(visible, persist = true) {
					filterMenu?.classList.toggle('open', visible);
					filterMenu?.setAttribute('aria-hidden', String(!visible));
					filterToggle?.setAttribute('aria-expanded', String(visible));
					filterToggle?.setAttribute('title', visible ? 'Hide filters' : 'Show filters');
					filterToggle?.setAttribute('aria-label', visible ? 'Hide filters' : 'Show filters');
					if (persist) {
						persistUiState({ filterPanelOpen: visible });
					}
				}

				function applyAccordion(openedEl) {
					cards.forEach((el) => {
						if (el !== openedEl) {
							el.open = false;
						}
					});
					persistExpandedKey(openedEl?.dataset.vulnKey ?? null);
				}

				function cardMatchesFilters(el) {
					const query = (searchInput?.value ?? '').trim().toLowerCase();
					const severities = selectedSeverities();
					const category = categoryFilter?.value ?? '';
					const type = typeFilter?.value ?? '';

					if (severities.length && !severities.includes(el.dataset.severity)) {
						return false;
					}
					if (category && (el.dataset.category ?? '') !== category) {
						return false;
					}
					if (type && el.dataset.type !== type) {
						return false;
					}
					if (query && !(el.dataset.searchText ?? '').includes(query)) {
						return false;
					}
					return true;
				}

				function applyFilters() {
					let visibleCount = 0;
					cards.forEach((el) => {
						const visible = cardMatchesFilters(el);
						el.classList.toggle('hidden', !visible);
						if (visible) {
							visibleCount += 1;
						}
					});

					if (resultsMeta) {
						resultsMeta.textContent = visibleCount === totalCount
							? 'Showing ' + totalCount + ' of ' + totalCount + ' issues'
							: 'Showing ' + visibleCount + ' of ' + totalCount + ' issues';
					}

					const totalVulnBadge = document.getElementById('total-vuln-badge');
					if (totalVulnBadge) {
						totalVulnBadge.textContent = visibleCount === totalCount
							? totalCount + ' Issue' + (totalCount === 1 ? '' : 's') + ' Total'
							: 'Showing ' + visibleCount + ' of ' + totalCount + ' Issues';
					}

					if (filterEmpty) {
						filterEmpty.classList.toggle('visible', totalCount > 0 && visibleCount === 0);
					}
					syncFilterChrome();
				}

				function persistFilters() {
					persistUiState({
						searchQuery: searchInput?.value ?? '',
						severityFilters: selectedSeverities(),
						categoryFilter: categoryFilter?.value ?? '',
						typeFilter: typeFilter?.value ?? '',
					});
				}

				function resetFilters() {
					if (searchInput) {
						searchInput.value = '';
					}
					severityChips.forEach((chip) => {
						chip.setAttribute('aria-pressed', 'false');
						chip.setAttribute('aria-checked', 'false');
					});
					if (categoryFilter) categoryFilter.value = '';
					if (typeFilter) typeFilter.value = '';
					persistFilters();
					applyFilters();
				}

				function restoreUiState() {
					const state = readUiState();
					setFilterVisibility(state.filterPanelOpen === true, false);

					if (searchInput && typeof state.searchQuery === 'string') {
						searchInput.value = state.searchQuery;
					}

					const savedSeverities = Array.isArray(state.severityFilters)
						? state.severityFilters
						: (typeof state.severityFilter === 'string' && state.severityFilter
							? [state.severityFilter]
							: []);
					severityChips.forEach((chip) => {
						const isSelected = savedSeverities.includes(chip.dataset.severity);
						chip.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
						chip.setAttribute('aria-checked', isSelected ? 'true' : 'false');
					});

					if (categoryFilter && typeof state.categoryFilter === 'string') {
						categoryFilter.value = state.categoryFilter;
					}
					if (typeFilter && typeof state.typeFilter === 'string') {
						typeFilter.value = state.typeFilter;
					}

					applyFilters();

					if (typeof state.scrollTop === 'number' && state.scrollTop > 0) {
						requestAnimationFrame(() => {
							window.scrollTo(0, state.scrollTop);
							updateScrollState();
						});
					}
				}

				function updateScrollState() {
					if (stickyTopBar) {
						stickyTopBar.classList.toggle('is-scrolled', window.scrollY > 2);
					}
				}

				function snapshotUiState() {
					persistUiState({
						scrollTop: window.scrollY,
						searchQuery: searchInput?.value ?? '',
						severityFilters: selectedSeverities(),
						categoryFilter: categoryFilter?.value ?? '',
						typeFilter: typeFilter?.value ?? '',
					});
				}

				window.addEventListener(
					'scroll',
					() => {
						updateScrollState();
						persistUiState({ scrollTop: window.scrollY });
					},
					{ passive: true },
				);

				filterToggle?.addEventListener('click', () => {
					setFilterVisibility(!filterMenu?.classList.contains('open'));
				});

				cards.forEach((el) => {
					el.addEventListener('toggle', () => {
						if (el.open) {
							applyAccordion(el);
							return;
						}
						if (!cards.some((card) => card.open)) {
							persistExpandedKey(null);
						}
					});
				});

				searchInput?.addEventListener('input', () => {
					persistFilters();
					applyFilters();
				});
				[categoryFilter, typeFilter].forEach((el) => {
					el?.addEventListener('change', () => {
						persistFilters();
						applyFilters();
					});
				});
				severityChips.forEach((chip) => {
					chip.addEventListener('click', () => {
						const pressed = chip.getAttribute('aria-pressed') === 'true';
						const nextState = pressed ? 'false' : 'true';
						chip.setAttribute('aria-pressed', nextState);
						chip.setAttribute('aria-checked', nextState);
						persistFilters();
						applyFilters();
					});
				});
				resetBtn?.addEventListener('click', resetFilters);
				searchClearBtn?.addEventListener('click', () => {
					if (searchInput) {
						searchInput.value = '';
						searchInput.focus();
						persistFilters();
						applyFilters();
					}
				});

				document.querySelectorAll('.next-focus-chip').forEach((chip) => {
					chip.addEventListener('click', () => {
						const rawKey = chip.getAttribute('data-vuln-key');
						if (!rawKey) return;
						const decodedKey = decodeURIComponent(rawKey);

						const targetCard = cards.find((c) => {
							const cardKey = c.getAttribute('data-vuln-key');
							return cardKey === rawKey || decodeURIComponent(cardKey || '') === decodedKey;
						});

						if (targetCard) {
							if (targetCard.classList.contains('hidden') || targetCard.style.display === 'none') {
								if (resetBtn && !resetBtn.disabled) {
									resetBtn.click();
								}
							}
							targetCard.open = true;
							applyAccordion(targetCard);
							persistExpandedKey(decodedKey);
							targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
							targetCard.classList.remove('highlight-pulse');
							void targetCard.offsetWidth;
							targetCard.classList.add('highlight-pulse');
							setTimeout(() => targetCard.classList.remove('highlight-pulse'), 1800);
						}
					});
				});

				document.addEventListener(
					'click',
					(e) => {
						const link = e.target.closest('.goto-location');
						if (!link) return;
						e.preventDefault();
						e.stopPropagation();
						snapshotUiState();
						vscode.postMessage({
							type: 'goto-line',
							filePath: link.dataset.file,
							line: Number(link.dataset.line),
						});
					},
					true,
				);

				restoreUiState();
				if (totalCount > 0) {
					applyFilters();
				}

				// Cross-filtering message listener from Session Metrics or external commands
				window.addEventListener('message', (event) => {
					const msg = event.data;
					if (!msg || typeof msg !== 'object') return;
					if (msg.type === 'set-filter-severity') {
						const targetSeverity = String(msg.severity || '').toLowerCase();
						const currentSelected = selectedSeverities();
						const isAlreadyActive =
							currentSelected.length === 1 &&
							currentSelected[0] === targetSeverity &&
							!(searchInput?.value ?? '').trim() &&
							!categoryFilter?.value &&
							!typeFilter?.value;

						if (isAlreadyActive) {
							resetFilters();
							return;
						}

						if (searchInput) searchInput.value = '';
						if (categoryFilter) categoryFilter.value = '';
						if (typeFilter) typeFilter.value = '';
						severityChips.forEach((chip) => {
							const matches = chip.dataset.severity === targetSeverity;
							chip.setAttribute('aria-pressed', matches ? 'true' : 'false');
							chip.setAttribute('aria-checked', matches ? 'true' : 'false');
						});
						setFilterVisibility(true);
						persistFilters();
						applyFilters();
					} else if (msg.type === 'set-filter-type') {
						const targetType = String(msg.vulnType || '').trim();
						const currentSelected = selectedSeverities();
						const isAlreadyActiveInSelect =
							Boolean(typeFilter?.value) &&
							typeFilter.value.toLowerCase() === targetType.toLowerCase() &&
							currentSelected.length === 0 &&
							!(searchInput?.value ?? '').trim() &&
							!categoryFilter?.value;
						const isAlreadyActiveInSearch =
							Boolean((searchInput?.value ?? '').trim()) &&
							searchInput.value.toLowerCase() === targetType.toLowerCase() &&
							currentSelected.length === 0 &&
							!typeFilter?.value &&
							!categoryFilter?.value;

						if (isAlreadyActiveInSelect || isAlreadyActiveInSearch) {
							resetFilters();
							return;
						}

						if (searchInput) searchInput.value = '';
						severityChips.forEach((chip) => {
							chip.setAttribute('aria-pressed', 'false');
							chip.setAttribute('aria-checked', 'false');
						});
						if (categoryFilter) categoryFilter.value = '';
						if (typeFilter) {
							const option = Array.from(typeFilter.options).find(
								(opt) => opt.value.toLowerCase() === targetType.toLowerCase(),
							);
							if (option) {
								typeFilter.value = option.value;
							} else {
								typeFilter.value = '';
								if (searchInput) searchInput.value = targetType;
							}
						} else if (searchInput) {
							searchInput.value = targetType;
						}
						setFilterVisibility(true);
						persistFilters();
						applyFilters();
					}
				});
			})();
		</script>
	</body>
</html>`;
}
