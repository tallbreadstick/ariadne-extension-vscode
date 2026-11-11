/**
 * Startup frame for the bottom panels. A light runs around the edges
 * until the extension finishes starting, with centered logo and cycling tips.
 */

import { SECURITY_TIPS } from './gatewayPanel.js';

const SHIELD_SVG = /* svg */ `
<svg class="shield-icon" width="44" height="44" viewBox="0 0 798 798" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
	}

	* { box-sizing: border-box; }

	html, body {
		height: 100%;
		margin: 0;
		padding: 0;
	}

	body {
		background: var(--bg);
		color: var(--text);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		max-width: 440px;
		width: 100%;
		padding: 24px;
	}

	.logo-wrap {
		width: 58px;
		height: 58px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
	}

	.shield-icon {
		color: #38bdf8;
		filter: drop-shadow(0 2px 6px rgba(56, 189, 248, 0.3));
	}

	.signin-title {
		margin: 0 0 6px;
		font-size: 15px;
		font-weight: 600;
	}

	.signin-copy {
		margin: 0 0 16px;
		font-size: 12px;
		line-height: 1.5;
		max-width: 340px;
		color: var(--muted);
	}

	.progress-bar-container {
		width: 200px;
		height: 3px;
		background: color-mix(in srgb, var(--text) 10%, transparent);
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 16px;
	}

	.progress-bar-fill {
		height: 100%;
		width: 40%;
		background: linear-gradient(90deg, #0284c7, #38bdf8);
		border-radius: 3px;
		animation: pulse-indeterminate 1.6s ease-in-out infinite;
	}

	@keyframes pulse-indeterminate {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(300%); }
	}

	.tips-box {
		width: 100%;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--vscode-editor-background) 70%, transparent);
		border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
		border-radius: 6px;
		min-height: 60px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.tips-header {
		font-size: 11px;
		font-weight: 600;
		color: #38bdf8;
		margin-bottom: 3px;
	}

	.tips-content {
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--muted);
		transition: opacity 0.35s ease-in-out;
	}

	.tips-content.fade-out {
		opacity: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.beam { animation: none; opacity: 0; }
		.progress-bar-fill { animation: none; width: 100%; }
		.tips-content { transition: none; }
	}
`;

export function buildStartupLoadingHtml(
	title: string,
	customCopy: string = 'The extension is starting.',
): string {
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
			<span class="beam beam-h beam-top" aria-hidden="true"></span>
			<span class="beam beam-v beam-right" aria-hidden="true"></span>
			<span class="beam beam-h beam-bottom" aria-hidden="true"></span>
			<span class="beam beam-v beam-left" aria-hidden="true"></span>
			<section class="signin-state" role="status" aria-busy="true">
				<div class="logo-wrap">${SHIELD_SVG}</div>
				<p class="signin-title">Loading Ariadne</p>
				<p class="signin-copy">${customCopy}</p>
				<div class="progress-bar-container" role="progressbar">
					<div class="progress-bar-fill"></div>
				</div>
				<div class="tips-box">
					<div class="tips-header">💡 Security Tip</div>
					<div class="tips-content" id="tips-text">${SECURITY_TIPS[0]}</div>
				</div>
			</section>
		</div>

		<script>
			(function () {
				const tips = ${tipsJson};
				let tipIndex = 0;
				const tipsEl = document.getElementById('tips-text');
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
			})();
		</script>
	</body>
</html>`;
}
