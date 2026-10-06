/**
 * Startup frame for the bottom panels. A light runs around the edges
 * until the extension finishes starting.
 */

const CSS = /* css */ `
	:root {
		color-scheme: dark;
		--bg: var(--vscode-editor-background);
		--text: var(--vscode-foreground);
		--muted: var(--vscode-descriptionForeground);
	}

	* { box-sizing: border-box; }

	html, body {
		height: 100%;
		margin: 0;
	}

	body {
		background: var(--bg);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}

	.loading-frame {
		position: relative;
		min-height: 100%;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 18%, transparent);
	}

	.beam {
		position: absolute;
		pointer-events: none;
		opacity: 0;
	}

	.beam-h {
		height: 2px;
		width: 34%;
		background: linear-gradient(90deg, transparent, rgba(186, 230, 255, 0.15), #f7fcff, rgba(186, 230, 255, 0.15), transparent);
	}

	.beam-v {
		width: 2px;
		height: 34%;
		background: linear-gradient(180deg, transparent, rgba(186, 230, 255, 0.15), #f7fcff, rgba(186, 230, 255, 0.15), transparent);
	}

	.beam-top { top: 0; left: 0; animation: lap-top 2.8s linear infinite; }
	.beam-right { top: 0; right: 0; animation: lap-right 2.8s linear infinite; }
	.beam-bottom { bottom: 0; right: 0; animation: lap-bottom 2.8s linear infinite; }
	.beam-left { bottom: 0; left: 0; animation: lap-left 2.8s linear infinite; }

	@keyframes lap-top {
		0% { transform: translateX(-110%); opacity: 1; }
		25% { transform: translateX(310%); opacity: 1; }
		25.1%, 100% { opacity: 0; }
	}

	@keyframes lap-right {
		0%, 25% { transform: translateY(-110%); opacity: 0; }
		25.1% { transform: translateY(-110%); opacity: 1; }
		50% { transform: translateY(310%); opacity: 1; }
		50.1%, 100% { opacity: 0; }
	}

	@keyframes lap-bottom {
		0%, 50% { transform: translateX(110%); opacity: 0; }
		50.1% { transform: translateX(110%); opacity: 1; }
		75% { transform: translateX(-310%); opacity: 1; }
		75.1%, 100% { opacity: 0; }
	}

	@keyframes lap-left {
		0%, 75% { transform: translateY(110%); opacity: 0; }
		75.1% { transform: translateY(110%); opacity: 1; }
		100% { transform: translateY(-310%); opacity: 1; }
	}

	.signin-state {
		display: grid;
		gap: 10px;
		align-content: center;
		justify-items: center;
		min-height: 100%;
		padding: 32px 20px;
		text-align: center;
	}

	.signin-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.signin-copy {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
		max-width: 340px;
		color: var(--muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.beam { animation: none; opacity: 0; }
	}
`;

export function buildStartupLoadingHtml(title: string): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${title}</title>
		<style>${CSS}</style>
	</head>
	<body>
		<div class="loading-frame">
			<span class="beam beam-h beam-top" aria-hidden="true"></span>
			<span class="beam beam-v beam-right" aria-hidden="true"></span>
			<span class="beam beam-h beam-bottom" aria-hidden="true"></span>
			<span class="beam beam-v beam-left" aria-hidden="true"></span>
			<section class="signin-state" role="status" aria-busy="true">
				<p class="signin-title">Loading Ariadne</p>
				<p class="signin-copy">The extension is starting.</p>
			</section>
		</div>
	</body>
</html>`;
}
