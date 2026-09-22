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

const OPEN_FEEDBACK_COMMAND = 'ariadne-extension-vscode.openFeedbackPanel';
const OPEN_SIGN_IN_COMMAND = 'ariadne-extension-vscode.openSignInPanel';

const SEVERITY_OPTIONS: Severity[] = ['critical', 'high', 'medium', 'low'];

export interface ActiveVulnerabilitiesOptions {
	/** Vulnerability key to render expanded when reopening a workspace. */
	expandedKey?: string;
	/** When false, the panel asks the user to sign in instead of showing findings. */
	signedIn?: boolean;
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

// ── Card builder ──────────────────────────────────────────────────────

function buildVulnCard(vuln: Vulnerability, expanded: boolean): string {
	const meta = buildMeta(vuln);
	const label = capitalize(vuln.severity);
	const location = `${vuln.filePath} : Line ${vuln.line}`;
	const openAttr = expanded ? ' open' : '';
	const commandArgs = encodeURIComponent(JSON.stringify([vuln.cwe, vuln.title]));
	const feedbackHref = `command:${OPEN_FEEDBACK_COMMAND}?${commandArgs}`;
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
                    <a class="action-button" role="button" href="${feedbackHref}">
						<span>Ask Ariadne</span>
						<svg class="button-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
							<path fill-rule="evenodd" clip-rule="evenodd" d="M10.072 8l-4.357-4.357.618-.62L11 7.69v.62L6.333 13l-.618-.619L10.072 8z"/>
						</svg>
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
        padding: 14px 16px 18px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--bg);
        color: var(--text);
    }

    .vuln-stack { display: grid; gap: 12px; }

    .toolbar {
        display: grid;
        gap: 8px;
        margin-bottom: 12px;
        position: sticky;
        top: 0;
        z-index: 2;
        padding-bottom: 8px;
        background: var(--bg);
    }

    .toolbar-row {
        display: grid;
        gap: 8px;
		grid-template-columns: minmax(0, 1fr) auto;
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
		display: inline-grid;
		place-items: center;
		width: 32px;
		min-width: 32px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--vscode-button-secondaryBackground, var(--card));
		color: var(--vscode-button-secondaryForeground, var(--text));
		cursor: pointer;
		transition: background 0.15s ease-out, border-color 0.15s ease-out;
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
		width: 16px;
		height: 16px;
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
		justify-content: flex-end;
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

    .action-button {
    /* New Flexbox properties to align the text and icon */
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    user-select: none;
    
    /* Your existing properties */
		border: none;
		border-radius: 3px;
		padding: 8px 14px;
		font-size: 12px;
		font-weight: 600;
		background: var(--button-bg);
		color: var(--button-text);
        opacity: 1;
        cursor: pointer;
        transition: filter 0.15s ease, opacity 0.15s ease;
	}

    .action-button:hover {
        filter: brightness(1.08);
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
				<button
					class="filter-toggle"
					type="button"
					id="filter-toggle"
					aria-controls="filter-menu"
					aria-expanded="false"
					title="Show filters"
					aria-label="Show filters"
				>
					${FILTER_SVG}
					<span class="filter-badge" id="filter-badge" hidden>0</span>
				</button>
			</div>
			<div class="filter-menu" id="filter-menu" aria-hidden="true">
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
					<button class="reset-filters" type="button" id="reset-filters-btn" disabled>
						Reset filters
					</button>
				</div>
			</div>
			<div class="results-meta" id="results-meta" aria-live="polite">Live scan • ${vulns.length} vulnerabilit${vulns.length === 1 ? 'y' : 'ies'}</div>
		</div>`;
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
	const signedIn = options.signedIn !== false;
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
		${buildToolbar(vulns)}
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
							? 'Live scan • ' + totalCount + ' vulnerabilit' + (totalCount === 1 ? 'y' : 'ies')
							: 'Live scan • Showing ' + visibleCount + ' of ' + totalCount;
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
						});
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
			})();
		</script>
	</body>
</html>`;
}
