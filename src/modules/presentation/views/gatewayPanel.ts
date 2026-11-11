/**
 * Unified gateway panel rendered across the bottom panel before the student
 * signs in or while the extension is downloading and initializing the scanner.
 */

export type GatewayState =
	| { kind: 'signed-out'; termsAccepted?: boolean; privacyAccepted?: boolean }
	| { kind: 'downloading'; progressPercent?: number; targetName?: string }
	| { kind: 'initializing' }
	| { kind: 'scanning' }
	| { kind: 'error'; message?: string }
	| { kind: 'no-java' };

export const SECURITY_TIPS: string[] = [
	'Ariadne analyzes your code locally on your device — your source code is never sent to the cloud.',
	'Addressing vulnerabilities in the same session reinforces secure coding habits before committing.',
	'Ariadne uses a 5-state lifecycle model to verify your security fixes across multiple saves.',
	'Check Session Metrics to track your improving trends, resolved counts, and recurring habits.',
	'Use "Explain Vulnerability" on any finding for pedagogical remediation guidance tailored to your code.',
	'Sanitizing user inputs at the controller layer prevents both injection flaws and business logic bypasses.',
];

const SHIELD_SVG = /* svg */ `
<svg class="shield-icon" width="52" height="52" viewBox="0 0 798 798" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="currentColor" transform="translate(88,798) scale(0.1,-0.1)">
    <path d="M3068 7965 c-15 -8 -136 -88 -270 -178 -408 -274 -816 -505 -1238
-703 -479 -223 -810 -344 -1273 -465 -126 -32 -237 -64 -247 -69 -16 -8 -19
-30 -26 -177 -12 -274 -10 -1286 4 -1503 48 -751 160 -1516 282 -1935 56 -190
160 -504 169 -510 4 -2 84 174 176 393 211 497 270 627 517 1142 110 228 202
422 205 431 3 12 -25 38 -101 93 -58 42 -110 76 -115 76 -5 0 -120 -234 -257
-520 -143 -299 -252 -514 -256 -507 -10 18 -73 459 -102 712 -36 313 -54 564
-66 925 -10 282 -6 949 6 992 3 11 47 29 137 58 505 160 1104 416 1608 685 76
41 141 75 144 75 14 0 -3 -38 -87 -194 -51 -93 -176 -330 -278 -524 l-185
-355 -100 -56 c-180 -102 -326 -211 -430 -322 -236 -251 -241 -513 -14 -741
94 -94 163 -140 344 -228 322 -156 699 -268 1400 -415 487 -102 729 -167 970
-260 267 -103 483 -245 553 -364 23 -40 27 -57 27 -126 0 -69 -4 -87 -29 -132
-81 -146 -306 -324 -561 -444 -55 -25 -192 -81 -305 -124 -262 -99 -334 -133
-436 -200 -131 -88 -199 -179 -241 -326 -15 -55 -18 -103 -18 -341 l0 -277
-31 -23 c-40 -30 -86 -84 -110 -128 -30 -56 -27 -190 6 -254 32 -62 107 -130
167 -150 64 -22 167 -20 220 3 107 49 175 150 181 269 4 66 1 79 -27 137 -30
59 -65 99 -120 136 l-24 15 -5 255 c-6 313 0 344 82 424 64 62 154 108 386
195 254 96 357 141 502 219 445 238 686 571 614 848 -69 271 -319 473 -801
648 -272 99 -457 147 -1050 275 -565 121 -785 181 -1055 287 -223 88 -366 170
-461 265 -128 128 -118 235 38 399 92 96 103 88 44 -30 -23 -44 -41 -87 -41
-95 0 -35 200 -181 220 -160 4 5 129 248 277 539 249 488 446 864 871 1660 88
165 179 334 202 374 l43 75 24 -30 c25 -29 72 -114 413 -749 255 -477 376
-709 813 -1570 610 -1201 919 -1850 1232 -2590 129 -305 147 -345 155 -345 20
0 133 311 190 525 128 480 224 1129 272 1860 14 209 15 1405 1 1600 l-8 109
-75 23 c-41 12 -162 45 -268 73 -419 110 -814 260 -1287 489 -403 196 -735
386 -1098 630 -256 172 -336 221 -357 221 -8 -1 -27 -7 -42 -15z M2856 5367
c-137 -292 -258 -549 -268 -570 l-19 -37 28 -11 c16 -6 208 -49 428 -95 220
-46 479 -104 575 -128 96 -25 176 -44 177 -42 3 3 -187 414 -367 791 -34 72
-102 220 -152 330 -94 208 -137 295 -147 295 -3 0 -118 -240 -255 -533z M2242
4050 c-7 -12 -50 -107 -96 -213 -46 -106 -164 -370 -261 -587 -97 -217 -235
-530 -305 -695 -164 -383 -268 -617 -277 -626 -5 -4 -75 -12 -158 -18 -135
-11 -215 -20 -312 -36 l-32 -6 29 -47 c82 -131 395 -495 602 -698 258 -254
466 -419 818 -652 300 -198 444 -284 640 -380 139 -68 184 -86 220 -86 119 -2
795 395 1200 704 363 278 695 609 996 997 96 123 121 163 102 164 -7 0 -121
12 -253 27 l-239 27 -154 347 -154 346 -112 -73 c-160 -104 -304 -178 -477
-245 -83 -32 -156 -63 -162 -69 -7 -7 -5 -18 7 -33 198 -276 289 -468 350
-740 31 -136 32 -180 9 -204 -62 -62 -496 -363 -723 -501 -149 -90 -374 -213
-391 -213 -17 0 -212 109 -419 233 -411 248 -720 482 -1009 763 -152 148 -148
136 -84 242 138 228 467 492 853 688 251 127 652 291 1014 414 274 93 407 149
538 227 176 104 220 158 220 272 0 64 -14 106 -45 140 -49 52 -308 161 -557
235 -186 54 -225 64 -730 172 -217 46 -446 98 -509 114 -63 17 -117 30 -120
30 -3 0 -12 -9 -19 -20z"/>
  </g>
</svg>`;

const CSS = /* css */ `
	:root {
		color-scheme: dark;
		--bg: var(--vscode-editor-background);
		--text: var(--vscode-foreground);
		--muted: var(--vscode-descriptionForeground);
		--accent: var(--vscode-focusBorder, #007acc);
		--btn-bg: var(--vscode-button-background);
		--btn-fg: var(--vscode-button-foreground);
		--btn-hover: var(--vscode-button-hoverBackground);
		--card-bg: color-mix(in srgb, var(--vscode-editor-background) 85%, var(--vscode-sideBar-background));
		--border: color-mix(in srgb, var(--text) 12%, transparent);
	}

	* { box-sizing: border-box; }

	html, body {
		height: 100%;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	body {
		background: var(--bg);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.loading-frame {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
		overflow: hidden;
	}

	/* Animated perimeter light beam */
	.beam {
		position: absolute;
		pointer-events: none;
		opacity: 0;
	}

	.beam-h {
		height: 2px;
		width: 32%;
		background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.2), #38bdf8, rgba(56, 189, 248, 0.2), transparent);
	}

	.beam-v {
		width: 2px;
		height: 32%;
		background: linear-gradient(180deg, transparent, rgba(56, 189, 248, 0.2), #38bdf8, rgba(56, 189, 248, 0.2), transparent);
	}

	.beam-top { top: 0; left: 0; animation: lap-top 3.2s linear infinite; }
	.beam-right { top: 0; right: 0; animation: lap-right 3.2s linear infinite; }
	.beam-bottom { bottom: 0; right: 0; animation: lap-bottom 3.2s linear infinite; }
	.beam-left { bottom: 0; left: 0; animation: lap-left 3.2s linear infinite; }

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

	/* Main centered card */
	.gateway-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 480px;
		width: 100%;
		padding: 28px 24px;
		border-radius: 12px;
		background: var(--card-bg);
		border: 1px solid var(--border);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
		z-index: 2;
	}

	.logo-container {
		position: relative;
		width: 68px;
		height: 68px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 16px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, transparent 72%);
	}

	.shield-icon {
		color: #38bdf8;
		filter: drop-shadow(0 2px 8px rgba(56, 189, 248, 0.35));
	}

	.gateway-title {
		margin: 0 0 8px;
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.gateway-copy {
		margin: 0 0 18px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--muted);
		max-width: 380px;
	}

	/* Sleek pulsing progress bar for loading/scanning */
	.progress-bar-container {
		width: 220px;
		height: 4px;
		background: color-mix(in srgb, var(--text) 10%, transparent);
		border-radius: 4px;
		overflow: hidden;
		margin: 4px 0 20px;
	}

	.progress-bar-fill {
		height: 100%;
		width: 40%;
		background: linear-gradient(90deg, #0284c7, #38bdf8);
		border-radius: 4px;
		animation: pulse-indeterminate 1.6s ease-in-out infinite;
	}

	@keyframes pulse-indeterminate {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(300%); }
	}

	/* Cycling security tips carousel */
	.tips-box {
		width: 100%;
		margin-top: 6px;
		padding: 12px 14px;
		background: color-mix(in srgb, var(--vscode-editor-background) 70%, transparent);
		border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 72px;
		justify-content: center;
	}

	.tips-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #38bdf8;
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.tips-content {
		font-size: 12px;
		line-height: 1.45;
		color: var(--muted);
		transition: opacity 0.35s ease-in-out, transform 0.35s ease-in-out;
		opacity: 1;
		transform: translateY(0);
	}

	.tips-content.fade-out {
		opacity: 0;
		transform: translateY(4px);
	}

	/* Action buttons */
	.btn-primary {
		appearance: none;
		border: none;
		outline: none;
		cursor: pointer;
		text-decoration: none;
		background: var(--btn-bg);
		color: var(--btn-fg);
		font-size: 13px;
		font-weight: 500;
		padding: 8px 18px;
		border-radius: 4px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		transition: background 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
	}

	.btn-primary:hover:not(.disabled):not(:disabled) {
		background: var(--btn-hover);
	}

	.btn-primary.disabled,
	.btn-primary:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		filter: grayscale(0.2);
	}

	.btn-primary:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}

	/* Consent block styling for sign-in */
	.consent-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		text-align: left;
		margin: 4px 0 16px;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--vscode-editor-background) 60%, transparent);
		border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
		border-radius: 6px;
		width: 100%;
		max-width: 400px;
		box-sizing: border-box;
		transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
	}

	.consent-block.pulse-warning {
		animation: pulse-attention 0.6s ease-out;
		border-color: #38bdf8;
	}

	@keyframes pulse-attention {
		0% {
			box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.5);
			border-color: #38bdf8;
			transform: scale(1);
		}
		30% {
			box-shadow: 0 0 0 6px rgba(56, 189, 248, 0.25);
			border-color: #38bdf8;
			transform: scale(1.02);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(56, 189, 248, 0);
			border-color: color-mix(in srgb, var(--text) 12%, transparent);
			transform: scale(1);
		}
	}

	.consent-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	.consent-item input[type="checkbox"] {
		margin-top: 2px;
		cursor: pointer;
		flex-shrink: 0;
		accent-color: #38bdf8;
	}

	.consent-item label {
		font-size: 12px;
		line-height: 1.45;
		color: var(--text);
		cursor: pointer;
		user-select: none;
	}

	.consent-item label a {
		color: #38bdf8;
		text-decoration: underline;
	}

	.consent-item label a:hover {
		color: #7dd3fc;
	}

	.privacy-footnote {
		margin-top: 14px;
		font-size: 11px;
		color: color-mix(in srgb, var(--muted) 85%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.beam { animation: none; opacity: 0; }
		.progress-bar-fill { animation: none; width: 100%; }
		.tips-content { transition: none; }
	}
`;

export function buildGatewayHtml(state: GatewayState = { kind: 'signed-out' }): string {
	let title = 'Welcome to Ariadne';
	let copy = 'Sign in with GitHub to scan your Java projects and review security findings without compromising academic integrity.';
	let actionButton = '';
	let showTips = false;
	let showProgress = false;
	let showBeam = true;

	switch (state.kind) {
		case 'signed-out': {
			title = 'Welcome to Ariadne';
			copy = 'GitHub sign-in is needed to scan this workspace, identify active vulnerabilities, and track session metrics.';
			const termsChecked = state.termsAccepted ? 'checked' : '';
			const privacyChecked = state.privacyAccepted ? 'checked' : '';
			const canSignIn = Boolean(state.termsAccepted && state.privacyAccepted);
			actionButton = /* html */ `
				<div class="consent-block" id="gateway-consent-block">
					<div class="consent-item">
						<input type="checkbox" id="gateway-terms-checkbox" ${termsChecked} />
						<label for="gateway-terms-checkbox">
							I agree to the Ariadne <a href="command:ariadne-extension-vscode.openTermsOfUse">Terms of Use</a>.
						</label>
					</div>
					<div class="consent-item">
						<input type="checkbox" id="gateway-privacy-checkbox" ${privacyChecked} />
						<label for="gateway-privacy-checkbox">
							I agree to the Ariadne <a href="command:ariadne-extension-vscode.openPrivacyPolicy">Privacy Policy</a>, including anonymous activity collection.
						</label>
					</div>
				</div>
				<button class="btn-primary ${canSignIn ? '' : 'disabled'}" id="btn-gateway-action" type="button" data-action="sign-in" aria-disabled="${canSignIn ? 'false' : 'true'}">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
					</svg>
					Sign in with GitHub
				</button>`;
			showBeam = false;
			break;
		}

		case 'downloading':
			title = 'Downloading Security Engine';
			copy = state.targetName
				? `Downloading static analysis engine (${state.targetName})...`
				: 'Downloading the Ariadne security engine for your platform...';
			showProgress = true;
			showTips = true;
			break;

		case 'initializing':
			title = 'Initializing Ariadne';
			copy = 'Starting local static analysis session and verifying rule packs...';
			showProgress = true;
			showTips = true;
			break;

		case 'scanning':
			title = 'Analyzing Project';
			copy = 'Running real-time AST and taint analysis across Java workspace files...';
			showProgress = true;
			showTips = true;
			break;

		case 'no-java':
			title = 'Java Project Needed';
			copy = 'Ariadne reviews Java and Spring applications. Open a folder containing Java source code to begin.';
			actionButton = /* html */ `
				<button class="btn-primary" id="btn-gateway-action" type="button" data-action="open-folder">
					Open Java Folder
				</button>`;
			showBeam = false;
			break;

		case 'error':
			title = 'Security Scanner Unavailable';
			copy = state.message || 'Ariadne could not launch the scanner binary. Check your core settings or select a local executable.';
			actionButton = /* html */ `
				<button class="btn-primary" id="btn-gateway-action" type="button" data-action="open-core-settings">
					Open Core Settings
				</button>`;
			showBeam = false;
			break;
	}

	const tipsJson = JSON.stringify(SECURITY_TIPS);

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
			${showBeam ? /* html */ `
				<span class="beam beam-h beam-top" aria-hidden="true"></span>
				<span class="beam beam-v beam-right" aria-hidden="true"></span>
				<span class="beam beam-h beam-bottom" aria-hidden="true"></span>
				<span class="beam beam-v beam-left" aria-hidden="true"></span>
			` : ''}

			<section class="gateway-card" role="region" aria-label="Ariadne Gateway">
				<div class="logo-container">
					${SHIELD_SVG}
				</div>

				<h2 class="gateway-title" id="gateway-title">${title}</h2>
				<p class="gateway-copy" id="gateway-copy">${copy}</p>

				${showProgress ? /* html */ `
					<div class="progress-bar-container" role="progressbar" aria-label="Loading progress" aria-valuemin="0" aria-valuemax="100">
						<div class="progress-bar-fill"></div>
					</div>
				` : ''}

				${actionButton}

				${showTips ? /* html */ `
					<div class="tips-box" role="complementary" aria-label="Security Tip">
						<div class="tips-header">
							<span>💡 Did you know?</span>
						</div>
						<div class="tips-content" id="tips-text">${SECURITY_TIPS[0]}</div>
					</div>
				` : ''}

				<div class="privacy-footnote">
					Ariadne runs locally • Code never leaves your workspace
				</div>
			</section>
		</div>

		<script>
			(function () {
				const vscode = acquireVsCodeApi();
				const tips = ${tipsJson};
				let tipIndex = 0;
				const tipsEl = document.getElementById('tips-text');

				// Cycle tips smoothly every 3.5s
				if (tipsEl && tips.length > 1) {
					setInterval(() => {
						tipsEl.classList.add('fade-out');
						setTimeout(() => {
							tipIndex = (tipIndex + 1) % tips.length;
							tipsEl.textContent = tips[tipIndex];
							tipsEl.classList.remove('fade-out');
						}, 350);
					}, 3500);
				}

				// Consent checkbox toggle & button action routing
				const actionBtn = document.getElementById('btn-gateway-action');
				const termsCb = document.getElementById('gateway-terms-checkbox');
				const privacyCb = document.getElementById('gateway-privacy-checkbox');
				const consentBlock = document.getElementById('gateway-consent-block');

				function updateConsentState() {
					if (!actionBtn || !termsCb || !privacyCb) {
						return;
					}
					const isChecked = termsCb.checked && privacyCb.checked;
					actionBtn.classList.toggle('disabled', !isChecked);
					actionBtn.setAttribute('aria-disabled', String(!isChecked));
				}

				function onConsentChange() {
					updateConsentState();
					vscode.postMessage({
						type: 'consent-change',
						termsAccepted: Boolean(termsCb && termsCb.checked),
						privacyAccepted: Boolean(privacyCb && privacyCb.checked),
					});
				}

				if (termsCb && privacyCb) {
					termsCb.addEventListener('change', onConsentChange);
					privacyCb.addEventListener('change', onConsentChange);
					updateConsentState();
				}

				window.addEventListener('message', (event) => {
					const msg = event.data;
					if (msg && msg.type === 'consent-sync') {
						if (termsCb && typeof msg.termsAccepted === 'boolean') {
							termsCb.checked = msg.termsAccepted;
						}
						if (privacyCb && typeof msg.privacyAccepted === 'boolean') {
							privacyCb.checked = msg.privacyAccepted;
						}
						updateConsentState();
					}
				});

				if (actionBtn) {
					actionBtn.addEventListener('click', () => {
						const action = actionBtn.dataset.action;
						if (action === 'sign-in') {
							if (!termsCb || !privacyCb || !termsCb.checked || !privacyCb.checked) {
								if (consentBlock) {
									consentBlock.classList.remove('pulse-warning');
									void consentBlock.offsetWidth;
									consentBlock.classList.add('pulse-warning');
								}
								return;
							}
							vscode.postMessage({
								type: 'gateway-sign-in',
								termsAccepted: true,
								privacyAccepted: true,
							});
							return;
						}

						if (action) {
							vscode.postMessage({ type: 'gateway-action', action });
						}
					});
				}
			})();
		</script>
	</body>
</html>`;
}

