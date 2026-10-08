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

	it('renders visible subtitle beside Trends and explanatory tooltips on all 4 trend categories', () => {
		const metrics: SessionMetrics = {
			critical: 2,
			high: 1,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 1,
				improvingTrends: 1,
				resolvedThisSession: 1,
				recurringPatterns: 1,
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		// Trends subtitle (visible text, not tooltip)
		assert.ok(html.includes('trends-subtitle'), 'Should render trends-subtitle class');
		assert.ok(
			html.includes('Compares reports to track progress and unresolved risks.'),
			'Should render short visible subtitle beside Trends',
		);

		// Tooltips for the 4 trend categories
		assert.ok(
			html.includes('title="Vulnerabilities that remain unaddressed across multiple reports."'),
			'Persisting patterns should have explanatory tooltip',
		);
		assert.ok(
			html.includes('title="Vulnerabilities where occurrences are decreasing."'),
			'Improving trends should have explanatory tooltip',
		);
		assert.ok(
			html.includes('title="Previously resolved vulnerabilities that have reappeared."'),
			'Recurring patterns should have explanatory tooltip',
		);
		assert.ok(
			html.includes('title="Vulnerabilities successfully and durably remediated in this session."'),
			'Resolved this session should have explanatory tooltip',
		);
	});

	it('renders filterable attributes on metric cards, sub-items, and common vulnerabilities', () => {
		const metrics: SessionMetrics = {
			critical: 2,
			high: 1,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 1,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
				persistingItems: [
					{
						type: 'Cross-Site Scripting',
						instances: 2,
					},
				],
			},
			commonVulnerabilities: [
				{
					cweId: 'CWE-79',
					type: 'Cross-Site Scripting',
					sessionCount: 2,
					totalSessions: 3,
					totalInstanceCount: 2,
					activeFindingCount: 2,
				},
			],
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });

		// Metric cards should have filterable attributes
		assert.ok(html.includes('filterable-metric-card'), 'Should include filterable-metric-card class');
		assert.ok(html.includes('data-severity="critical"'), 'Should include data-severity attribute');
		assert.ok(html.includes('Filter active vulnerabilities by Critical Issues'), 'Should include title tooltip for filtering');

		// Sub-item and common vulnerability cards should be filterable
		assert.ok(html.includes('filterable-type-item'), 'Should include filterable-type-item class');
		assert.ok(html.includes('data-vuln-type="Cross-Site Scripting"'), 'Should include data-vuln-type attribute');
	});

	it('renders categorical progress in Improving Trends without numeric scores or deltas', () => {
		const metrics: SessionMetrics = {
			critical: 0,
			high: 0,
			medium: 1,
			low: 0,
			trends: {
				persistingPatterns: 0,
				improvingTrends: 1,
				resolvedThisSession: 1,
				recurringPatterns: 0,
				improvingItems: [
					{
						type: 'SQL Injection',
						instances: 1,
						progressLabel: 'Clear progress',
						progressDelta: '+2.5',
					},
				],
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('Clear progress'), 'Should render categorical progress label');
		assert.ok(!html.includes('+2.5'), 'Should not render numeric delta/score');
		assert.ok(!html.includes('(+2.5)'), 'Should not render parenthesized delta');
		assert.ok(html.includes('progress-clear'), 'Should include progress class');
	});

	it('does not render notification feed or cards in session metrics panel', () => {
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
			notifications: [
				{
					id: 'notif-1',
					message: 'Test alert',
					detail: 'Details here',
					timestamp: '10:00 AM',
				},
			],
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(!html.includes('notif-feed'), 'Should not render notification feed container');
		assert.ok(!html.includes('notif-card'), 'Should not render notification cards');
		assert.ok(!html.includes('NOTIFICATIONS'), 'Should not render notifications panel title');
		assert.ok(!html.includes('split-section'), 'Should not render split-section layout');
		assert.ok(html.includes('common-vuln-panel'), 'Should render common-vuln-panel as standalone');
		assert.ok(html.includes('common-vuln-subtitle'), 'Should render common-vuln-subtitle class');
		assert.ok(
			html.includes('Tracks recurring vulnerability patterns across your sessions.'),
			'Should render short visible subtitle in Common Vulnerabilities',
		);
	});
});
