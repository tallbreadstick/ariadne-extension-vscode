import * as assert from 'assert';
import { buildActiveVulnerabilitiesHtml } from '../modules/presentation/views/activeVulnerabilities.js';
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

	it('renders search clear and button-shaped severity checkboxes with no redundant clear buttons', () => {
		const html = buildActiveVulnerabilitiesHtml(sample, { signedIn: true });
		assert.ok(html.includes('id="search-clear-btn"'), 'Search clear button missing');
		assert.ok(html.includes('severity-check'), 'Severity checkbox missing');
		assert.ok(html.includes('role="checkbox"'), 'Severity checkbox role missing');
		assert.ok(!html.includes('id="quick-clear-btn"'), 'Quick clear button should be removed');
		assert.ok(!html.includes('id="active-filter-bar"'), 'Active filter bar should be removed');
		assert.ok(!html.includes('id="empty-clear-btn"'), 'Empty clear button should be removed');
	});
});
