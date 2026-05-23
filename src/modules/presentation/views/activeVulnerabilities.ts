/**
 * View builder for the Active Vulnerabilities panel.
 *
 * This is a pure function: given an array of Vulnerability objects it
 * returns a complete HTML string ready to be stamped into a webview.
 * It contains zero data — all data flows in from the caller.
 */

import { Vulnerability, Severity } from '../panelTypes.js';

const OPEN_FEEDBACK_COMMAND = 'ariadne-extension-vscode.openFeedbackPanel';

// ── Helpers ──────────────────────────────────────────────────────────

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildMeta(vuln: Vulnerability): string {
	return vuln.owaspRef ? `${vuln.cwe} · ${vuln.owaspRef}` : vuln.cwe;
}

function severityColor(severity: Severity): string {
	const map: Record<Severity, string> = {
		critical: 'var(--critical)',
		high: 'var(--high)',
		medium: 'var(--medium)',
		low: 'var(--low)',
	};
	return map[severity];
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

// ── Card builder ──────────────────────────────────────────────────────

function buildVulnCard(vuln: Vulnerability, isFirst: boolean): string {
	const meta = buildMeta(vuln);
	const label = capitalize(vuln.severity);
	const location = `${vuln.filePath} : Line ${vuln.line}`;
	const openAttr = isFirst ? ' open' : '';
    const commandArgs = encodeURIComponent(JSON.stringify([vuln.cwe, vuln.title]));
    const feedbackHref = `command:${OPEN_FEEDBACK_COMMAND}?${commandArgs}`;

	return /* html */ `
		<details${openAttr}>
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
						<a class="detail-value file goto-location"
						   href="#" role="link"
						   data-file="${vuln.filePath}"
						   data-line="${vuln.line}"
						   title="Open ${vuln.filePath} at line ${vuln.line}">
							${FILE_SVG}
							<span>${location}</span>
						</a>
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
        --border: var(--vscode-panel-border);
        --text: var(--vscode-foreground);
        --muted: var(--vscode-descriptionForeground);
        --critical: #E24B4A;
        --high: #BA7517;
        --medium: #227AD0;
        --low: #5CA221;
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

	a.goto-location {
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
	}

	a.goto-location:hover {
		background: color-mix(in srgb, var(--file) 15%, transparent);
		text-decoration: underline;
	}

	a.goto-location .file-icon {
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
        /* Removed .summary-row override so the chevron remains horizontally aligned */
    }
`;

// ── Public API ────────────────────────────────────────────────────────

/**
 * Builds the complete HTML document for the Active Vulnerabilities panel.
 *
 * @param vulns - Vulnerability findings from the current scan session.
 *   The first item in the array is rendered expanded by default.
 * @returns A complete HTML string ready to be set on a VS Code webview.
 */
export function buildActiveVulnerabilitiesHtml(vulns: Vulnerability[]): string {
    const cards = vulns.map((v, i) => buildVulnCard(v, i === 0)).join('\n');
    const emptyState = /* html */ `
        <div class="empty-state" role="status" aria-live="polite">
            <div class="empty-title">No active vulnerabilities</div>
            <div class="empty-subtitle">
                You are all clear for this scan cycle.
            </div>
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
		<section class="vuln-stack">
            ${vulns.length === 0 ? emptyState : cards}
		</section>
		<script>
			(function () {
				const vscode = acquireVsCodeApi();
				document.addEventListener('click', (e) => {
					const link = e.target.closest('.goto-location');
					if (!link) return;
					e.preventDefault();
					vscode.postMessage({
						type: 'goto-line',
						filePath: link.dataset.file,
						line: Number(link.dataset.line),
					});
				});
			})();
		</script>
	</body>
</html>`;
}
