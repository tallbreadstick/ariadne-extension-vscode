/**
 * Terms of Use panel for Ariadne AI feedback and anonymous analytics.
 */

export function buildTermsOfUseHtml(): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy"
			content="default-src 'none'; style-src 'unsafe-inline';" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne Terms of Use</title>
		<style>
			:root {
				color-scheme: dark;
				--text: var(--vscode-foreground);
				--muted: var(--vscode-descriptionForeground);
				--accent: var(--vscode-textLink-foreground);
				--border: var(--vscode-panel-border);
			}

			* { box-sizing: border-box; }

			body {
				margin: 0;
				padding: 28px 32px 40px;
				background: var(--vscode-editor-background);
				color: var(--text);
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				font-size: 14px;
				line-height: 1.65;
				max-width: 760px;
			}

			h1 {
				margin: 0 0 8px;
				font-size: 22px;
				font-weight: 600;
			}

			.updated {
				margin: 0 0 24px;
				color: var(--muted);
				font-size: 12px;
			}

			h2 {
				margin: 28px 0 10px;
				font-size: 15px;
				font-weight: 600;
				border-bottom: 1px solid var(--border);
				padding-bottom: 6px;
			}

			p, li { margin: 0 0 12px; }

			ul {
				margin: 0 0 12px;
				padding-left: 20px;
			}

			.highlight {
				padding: 14px 16px;
				border-left: 3px solid var(--accent);
				background: color-mix(in srgb, var(--accent) 8%, transparent);
				border-radius: 4px;
				margin: 16px 0;
			}
		</style>
	</head>
	<body>
		<h1>Ariadne Terms of Use</h1>
		<p class="updated">Last updated: July 2026</p>

		<p>
			Ariadne is an educational security analysis tool for student developers.
			By signing in and using AI-powered vulnerability explanations, you agree
			to the terms below.
		</p>

		<h2>AI Feedback via GitHub Copilot</h2>
		<p>
			AI explanations are generated through your own GitHub account using the
			GitHub Copilot SDK. Usage counts against your Copilot subscription and
			allowance, not a shared team API key. Ariadne does not store or embed
			OpenAI or other model API keys in the extension.
		</p>

		<h2>Anonymous Activity Collection</h2>
		<div class="highlight">
			<p>
				With your consent, Ariadne collects <strong>anonymous, aggregated
				activity data</strong> about how you use the extension. This helps us
				improve the tool for student developers in academic settings.
			</p>
		</div>
		<p>Examples of data we may collect include:</p>
		<ul>
			<li>Vulnerability trend metrics (e.g. counts by severity over time)</li>
			<li>Persisting pattern indicators (e.g. recurring CWE categories)</li>
			<li>Session-level scan statistics (e.g. number of scans, resolved trends)</li>
			<li>Feature usage events (e.g. opening AI feedback, signing in)</li>
		</ul>

		<h2>What We Do Not Collect</h2>
		<ul>
			<li>Your source code, file contents, or repository names</li>
			<li>Line-level code snippets sent to or returned from the AI model beyond what is required for a single explanation request</li>
			<li>Credentials, tokens, or personally identifying information tied to your code</li>
			<li>Data that would let us inspect private codebases or uncover critical flaws for our own use</li>
		</ul>
		<p>
			All collected activity data is anonymized. We cannot reconstruct your
			identity from analytics data alone, and we do not use this data to audit,
			monitor, or exploit private projects.
		</p>

		<h2>Educational Purpose</h2>
		<p>
			Ariadne is diagnostic, not remedial. AI feedback explains vulnerabilities
			in plain language to strengthen security thinking. It does not provide
			ready-made fixes or complete solutions, in line with academic integrity
			expectations.
		</p>

		<h2>Your Choices</h2>
		<p>
			You must accept these terms and consent to anonymous activity collection
			before signing in. You may sign out at any time from the Ariadne sidebar,
			which clears your Ariadne session and consent preferences stored by the
			extension.
		</p>

		<h2>Contact</h2>
		<p>
			Questions about these terms or our data practices can be directed to your
			course instructor or the Ariadne development team maintaining this extension.
		</p>
	</body>
</html>`;
}
