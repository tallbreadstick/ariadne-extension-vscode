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
	return /* html */ `
		<section class="info-section">
			<div class="section-heading">
				<span class="section-number">${number}</span>
				<span class="section-title">${escapeHtml(title)}</span>
			</div>
			<div class="section-box">${body}</div>
		</section>`;
}

export function buildFeedbackPanelHtml(finding: FeedbackFinding): string {
	const title = escapeHtml(finding.type);
	const severity = escapeHtml(severityLabel(finding.severity));

	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne: Explanation</title>
		<style>
			:root {
				color-scheme: dark;
				--bg: #252526;
				--panel: #1e1e1e;
				--panel-2: #111111;
				--border: rgba(255, 255, 255, 0.1);
				--text: #d4d4d4;
				--muted: #9aa0a6;
				--critical: #d94c4c;
				--code-bg: #2b2b2b;
				--section-blue: #569cd6;
				--section-orange: #d19a66;
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
				padding: 24px 24px 28px;
			}

			.header {
				display: grid;
				gap: 10px;
				padding-bottom: 18px;
				border-bottom: 1px solid var(--border);
			}

			.title-row {
				display: flex;
				align-items: center;
				gap: 14px;
				flex-wrap: wrap;
			}

			.title-row h1 {
				margin: 0;
				font-size: 30px;
				font-weight: 600;
				letter-spacing: -0.02em;
			}

			.severity-pill {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 6px 12px;
				border-radius: 999px;
				background: var(--critical);
				color: white;
				font-size: 13px;
				font-weight: 600;
			}

			.meta {
				display: flex;
				gap: 12px;
				flex-wrap: wrap;
				font-size: 14px;
				color: #69d0c0;
			}

			.meta span { white-space: nowrap; }

			.content {
				display: grid;
				gap: 18px;
				padding-top: 20px;
			}

			.section-heading {
				display: flex;
				align-items: center;
				gap: 12px;
				margin-bottom: 10px;
			}

			.section-number {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 18px;
				height: 18px;
				border-radius: 50%;
				border: 1px solid currentColor;
				font-size: 12px;
				font-weight: 600;
				color: var(--section-blue);
			}

			.section-title {
				font-size: 18px;
				font-weight: 700;
				letter-spacing: 0.02em;
				text-transform: uppercase;
				color: #c8c8c8;
			}

			.section-box {
				background: #0f0f10;
				border: 1px solid rgba(255, 255, 255, 0.06);
				padding: 14px 16px;
				line-height: 1.6;
				font-size: 14px;
				color: #d7d7d7;
			}

			.section-box code {
				background: var(--code-bg);
				padding: 2px 6px;
				border-radius: 4px;
				color: #d7b27c;
				font-family: Consolas, "Courier New", monospace;
			}

			.footer {
				padding-top: 14px;
				margin-top: 8px;
				border-top: 1px solid var(--border);
				font-size: 13px;
				color: var(--muted);
			}

			@media (max-width: 700px) {
				.panel { padding: 18px 14px 22px; }
				.title-row h1 { font-size: 24px; }
				.section-title { font-size: 15px; }
			}
		</style>
	</head>
	<body>
		<div class="panel">
			<header class="header">
				<div class="title-row">
					<h1>${title}</h1>
					<span class="severity-pill">${severity}</span>
				</div>
				<div class="meta">
					<span>${escapeHtml(finding.cwe)}</span>
					<span>${escapeHtml(finding.owasp)}</span>
					<span>${escapeHtml(finding.path)}</span>
					<span>Line ${finding.line}</span>
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