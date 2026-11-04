import type { VulnerabilityMetadata } from '../vulnerability_results/vulnerabilityTypes.js';
import { severityCssVars } from '../../presentation/severityColors.js';
import * as vscode from 'vscode';

/**
 * Union type representing the three possible states of the feedback panel.
 * Used for postMessage communication between extension host and WebView.
 */
export type FeedbackPanelState =
	| { type: 'loading' }
	| { type: 'llm-result'; html: string }
	| { type: 'llm-error'; message: string };


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
 * Formats a file path for display in the feedback panel header.
 * Shortens deeply nested or absolute paths to a readable compact form (e.g. ".../controller/LandlordController.java")
 * while preserving the immediate directory context and filename.
 */
export function formatDisplayPath(filePath: string): string {
    if (!filePath) {
        return '';
    }
    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);

    // Strip Windows drive letter (e.g. 'c:') and current directory references ('.')
    const cleanSegments = segments.filter(seg => seg !== '.' && !/^[a-zA-Z]:$/.test(seg));

    if (cleanSegments.length <= 2) {
        return cleanSegments.join('/');
    }

    // For paths with 3 or more segments, show ".../<parent>/<filename>"
	return `.../${cleanSegments.slice(-2).join('/')}`;
}

function snippetFontVars(): string {
	const editor = vscode.workspace.getConfiguration('editor');
	const fontSize = editor.get<number>('fontSize') ?? 13;
	const configuredLine = editor.get<number>('lineHeight') ?? 0;
	const lineHeight = configuredLine > 0 ? configuredLine : Math.round(fontSize * 1.35);
	const fontFamily = (editor.get<string>('fontFamily') || 'monospace').replace(/[;{}<>]/g, '');
	return `--snippet-font-family:${fontFamily};--snippet-font-size:${fontSize}px;--snippet-line-height:${lineHeight}px;`;
}

/**
 * Builds the feedback panel HTML with a loading state.
 *
 * The panel opens immediately with the vulnerability header and animated
 * skeleton placeholders for the 3 sections. The extension host then sends
 * a postMessage with { type: 'llm-result', html } or { type: 'llm-error', message }
 * to populate or show the fallback.
 */
/** Identity of one explanation request. The opened tab keeps this artifact. */
export interface AskAriadneArtifact {
	cwe: string;
	title: string;
	filePath: string;
	line: number;
}

export function askAriadneCommandQuery(artifact: AskAriadneArtifact): string {
	return encodeURIComponent(JSON.stringify([artifact]));
}

export function askAriadneRequestId(artifact: AskAriadneArtifact): string {
	return `${artifact.cwe}|${artifact.filePath}|${artifact.line}|${artifact.title}`;
}

export function buildFeedbackPanelHtml(meta: VulnerabilityMetadata, requestId = ''): string {
    const title = escapeHtml(meta.type);
    const severity = escapeHtml(severityLabel(meta.severity));
    const severityClass = meta.severity;
    const cweDisplay = escapeHtml(meta.cwe_id);
    const owaspDisplay = escapeHtml(meta.owasp_category);
    const fullFilePath = escapeHtml(meta.file_path);
    const displayFilePath = escapeHtml(formatDisplayPath(meta.file_path));
    const line = meta.line_number;
    const snippetFont = snippetFontVars();

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
        <title>Explain Vulnerability</title>
        <style>
            :root {
                color-scheme: dark;
                --bg: var(--vscode-editor-background);
                --panel: color-mix(in srgb, var(--vscode-editor-background) 70%, black);
                --panel-2: var(--vscode-editorWidget-background);
                --border: var(--vscode-panel-border);
                --text: var(--vscode-foreground);
                --muted: var(--vscode-descriptionForeground);
                ${severityCssVars()}
                --code-bg: var(--vscode-textCodeBlock-background);
                
                /* Text Colors from your image */
                --section-blue: var(--vscode-textLink-foreground);
                --section-orange: #d19a66;
                --file-green: #4EC9B0;
                ${snippetFont}
            }

            * { box-sizing: border-box; }

            body {
                margin: 0;
                background: var(--bg);
                color: var(--text);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                overflow-x: hidden;
            }

            .panel {
                padding: 24px 0px 28px 0px;
                width: 100%;
                min-width: 0;
                max-width: 100%;
                box-sizing: border-box;
            }

            /* --- HEADER LAYOUT --- */
            .header {
                display: flex;
                gap: 16px;
                align-items: center;
                padding-bottom: 24px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 24px;
                min-width: 0;
                max-width: 100%;
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
                flex: 1 1 auto;
                max-width: 100%;
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
                min-width: 0;
                max-width: 100%;
            }

            /* Ensure children don't shrink inside nowrap container */
            .header-sub > span {
                flex: 0 0 auto;
                white-space: normal;
                word-break: break-word;
            }

            .header-sub > span.meta-file {
                flex: 0 1 auto;
                min-width: 0;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
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

            .meta-cwe { font-weight: 600px; color: var(--section-orange); }
            .meta-dot { color: var(--muted); }
            .meta-file {
                color: var(--file-green);
                cursor: default;
            }

            /* --- BODY SECTIONS --- */
            .content {
                display: flex;
                flex-direction: column;
                gap: 20px;
                width: 100%;
                min-width: 0;
                max-width: 100%;
            }

            .lead {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.45;
                overflow-wrap: anywhere;
            }

            .explain-block {
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-width: 0;
                max-width: 100%;
            }

            .explain-block h2 {
                margin: 0;
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: var(--muted);
            }

            .explain-block p,
            .explain-block li {
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
                overflow-wrap: anywhere;
                word-break: break-word;
            }

            .explain-block ul {
                margin: 0;
                padding-left: 1.2em;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .caption,
            .note {
                color: var(--muted);
                font-size: 13px;
            }

            .code {
                margin: 0;
                padding: 4px 0;
                max-width: 100%;
                overflow-x: auto;
                overflow-y: hidden;
                overscroll-behavior: contain;
                border-radius: 4px;
                border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground, var(--vscode-foreground));
                font-family: var(--snippet-font-family, var(--vscode-editor-font-family, monospace));
                font-size: var(--snippet-font-size, var(--vscode-editor-font-size, 13px));
                line-height: var(--snippet-line-height, 1.35);
            }

            .code-line {
                display: flex;
                align-items: center;
                width: max-content;
                min-width: 100%;
                min-height: var(--snippet-line-height, 1.35em);
            }

            .code-line.mark {
                background: var(--vscode-editor-lineHighlightBackground);
            }

            .ln {
                flex: none;
                width: 4em;
                padding: 0 12px 0 6px;
                text-align: right;
                color: var(--vscode-editorLineNumber-foreground, var(--vscode-descriptionForeground));
                user-select: none;
            }

            .src {
                flex: none;
                white-space: pre;
                color: var(--vscode-editor-foreground, var(--vscode-foreground));
                user-select: text;
            }

            .src::selection,
            .src *::selection {
                background: var(--vscode-editor-selectionBackground);
                color: var(--vscode-editor-selectionForeground, inherit);
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
            .skeleton-code {
                height: 92px;
                border-radius: 4px;
                border: 1px solid var(--border);
                background: color-mix(in srgb, var(--text) 6%, transparent);
            }

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
                width: 100%;
                min-width: 0;
                max-width: 100%;
                box-sizing: border-box;
                overflow-wrap: anywhere;
                word-break: break-word;
            }

            .error-box.visible { display: block; }

            .footer {
                padding-top: 14px;
                margin-top: 32px;
                border-top: 1px solid var(--border);
                font-size: 13px;
                color: var(--muted);
                width: 100%;
                min-width: 0;
                max-width: 100%;
                overflow-wrap: anywhere;
                word-break: break-word;
            }

            @media (max-width: 350px) {
                .panel { padding: 18px 0px 22px 0px; }
                .header-icon-box { display: none; }
                /* We keep header flex-direction: row to maintain the side-by-side look of icon and content */
                
            }
        </style>
    </head>
    <body data-request-id="${escapeHtml(requestId)}">
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
                        <span class="meta-file" title="${fullFilePath}:${line}">${displayFilePath}:${line}</span>
                    </div>
                </div>
            </header>

            <!-- Error state (hidden by default) -->
            <div id="error-box" class="error-box">
                <p id="error-message"></p>
            </div>

            <main id="explanation" class="content">
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-code"></div>
            </main>

            <div class="footer">
                The examples are patterns to study, not a patch for your file. Check the questions against your own code before you change it.
            </div>
        </div>

        <script>
            const requestId = document.body.dataset.requestId || '';

            window.addEventListener('message', (event) => {
                const msg = event.data;
                if (requestId && msg.requestId !== requestId) {
                    return;
                }

                if (msg.type === 'llm-result' && typeof msg.html === 'string') {
                    document.getElementById('explanation').innerHTML = msg.html;
                }

                if (msg.type === 'llm-error') {
                    document.getElementById('explanation').style.display = 'none';
                    const errorBox = document.getElementById('error-box');
                    errorBox.classList.add('visible');
                    document.getElementById('error-message').textContent = msg.message;
                }
            });
        </script>
    </body>
</html>`;
}