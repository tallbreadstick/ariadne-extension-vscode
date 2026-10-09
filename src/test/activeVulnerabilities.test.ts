import * as assert from 'assert';
import {
	buildActiveVulnerabilitiesHtml,
	determineNextFocus,
} from '../modules/presentation/views/activeVulnerabilities.js';
import type { Vulnerability } from '../modules/presentation/panelTypes.js';

const sample: Vulnerability[] = [
	{
		id: 'v-1',
		severity: 'critical',
		cwe: 'CWE-89',
		owaspRef: 'A03:2021',
		title: 'SQL Injection',
		description: 'Query built from request input.',
		filePath: 'src/db/Query.java',
		line: 20,
	},
	{
		id: 'v-2',
		severity: 'medium',
		cwe: 'CWE-79',
		owaspRef: 'A03:2021',
		title: 'XSS',
		description: 'Unescaped output.',
		filePath: 'src/web/Page.java',
		line: 8,
	},
];

describe('Active Vulnerabilities filter menu', () => {
	it('renders a filter menu with category, type, severity, and reset (omitting CWE and file)', () => {
		const html = buildActiveVulnerabilitiesHtml(sample, { signedIn: true });

		assert.ok(html.includes('id="filter-menu"'));
		assert.ok(html.includes('id="reset-filters-btn"'));
		assert.match(html, /Reset filters/i);
		assert.ok(html.includes('id="category-filter"'));
		assert.ok(!html.includes('id="cwe-filter"'), 'CWE filter should be omitted');
		assert.ok(html.includes('id="type-filter"'));
		assert.ok(!html.includes('id="file-filter"'), 'File filter should be omitted since search covers file paths');
		assert.ok(!html.includes('id="severity-hint"'), 'Severity label indicator in top right should be removed');
		assert.ok(html.includes('data-severity="critical"'));
		assert.ok(html.includes('severity-chip'));
		assert.ok(html.includes('Injection'), 'Category dropdown should display readable category name');
		assert.ok(html.includes('SQL Injection'));
		assert.ok(html.includes('src/db/Query.java'));
	});

	it('puts category and type on each card for structured filtering', () => {
		const html = buildActiveVulnerabilitiesHtml(sample, { signedIn: true });
		assert.ok(html.includes('data-category="A03:2021"'));
		assert.ok(html.includes('data-type="SQL Injection"'));
		assert.ok(html.includes('data-file="src/db/Query.java"'));
	});

	it('omits search bar and renders button-shaped severity checkboxes with no redundant clear buttons', () => {
		const html = buildActiveVulnerabilitiesHtml(sample, { signedIn: true });
		assert.ok(!html.includes('id="vuln-search"'), 'Search input should be completely removed');
		assert.ok(!html.includes('id="search-clear-btn"'), 'Search clear button should be removed');
		assert.ok(html.includes('severity-check'), 'Severity checkbox missing');
		assert.ok(html.includes('role="checkbox"'), 'Severity checkbox role missing');
		assert.ok(!html.includes('id="quick-clear-btn"'), 'Quick clear button should be removed');
		assert.ok(!html.includes('id="active-filter-bar"'), 'Active filter bar should be removed');
		assert.ok(!html.includes('id="empty-clear-btn"'), 'Empty clear button should be removed');
	});

	it('renders clean sticky header and "Explain Vulnerability" button with lightbulb icon', () => {
		const html = buildActiveVulnerabilitiesHtml(sample, { signedIn: true });
		assert.ok(html.includes('live-scan-header') || html.includes('active-vuln-header'), 'Sticky header missing');
		assert.ok(html.includes('Live Scan'), 'Live Scan header title missing');
		assert.ok(!html.includes('id="total-vuln-badge"'), 'Total badge pill should be removed');
		assert.ok(html.includes('btn-explain'), 'Explain Vulnerability button class missing');
		assert.ok(html.includes('Explain Vulnerability'), 'Explain Vulnerability button label missing');
		assert.ok(html.includes('lightbulb-icon'), 'Lightbulb icon missing');
		assert.ok(!html.includes('Ask Ariadne</span>'), 'Ask Ariadne label should be replaced');
	});
});

describe('Next Focus Recommendation Engine', () => {
	it('prioritizes recurring Common Vulnerability habits over higher-severity non-common findings', () => {
		const vulns: Vulnerability[] = [
			{
				id: 'v-1',
				severity: 'critical',
				cwe: 'CWE-89',
				owaspRef: 'A03:2021',
				title: 'SQL Injection',
				description: 'Raw SQL query.',
				filePath: 'src/db/Query.java',
				line: 12,
			},
			{
				id: 'v-2',
				severity: 'high',
				cwe: 'CWE-798',
				owaspRef: 'A07:2021',
				title: 'Hardcoded Credentials',
				description: 'Hardcoded API secret.',
				filePath: 'src/auth/Keys.java',
				line: 45,
			},
		];

		// If Hardcoded Credentials is the recurring habit
		const target = determineNextFocus(vulns, ['Hardcoded Credentials']);
		assert.ok(target !== null);
		assert.strictEqual(target.vuln.title, 'Hardcoded Credentials');
		assert.strictEqual(target.isCommonHabit, true);
		assert.strictEqual(target.reason, 'Recurring Habit');
	});

	it('falls back to highest severity when no common habit matches', () => {
		const target = determineNextFocus(sample, []);
		assert.ok(target !== null);
		assert.strictEqual(target.vuln.title, 'SQL Injection');
		assert.strictEqual(target.isCommonHabit, false);
		assert.strictEqual(target.reason, 'Critical Priority');
	});

	it('returns null when there are no active vulnerabilities', () => {
		assert.strictEqual(determineNextFocus([]), null);
	});
});

describe('Session Progress Bar & Victory State', () => {
	it('renders animated session progress bar with resolved count and percentage', () => {
		const html = buildActiveVulnerabilitiesHtml(sample, {
			signedIn: true,
			resolvedCount: 2,
		});

		assert.ok(html.includes('class="session-progress-card"'), 'Progress card missing');
		assert.ok(html.includes('Session Progress:'), 'Progress title missing');
		assert.ok(html.includes('2 of 4'), 'Resolved of total count missing');
		assert.ok(html.includes('50%'), 'Percentage calculation missing');
		assert.ok(html.includes('next-focus-chip'), 'Next focus chip missing');
		assert.ok(html.includes('Next Focus:'), 'Next focus label missing');
		assert.ok(html.includes('focus-icon'), 'Focus SVG icon missing');
		assert.ok(html.includes('class="progress-icon"'), 'Progress SVG icon missing');
		assert.ok(!html.includes('🎯'), 'Emoji 🎯 should not be present');
		assert.ok(!html.includes('⚡'), 'Emoji ⚡ should not be present');
		assert.ok(!html.includes('class="focus-loc"'), 'File path should not be displayed in next focus chip');
		assert.ok(!html.includes('focus-arrow'), 'Arrow icon should not be present in next focus chip');
		assert.ok(!html.includes('→'), 'Arrow character should not be present in next focus chip');
		assert.ok(html.includes('class="next-focus-chip critical"'), 'Next focus chip should have severity class');
		assert.ok(!html.includes('class="focus-badge"'), 'Explicit severity badge should be removed from chip');
		assert.ok(html.includes('Critical Risk — Address'), 'Tooltip should be urgent and actionable');
	});

	it('renders victory state when all issues tracked in session are resolved', () => {
		const html = buildActiveVulnerabilitiesHtml([], {
			signedIn: true,
			resolvedCount: 3,
		});

		assert.ok(html.includes('class="session-progress-card victory"'), 'Victory card missing');
		assert.ok(html.includes('All 3 Vulnerabilities Resolved! Workspace is Clean!'));
		assert.ok(html.includes('100%'));
		assert.ok(html.includes('class="progress-icon victory-icon"'), 'Victory SVG icon missing');
		assert.ok(!html.includes('🏆'), 'Emoji 🏆 should not be present');
	});

	it('honors totalSessionIssues to maintain stable denominator during transitions', () => {
		const html = buildActiveVulnerabilitiesHtml(sample, {
			signedIn: true,
			resolvedCount: 1,
			totalSessionIssues: 32,
		});

		assert.ok(html.includes('1 of 32'), 'Expected 1 of 32 to honor totalSessionIssues');
		assert.ok(html.includes('3%'), 'Expected 3%');
	});

	it('omits session progress card when there are no issues and no resolutions', () => {
		const html = buildActiveVulnerabilitiesHtml([], {
			signedIn: true,
			resolvedCount: 0,
		});

		assert.ok(!html.includes('class="session-progress-card"'), 'Progress card should be omitted');
	});
});

