import type { VulnerabilityMetadata } from '../types.js';

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function severityLabel(severity: VulnerabilityMetadata['severity']): string {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
}

/**
 * Builds the feedback panel HTML with a loading state.
 *
 * The panel opens immediately with the vulnerability header and animated
 * skeleton placeholders for the 3 sections. The extension host then sends
 * a postMessage with { type: 'llm-result', sections } or { type: 'llm-error', message }
 * to populate or show the fallback.
 */
export function buildFeedbackPanelHtml(meta: VulnerabilityMetadata): string {
    const title = escapeHtml(meta.type);
    const severity = escapeHtml(severityLabel(meta.severity));
    const severityClass = meta.severity;
    const cweDisplay = escapeHtml(meta.cwe_id);
    const owaspDisplay = escapeHtml(meta.owasp_category);
    const filePath = escapeHtml(meta.file_path);
    const line = meta.line_number;

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
                padding: 24px 0px 28px 0px;
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
                white-space: normal;
                word-break: break-word;
            }

            .header-sub {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 13px;
                flex-wrap: wrap;
            }

            /* Ensure children don't shrink inside nowrap container */
            .header-sub > span {
                flex: 0 0 auto;
                white-space: normal;
                word-break: break-word;
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

            .meta-cwe { font-weight: 600px; color: var(--section-orange); }
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
                
                flex-shrink: 0; 
                
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

            /* --- SKELETON LOADING ANIMATION --- */
            .skeleton-line {
                height: 14px;
                background: linear-gradient(
                    90deg,
                    color-mix(in srgb, var(--text) 8%, transparent) 25%,
                    color-mix(in srgb, var(--text) 16%, transparent) 50%,
                    color-mix(in srgb, var(--text) 8%, transparent) 75%
                );
                background-size: 200% 100%;
                animation: skeleton-shimmer 1.5s ease-in-out infinite;
                border-radius: 4px;
                margin-bottom: 8px;
            }
            .skeleton-line:last-child { margin-bottom: 0; }
            .skeleton-line.short { width: 60%; }
            .skeleton-line.medium { width: 80%; }

            @keyframes skeleton-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            /* --- ERROR STATE --- */
            .error-box {
                background: color-mix(in srgb, var(--critical) 8%, transparent);
                border: 1px solid color-mix(in srgb, var(--critical) 30%, transparent);
                border-radius: 6px;
                padding: 16px 20px;
                color: var(--text);
                font-size: 14px;
                line-height: 1.6;
                display: none;
            }

            .error-box.visible { display: block; }

            .footer {
                padding-top: 14px;
                margin-top: 32px;
                border-top: 1px solid var(--border);
                font-size: 13px;
                color: var(--muted);
            }

            @media (max-width: 350px) {
                .panel { padding: 18px 0px 22px 0px; }
                .header-icon-box { display: none; }
                /* We keep header flex-direction: row to maintain the side-by-side look of icon and content */
                
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
                    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">${title}</h1>
                    <div class="header-sub">
                        <span class="severity-pill ${severityClass}">${severity}</span>
                        <span class="meta-cwe">${cweDisplay} &middot; ${owaspDisplay}</span>
                        <span class="meta-dot">&middot;</span>
                        <span class="meta-file">${filePath}:${line}</span>
                    </div>
                </div>
            </header>

            <!-- Error state (hidden by default) -->
            <div id="error-box" class="error-box">
                <p id="error-message"></p>
            </div>

            <main id="sections-container" class="content">
                <!-- Section 1: What is this vulnerability? -->
                <section class="info-section" id="section-1">
                    <div class="section-heading">
                        <span class="section-number critical">1</span>
                        <span class="section-title">What is this vulnerability?</span>
                    </div>
                    <div class="section-box" id="section-1-body">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                </section>

                <!-- Section 2: Why is it dangerous? -->
                <section class="info-section" id="section-2">
                    <div class="section-heading">
                        <span class="section-number high">2</span>
                        <span class="section-title">Why is it dangerous?</span>
                    </div>
                    <div class="section-box" id="section-2-body">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                </section>

                <!-- Section 3: Where should you look? -->
                <section class="info-section" id="section-3">
                    <div class="section-heading">
                        <span class="section-number medium">3</span>
                        <span class="section-title">Where should you look?</span>
                    </div>
                    <div class="section-box" id="section-3-body">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line medium"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                </section>
            </main>

            <div class="footer">
                Ariadne provides conceptual guidance only. Always conduct thorough code review and testing to validate findings in your specific context.
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function escapeHtml(str) {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            }

            window.addEventListener('message', (event) => {
                const msg = event.data;

                if (msg.type === 'llm-result') {
                    // Populate the 3 sections from the FeedbackFinding
                    const f = msg.finding;
                    document.getElementById('section-1-body').innerHTML = '<p>' + escapeHtml(f.vulnerability) + '</p>';
                    document.getElementById('section-2-body').innerHTML = '<p>' + escapeHtml(f.impact) + '</p>';
                    document.getElementById('section-3-body').innerHTML = '<p>' + escapeHtml(f.suggestion) + '</p>';
                }

                if (msg.type === 'llm-error') {
                    // Hide sections and show error
                    document.getElementById('sections-container').style.display = 'none';
                    const errorBox = document.getElementById('error-box');
                    errorBox.classList.add('visible');
                    document.getElementById('error-message').textContent = msg.message;
                }
            });
        </script>
    </body>
</html>`;
}