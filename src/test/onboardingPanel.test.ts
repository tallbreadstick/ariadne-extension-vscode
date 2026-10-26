import * as assert from 'assert';
import type * as vscode from 'vscode';
import {
	buildOnboardingHtml,
	resetOnboardingState,
} from '../modules/presentation/onboarding/onboardingPanel.js';

function createMockMemento(): {
	memento: vscode.Memento;
	store: Record<string, unknown>;
} {
	const store: Record<string, unknown> = {};
	const memento = {
		get: <T>(key: string, defaultValue?: T): T => {
			return (store[key] !== undefined ? store[key] : defaultValue) as T;
		},
		update: async (key: string, value: unknown): Promise<void> => {
			if (value === undefined) {
				delete store[key];
			} else {
				store[key] = value;
			}
		},
		keys: (): readonly string[] => Object.keys(store),
		setKeysForSync: () => undefined,
	} as unknown as vscode.Memento;

	return { memento, store };
}

describe('Onboarding Guide Webview Panel', () => {
	describe('buildOnboardingHtml', () => {
		const html = buildOnboardingHtml();

		it('contains the Hero Welcome header and introduction', () => {
			assert.match(html, /Welcome to Ariadne/);
			assert.match(html, /Student Security Companion/);
			assert.match(html, /pedagogical static analysis assistant for Java in VS Code/);
		});

		it('contains Section 1: The Saving & Scanning Lifecycle with all 6 steps', () => {
			assert.match(html, /The Saving &amp; Scanning Lifecycle/);
			// 2.1 First save
			assert.match(html, /Session Begins on First Save/);
			assert.match(html, /Step 2\.1/);
			// 2.2 Real-time scanning
			assert.match(html, /Near Real-Time Vulnerability Scanning/);
			assert.match(html, /Step 2\.2/);
			// 2.3 Full report multi-save durability
			assert.match(html, /Full Report Multi-Save Durability/);
			assert.match(html, /Step 2\.3/);
			// 2.4 Periodic hourly auto-scan (fixed 60 minutes)
			assert.match(html, /Periodic Hourly Auto-Scan/);
			assert.match(html, /Step 2\.4/);
			assert.match(html, /every 60 minutes/);
			assert.ok(!html.includes('configurable from 2 to 180'));
			// 2.5 2-Hour Habit Tracking in Common Vulnerabilities
			assert.match(html, /2-Hour Habit Tracking in Common Vulnerabilities/);
			assert.match(html, /Step 2\.5/);
			assert.match(html, /persists for 2 hours/);
			// 2.6 Safe session termination
			assert.match(html, /Safe Session Termination/);
			assert.match(html, /Step 2\.6/);
		});

		it('renders demonstration GIFs with captions for Steps 2.1, 2.4, and 2.5', () => {
			assert.ok(html.includes('Step 2.1 Session Started (Optimized).gif'), 'Should include Step 2.1 GIF');
			assert.ok(html.includes('Step 2.4 Session Started (Optimized).gif'), 'Should include Step 2.4 GIF');
			assert.ok(html.includes('Step 2.45 Session Started (optimized).gif'), 'Should include Step 2.5 GIF');
			assert.ok(html.includes('class="demo-media"'), 'Should render demo-media images');
			assert.ok(html.includes('class="demo-media-caption"'), 'Should render media captions');
		});

		it('removes configurable auto-scan from settings description', () => {
			assert.ok(!html.includes('2–180 min'), 'Should not mention 2-180 min interval');
			assert.ok(!html.includes('configurable'), 'Should not mention configurable auto-scan');
		});

		it('contains Section 2: Core Features with location badges and interactive action buttons', () => {
			assert.match(html, /Core Features &amp; Where to Find Them/);

			// Settings feature
			assert.match(html, /Sidebar Settings/);
			assert.match(html, /Activity Bar \(Left\)/);
			assert.match(html, /data-action="openSettings"/);

			// Active Vulnerabilities feature
			assert.match(html, /Active Vulnerabilities/);
			assert.match(html, /Bottom Panel \(Left\)/);
			assert.match(html, /data-action="openActiveVulnerabilities"/);

			// Full Report feature
			assert.match(html, /Full Report/);
			assert.match(html, /Bottom Panel \(Right\)/);
			assert.match(html, /data-action="openFullReport"/);

			// Inline Highlighting feature
			assert.match(html, /Inline Highlighting/);
			assert.match(html, /Editor Pane/);
			assert.match(html, /\[Ariadne\] SQL Injection/);
		});

		it('contains Section 3: Friendly Exit closing message and Start Coding button', () => {
			assert.match(html, /You're Ready to Code!/);
			assert.match(html, /Enjoy your experience with Ariadne/);
			assert.match(html, /data-action="startCoding"/);
			assert.match(html, /Start Coding with Ariadne/);
		});

		it('uses SVG icons and illustrations without emojis', () => {
			assert.ok(html.includes('class="hero-badge-icon"'), 'Hero badge should use SVG icon');
			assert.ok(html.includes('class="feature-icon"'), 'Feature headers should use SVG icons');
			assert.ok(html.includes('class="step-svg"'), 'Process cards should use SVG icons');
			assert.ok(html.includes('class="closing-badge"'), 'Closing section should use SVG badge');
			assert.ok(!html.includes('🛡️'), 'Should not contain shield emoji');
			assert.ok(!html.includes('⚙️'), 'Should not contain settings emoji');
			assert.ok(!html.includes('📋'), 'Should not contain clipboard emoji');
			assert.ok(!html.includes('📊'), 'Should not contain chart emoji');
			assert.ok(!html.includes('🖊️'), 'Should not contain pen emoji');
			assert.ok(!html.includes('🎉'), 'Should not contain party emoji');
		});

		it('includes client script dispatching vscode.postMessage for actions', () => {
			assert.match(html, /acquireVsCodeApi\(\)/);
			assert.match(html, /vscode\.postMessage\(\{ action \}\)/);
		});
	});

	describe('resetOnboardingState', () => {
		it('clears ariadne.hasSeenOnboarding from storage', async () => {
			const { memento, store } = createMockMemento();
			await memento.update('ariadne.hasSeenOnboarding', true);
			assert.strictEqual(store['ariadne.hasSeenOnboarding'], true);

			await resetOnboardingState(memento);
			assert.strictEqual(store['ariadne.hasSeenOnboarding'], undefined);
		});
	});
});
