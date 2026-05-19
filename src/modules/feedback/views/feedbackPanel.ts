import type { FeedbackFinding } from '../mock/types.js';

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function severityLabel(severity: FeedbackFinding['severity']): string {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function section(number: number, title: string, body: string): string {
	const numberClass = number === 1 ? 'critical' : number === 2 ? 'high' : number === 3 ? 'medium' : '';
    return /* html */ `
        <section class="info-section">
            <div class="section-heading">
                <span class="section-number ${numberClass}">${number}</span>
                <span class="section-title">${escapeHtml(title)}</span>
            </div>
            <div class="section-box">${body}</div>
        </section>`;
}

export function buildFeedbackPanelHtml(finding: FeedbackFinding): string {
    const title = escapeHtml(finding.type);
    const severity = escapeHtml(severityLabel(finding.severity));
    const severityClass = finding.severity;

    // The warning SVG for the header box
    const WARNING_SVG = `
        <svg class="header-warning-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.72L8 2.28zM7.5 5.5h1v4h-1v-4zm.5 6a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
        </svg>`;

    return /* html */ `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ariadne: Explanation</title>
        <style>
            :root {
                color-scheme: dark;
                --bg: var(--vscode-editor-background);
                --panel: color-mix(in srgb, var(--vscode-editor-background) 70%, black);
                --panel-2: var(--vscode-editorWidget-background);
                --border: var(--vscode-panel-border);
                --text: var(--vscode-foreground);
                --muted: var(--vscode-descriptionForeground);
                --critical: #E24B4A;
        		--high: #BA7517;
        		--medium: #227AD0;
        		--low: #5CA221;
                --code-bg: var(--vscode-textCodeBlock-background);
                
                /* Text Colors from your image */
                --section-blue: var(--vscode-textLink-foreground);
                --section-orange: #d19a66;
                --file-green: #4EC9B0;
            }

            * { box-sizing: border-box; }

            body {
                margin: 0;
                background: var(--bg);
                color: var(--text);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .panel {
                max-width: 980px;
                margin: 0 auto;
                padding: 24px 2px 28px;
            }

            /* --- HEADER LAYOUT --- */
            .header {
                display: flex;
                gap: 16px;
                align-items: center;
                padding-bottom: 24px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 24px;
            }

            .header-icon-box {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 56px;
                height: 56px;
                border: 1px solid var(--critical);
                border-radius: 6px;
                background: color-mix(in srgb, var(--critical) 10%, transparent);
                color: var(--critical);
                flex: 0 0 auto;
            }

            .header-icon-box.high {
                border-color: var(--high);
                background: color-mix(in srgb, var(--high) 10%, transparent);
                color: var(--high);
            }

            .header-icon-box.medium {
                border-color: var(--medium);
                background: color-mix(in srgb, var(--medium) 10%, transparent);
                color: var(--medium);
            }

            .header-icon-box.low {
                border-color: var(--low);
                background: color-mix(in srgb, var(--low) 10%, transparent);
                color: var(--low);
            }

            .header-warning-icon {
                width: 32px;
                height: 32px;
            }

            .header-content {
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-width: 0; /* Important for flex children containing text */
            }

            .header-content h1 {
                margin: 0;
                font-size: 26px;
                font-weight: 600;
                letter-spacing: -0.01em;
                line-height: 1;
                /* Handle long titles */
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .header-sub {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 13px;
                
                /* --- FIX: Force items side-by-side --- */
                flex-wrap: nowrap; /* Do not wrap to next line */
                overflow-x: auto;  /* Allow horizontal scroll if squeezed */
                
                /* Hide scrollbar but keep functionality (optional, standard VS Code look) */
                -ms-overflow-style: none;  /* IE and Edge */
                scrollbar-width: none;  /* Firefox */
            }
            .header-sub::-webkit-scrollbar {
                display: none; /* Chrome, Safari and Opera */
            }

            /* Ensure children don't shrink inside nowrap container */
            .header-sub > span {
                flex: 0 0 auto;
                white-space: nowrap;
            }

            .severity-pill {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 4px 12px;
                border-radius: 999px;
                background: var(--critical);
                color: white;
                font-size: 12px;
                font-weight: 600;
            }

            .severity-pill.high { background: var(--high); }
            .severity-pill.medium { background: var(--medium); }
            .severity-pill.low { background: var(--low); }

            .meta-cwe { color: var(--section-orange); }
            .meta-dot { color: var(--muted); }
            .meta-file { color: var(--file-green); }

            /* --- BODY SECTIONS --- */
            .content {
                display: grid;
                gap: 28px;
            }

            .section-heading {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }

            .section-number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 1px solid var(--section-orange);
                font-size: 12px;
                font-weight: 600;
                color: var(--section-orange);
            }

            .section-number.critical { color: var(--critical); border-color: var(--critical); background: color-mix(in srgb, var(--critical) 10%, transparent);}
            .section-number.high { color: var(--high); border-color: var(--high); background: color-mix(in srgb, var(--high) 10%, transparent); }
            .section-number.medium { color: var(--medium); border-color: var(--medium); background: color-mix(in srgb, var(--medium) 10%, transparent); }

            .section-title {
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0.02em;
                text-transform: uppercase;
                color: var(--muted);
            }

            .section-box {
                background: var(--panel);
                border-left: 4px solid var(--border);
                padding: 16px 20px;
                line-height: 1.6;
                font-size: 14px;
                color: var(--text);
                border-radius: 4px;
            }

            .section-box p {
                margin: 0 0 10px 0;
            }
            
            .section-box p:last-child {
                margin: 0;
            }

            .section-box code {
                background: var(--code-bg);
                padding: 2px 6px;
                border-radius: 4px;
                color: var(--section-orange);
                font-family: Consolas, "Courier New", monospace;
                font-size: 0.95em;
            }

            .footer {
                padding-top: 14px;
                margin-top: 32px;
                border-top: 1px solid var(--border);
                font-size: 13px;
                color: var(--muted);
            }

            @media (max-width: 700px) {
                .panel { padding: 18px 14px 22px; }
                /* We keep header flex-direction: row to maintain the side-by-side look of icon and content */
                .header-content h1 { font-size: 22px; }
            }
        </style>
    </head>
    <body>
        <div class="panel">
            <header class="header">
                <div class="header-icon-box ${severityClass}">
                    ${WARNING_SVG}
                </div>
                <div class="header-content">
                    <h1>${title}</h1>
                    <div class="header-sub">
                        <span class="severity-pill ${severityClass}">${severity}</span>
                        <span class="meta-cwe">${escapeHtml(finding.cwe)} &middot; ${escapeHtml(finding.owasp)}</span>
                        <span class="meta-dot">&middot;</span>
                        <span class="meta-file">${escapeHtml(finding.path)}:${finding.line}</span>
                    </div>
                </div>
            </header>

            <main class="content">
                ${section(1, 'What is this vulnerability?', `<p>Type: <strong>${title}</strong></p><p>${escapeHtml(finding.vulnerability)}</p>`) }
                ${section(2, 'Why is it dangerous?', `<p>${escapeHtml(finding.impact)}</p>`) }
                ${section(3, 'Where should you look?', `<p>${escapeHtml(finding.suggestion)}</p><p>Review <code>${escapeHtml(finding.path)}</code> at line <code>${finding.line}</code> and replace unsafe concatenation with a secure, parameterized approach.</p>`) }
            </main>

            <div class="footer">
                Ariadne provides conceptual guidance on security vulnerabilities. Always conduct thorough code review and testing to validate findings in your specific context.
            </div>
        </div>
    </body>
</html>`;
}