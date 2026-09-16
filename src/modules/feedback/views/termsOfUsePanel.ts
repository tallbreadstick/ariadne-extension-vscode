/**
 * Terms of Use panel for Ariadne.
 */

const CSS = /* css */ `
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
`;

export function buildTermsOfUseHtml(): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy"
			content="default-src 'none'; style-src 'unsafe-inline';" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Ariadne Terms of Use</title>
		<style>${CSS}</style>
	</head>
	<body>
		<h1>Ariadne Terms of Use</h1>
		<p class="updated">Last updated: September 2026</p>

		<p>
			Ariadne is an educational security analysis tool for student developers.
			GitHub sign-in is required to use the extension, including the SAST
			engine, rule scripts, and AI-powered vulnerability explanations.
		</p>

		<h2>Educational Purpose</h2>
		<p>
			Ariadne is diagnostic, not remedial. It identifies security issues and
			explains them in plain language so you can learn. It does not provide
			ready-made fixes or complete solutions, in line with academic integrity
			expectations.
		</p>

		<h2>AI Feedback via GitHub Copilot</h2>
		<p>
			AI explanations are generated through your own GitHub account using the
			GitHub Copilot SDK. Usage counts against your Copilot subscription and
			allowance. Ariadne does not store or embed model API keys in the
			extension.
		</p>

		<h2>Your Choices</h2>
		<p>
			You must accept these Terms of Use and the Privacy Policy before signing
			in. Without sign-in, Ariadne does not scan your code or provide AI
			explanations. You may sign out at any time from the Ariadne sidebar.
		</p>

		<h2>Contact</h2>
		<p>
			Questions about these terms can be directed to your course instructor or
			the Ariadne development team maintaining this extension.
		</p>
	</body>
</html>`;
}
