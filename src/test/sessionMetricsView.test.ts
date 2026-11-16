import * as assert from 'assert';
import { buildSessionMetricsHtml } from '../modules/tracker/views/sessionMetrics.js';
import type { SessionMetrics } from '../modules/presentation/panelTypes.js';

describe('Session Metrics Terminology & Subtitles', () => {
	it('uses "reports" terminology rather than "Full scan"', () => {
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
		assert.ok(html.includes('Compares reports'), 'Should use reports terminology');
		assert.ok(!html.includes('Full scan'), 'Should not render "Full scan"');
		assert.ok(!html.includes('class="full-report-section"'), 'Should omit Full Report severity section in compact sidebar');
	});

	it('renders persisting pill beside vulnerability name in Persisting Patterns sub-items', () => {
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
						subtitle: 'Across 3 reports',
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
		assert.ok(html.includes('title="Across 3 reports"'), 'Custom subtitle should be displayed on hover');
		assert.ok(html.includes('Command Injection'));
		assert.ok(html.includes('title="Across 4 reports"'), 'Computed reportCount subtitle should be displayed on hover');
		assert.ok(html.includes('Mutable Reference'));
		assert.ok(html.includes('title="Across 2 reports"'), 'Default subtitle should be displayed on hover');
		assert.ok(html.includes('persisting-report-circle'), 'CSS class for persisting report circle should be present');
		assert.ok(
			/<span class="sub-label-group">[\s\S]*?<span class="persisting-report-circle" title="Across 4 reports"[^>]*>4<\/span>[\s\S]*?<span class="sub-label" title="Command Injection">Command Injection<\/span>[\s\S]*?<\/span>[\s\S]*?<span class="sub-count">1<\/span>/.test(html),
			'Persisting report circle should sit on the left of the vulnerability label before the instance count',
		);
		assert.ok(!html.includes('<span class="commented-out-badge"'), 'Commented out pill must not render when commentedOutCount is absent');
	});

	it('renders Commented out pill in Persisting Patterns when commentedOutCount > 0', () => {
		const metrics: SessionMetrics = {
			critical: 0,
			high: 2,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 3,
				improvingTrends: 0,
				resolvedThisSession: 0,
				recurringPatterns: 0,
				persistingItems: [
					{
						type: 'SQL Injection',
						instances: 1,
						reportCount: 2,
						commentedOutCount: 1,
					},
					{
						type: 'Cross-Site Scripting',
						instances: 2,
						reportCount: 3,
						commentedOutCount: 1,
					},
				],
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('commented-out-badge'), 'Should render commented-out-badge class');
		assert.ok(html.includes('>Commented out<'), 'All-commented item should render "Commented out"');
		assert.ok(html.includes('>1 commented out<'), 'Partially-commented item should render "1 commented out"');
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

	it('renders session badge inside Full Report status row with active and not-started states', () => {
		const notStarted: SessionMetrics = {
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
			isSessionActive: false,
		};

		const notStartedHtml = buildSessionMetricsHtml(notStarted, { signedIn: true });
		assert.ok(notStartedHtml.includes('session-badge not-started'), 'Should include not-started badge');
		assert.ok(notStartedHtml.includes('SESSION 2</span>'), 'Should render concise SESSION 2 label without NOT STARTED YET suffix');
		assert.ok(!notStartedHtml.includes('NOT STARTED YET'));

		const activeHtml = buildSessionMetricsHtml({ ...notStarted, isSessionActive: true }, { signedIn: true });
		assert.ok(activeHtml.includes('class="session-badge"'), 'Should render active session badge');
		assert.ok(activeHtml.includes('SESSION 2</span>'), 'Should render active SESSION 2 label');
		assert.ok(!activeHtml.includes('NOT STARTED YET'));
		assert.ok(activeHtml.includes('class="trend-header-text"'), 'Should use stacked trend header text for narrow sidebar');
		assert.ok(activeHtml.includes('class="trend-count-badge"'), 'Should use compact count badge beside chevron');
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

		// Compact inline severity text badges should appear in Full Report section above Trends
		assert.ok(html.includes('severity-status-section'), 'Should render Full Report container');
		assert.ok(html.includes('<span>Full Report</span>'), 'Should render Full Report header');
		assert.ok(html.includes('severity-badges-bar'), 'Should render compact severity badges bar');
		assert.ok(html.includes('severity-text-badge'), 'Should render inline severity text badges');
		assert.ok(html.includes('filterable-metric-card'), 'Should include filterable-metric-card class');
		assert.ok(html.includes('data-severity="critical"'), 'Should include data-severity attribute');
		assert.ok(html.indexOf('class="severity-status-section"') < html.indexOf('class="trends-card"'), 'Full Report section should appear above Trends');
		assert.ok(html.includes('id="open-settings-btn"'), 'Should render settings gear button in Full Report header');
		assert.ok(
			/<div class="severity-status-header-row">[\s\S]*?Full Report[\s\S]*?id="open-settings-btn"[\s\S]*?Settings[\s\S]*?<\/div>/.test(html),
			'Gear button with Settings label should sit on the right of Full Report header inside severity-status-header-row',
		);

		// Sub-item and common vulnerability cards should still be filterable
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
		assert.ok(html.includes('Updating...'), 'Should render concise Updating... label');
		assert.ok(!html.includes('Updated</span>'), 'Should not render updated label while updating');
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
		assert.ok(html.includes('Updated</span>'), 'Should render concise Updated label');
		assert.ok(!html.includes('Updating...'), 'Should not render updating label when updated');
		assert.ok(
			html.indexOf('class="severity-status-section"') < html.indexOf('class="report-status-indicator report-status-updated"')
				&& html.indexOf('class="report-status-indicator report-status-updated"') < html.indexOf('class="trends-card"'),
			'Full Report status indicator should sit inside the Status section above Trends',
		);
	});

	it('renders idle Full Report status indicator by default in Status section', () => {
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
			reportUpdateStatus: 'idle',
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('report-status-idle'), 'Should include report-status-idle class');
		assert.ok(html.includes('Hit Save to update'), 'Should render imperative idle Full Report prompt');
		assert.ok(html.includes('class="empty-state-logo"'), 'Should render Ariadne empty-state logo above no session data yet');
	});

	it('dims 0-count trend rows and emphasizes populated trend rows', () => {
		const metrics: SessionMetrics = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			trends: {
				persistingPatterns: 2,
				improvingTrends: 0,
				resolvedThisSession: 1,
				recurringPatterns: 0,
			},
		};

		const html = buildSessionMetricsHtml(metrics, { signedIn: true });
		assert.ok(html.includes('class="trend-group is-populated" data-trend-id="persisting"'), 'Populated persisting row should have is-populated');
		assert.ok(html.includes('class="trend-group is-empty" data-trend-id="improving"'), 'Zero-count improving row should have is-empty');
		assert.ok(html.includes('class="trend-group is-empty" data-trend-id="recurring"'), 'Zero-count recurring row should have is-empty');
		assert.ok(html.includes('class="trend-group is-populated" data-trend-id="resolved"'), 'Populated resolved row should have is-populated');
	});
});
