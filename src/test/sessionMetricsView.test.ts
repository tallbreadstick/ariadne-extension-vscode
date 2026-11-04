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

	it('renders not-started badge with red dot and NOT STARTED YET label when isSessionActive is false', () => {
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
			sessionLabel: 'Session 3',
			isSessionActive: false,
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('session-badge not-started'), 'Should include not-started class on session-badge');
		assert.ok(html.includes('session-dot not-started'), 'Should include not-started class on session-dot');
		assert.ok(html.includes('SESSION 3 · NOT STARTED YET'), 'Should render SESSION 3 · NOT STARTED YET label');
	});

	it('renders normal active session badge when isSessionActive is true', () => {
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
			sessionLabel: 'Session 3',
			isSessionActive: true,
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(!html.includes('session-badge not-started'), 'Should not include not-started class on session-badge');
		assert.ok(!html.includes('session-dot not-started'), 'Should not include not-started class on session-dot');
		assert.ok(html.includes('SESSION 3</span>'), 'Should render SESSION 3 without NOT STARTED YET suffix');
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

	it('renders status indicator spinner when reportUpdateStatus is updating', () => {
		const metrics: SessionMetrics = {
			critical: 1,
			high: 0,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 0,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
			},
			reportUpdateStatus: 'updating',
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('report-status-updating'), 'Should include report-status-updating class');
		assert.ok(html.includes('report-status-spinner'), 'Should include spinner element');
		assert.ok(html.includes('Updating Full Report records...'), 'Should render Updating Full Report records... label');
		assert.ok(!html.includes('✓ Full Report updated'), 'Should not render updated label while updating');
	});

	it('renders updated status indicator when reportUpdateStatus is updated', () => {
		const metrics: SessionMetrics = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 0,
				improvingTrends: 0,
				resolvedThisSession: 1,
				recurringPatterns: 0,
			},
			reportUpdateStatus: 'updated',
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('report-status-updated'), 'Should include report-status-updated class');
		assert.ok(html.includes('✓ Full Report updated'), 'Should render ✓ Full Report updated label');
		assert.ok(!html.includes('Updating Full Report records...'), 'Should not render updating label when updated');
	});

	it('renders per-save resolution progress counter in Trends when pendingResolutions are present', () => {
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
				pendingResolutions: [
					{
						type: 'SQL Injection',
						cweId: 'CWE-89',
						instanceName: 'executeQuery',
						savesCompleted: 1,
						savesRequired: 3,
					},
					{
						type: 'Cross-Site Scripting',
						cweId: 'CWE-79',
						savesCompleted: 2,
						savesRequired: 3,
					},
				],
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('pending-resolutions-section'), 'Should render pending-resolutions-section');
		assert.ok(html.includes('Confirming Resolution'), 'Should render Confirming Resolution header');
		assert.ok(html.includes('SQL Injection'), 'Should render SQL Injection pending item');
		assert.ok(html.includes('executeQuery'), 'Should render instanceName when provided');
		assert.ok(html.includes('Save 1/3'), 'Should render Save 1/3 step counter');
		assert.ok(html.includes('2 saves left'), 'Should render 2 saves left guidance');
		assert.ok(html.includes('Cross-Site Scripting'), 'Should render Cross-Site Scripting pending item');
		assert.ok(html.includes('Save 2/3'), 'Should render Save 2/3 step counter');
		assert.ok(html.includes('1 save left'), 'Should render 1 save left guidance');
	});

	it('groups same-type same-step pending resolutions and sorts closest-to-confirmed first', () => {
		const mk = (type: string, savesCompleted: 0 | 1 | 2, instanceName: string) => ({
			type, cweId: 'CWE-X', instanceName, savesCompleted, savesRequired: 3 as const,
		});
		const metrics: SessionMetrics = {
			critical: 0, high: 0, medium: 0, low: 0,
			trends: {
				persistingPatterns: 0, improvingTrends: 0, resolvedThisSession: 0, recurringPatterns: 0,
				pendingResolutions: [
					mk('SQL Injection', 1, 'a'),
					mk('SQL Injection', 1, 'b'),
					mk('SQL Injection', 1, 'c'),
					mk('Insecure Randomness', 2, 'r'),
				],
			},
		};
		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('Confirming Resolution (4)'), 'Header should show total pending count');
		assert.ok(html.includes('(3 instances)'), 'Same type/step should collapse into one row');
		assert.strictEqual(html.match(/class="pending-resolution-row"/g)?.length, 2, 'Should render 2 grouped rows');
		assert.ok(
			html.indexOf('Insecure Randomness') < html.indexOf('SQL Injection'),
			'Save 2/3 row should be sorted above Save 1/3 row',
		);
	});
});
