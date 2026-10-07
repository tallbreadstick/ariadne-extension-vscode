import * as assert from 'assert';
import { buildSessionMetricsHtml } from '../modules/tracker/views/sessionMetrics.js';
import type { SessionMetrics } from '../modules/presentation/panelTypes.js';

describe('Session Metrics Terminology & Subtitles', () => {
	it('renders "Full Report" instead of "Full scan"', () => {
		const metrics: SessionMetrics = {
			critical: 2,
			high: 3,
			medium: 1,
			low: 0,
			trends: {
				persistingPatterns: 1,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('Full Report'), 'Should render "Full Report" header');
		assert.ok(!html.includes('Full scan'), 'Should not render "Full scan"');
		assert.ok(html.includes('full-report-section') || html.includes('full-scan-section'));
	});

	it('renders persisting subtitle next to instances in Persisting Patterns sub-items', () => {
		const metrics: SessionMetrics = {
			critical: 1,
			high: 0,
			medium: 1,
			low: 0,
			trends: {
				persistingPatterns: 3,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
				persistingItems: [
					{
						type: 'SQL Injection',
						instances: 2,
						subtitle: 'Present since 3 reports',
					},
					{
						type: 'Command Injection',
						instances: 1,
						reportCount: 4,
					},
					{
						type: 'Mutable Reference',
						instances: 1,
					},
				],
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('Persisting Patterns'));
		assert.ok(html.includes('SQL Injection'));
		assert.ok(html.includes('Present since 3 reports'), 'Custom subtitle should be displayed');
		assert.ok(html.includes('Command Injection'));
		assert.ok(html.includes('Present since 4 reports'), 'Computed reportCount subtitle should be displayed');
		assert.ok(html.includes('Mutable Reference'));
		assert.ok(html.includes('Present since 2 reports'), 'Default subtitle should be displayed');
		assert.ok(html.includes('persisting-subtitle'), 'CSS class for persisting subtitle should be present');
	});

	it('updates sign-in prompt to mention reports instead of scans', () => {
		const metrics: SessionMetrics = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 0,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: false });
		assert.ok(html.includes('generate reports'), 'Sign-in prompt should mention generating reports');
		assert.ok(!html.includes('run scans'), 'Sign-in prompt should not mention running scans');
	});

	it('renders Session Metrics header and session badge with current session number', () => {
		const metrics: SessionMetrics = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 0,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
			},
			sessionLabel: 'Session 2',
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('full-report-header'), 'Should render full report header container');
		assert.ok(html.includes('Full Report'), 'Should render Full Report title');
		assert.ok(html.includes('session-badge'), 'Should render session badge');
		assert.ok(html.includes('SESSION 2'), 'Should render SESSION 2 badge text');
		assert.ok(html.includes('session-dot'), 'Should render bullet dot');
	});

	it('defaults to SESSION 1 badge when sessionLabel is omitted', () => {
		const metrics: SessionMetrics = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 0,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('SESSION 1'), 'Should default to SESSION 1');
	});
});
