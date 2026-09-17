import * as assert from 'assert';
import type { Vulnerability } from '../modules/presentation/panelTypes.js';
import {
	collectVulnFilterFacets,
	countActiveVulnFilters,
	emptyVulnListFilter,
	formatCategoryLabel,
	isVulnFilterActive,
	matchesVulnListFilter,
} from '../modules/presentation/views/vulnFilters.js';

function vuln(overrides: Partial<Vulnerability>): Vulnerability {
	return {
		id: 'v-1',
		severity: 'high',
		cwe: 'CWE-89',
		owaspRef: 'A03:2021',
		title: 'SQL Injection',
		description: 'Untrusted input reaches a query.',
		filePath: 'src/db/Query.java',
		line: 12,
		...overrides,
	};
}

describe('Vuln list filters', () => {
	it('matches everything when the filter is empty', () => {
		assert.ok(matchesVulnListFilter(vuln({}), emptyVulnListFilter()));
	});

	it('does not search description, CWE, or OWASP text', () => {
		const finding = vuln({});
		assert.ok(!matchesVulnListFilter(finding, {
			...emptyVulnListFilter(),
			query: 'untrusted',
		}));
		assert.ok(!matchesVulnListFilter(finding, {
			...emptyVulnListFilter(),
			query: 'cwe-89',
		}));
		assert.ok(!matchesVulnListFilter(finding, {
			...emptyVulnListFilter(),
			query: 'a03',
		}));
	});

	it('searches title and file path', () => {
		const finding = vuln({});
		assert.ok(matchesVulnListFilter(finding, {
			...emptyVulnListFilter(),
			query: 'sql',
		}));
		assert.ok(matchesVulnListFilter(finding, {
			...emptyVulnListFilter(),
			query: 'query.java',
		}));
	});

	it('ORs selected severities and ANDs other dimensions', () => {
		const sql = vuln({ severity: 'critical', title: 'SQL Injection' });
		const xss = vuln({
			id: 'v-2',
			severity: 'high',
			cwe: 'CWE-79',
			owaspRef: 'A03:2021',
			title: 'XSS',
			filePath: 'src/web/Page.java',
		});

		assert.ok(matchesVulnListFilter(sql, {
			...emptyVulnListFilter(),
			severities: ['critical', 'high'],
		}));
		assert.ok(matchesVulnListFilter(xss, {
			...emptyVulnListFilter(),
			severities: ['critical', 'high'],
		}));
		assert.ok(!matchesVulnListFilter(xss, {
			...emptyVulnListFilter(),
			severities: ['critical', 'high'],
			cwe: 'CWE-89',
		}));
	});

	it('filters by category, CWE, type, and file', () => {
		const finding = vuln({});
		assert.ok(matchesVulnListFilter(finding, { ...emptyVulnListFilter(), category: 'A03:2021' }));
		assert.ok(!matchesVulnListFilter(finding, { ...emptyVulnListFilter(), category: 'A01:2021' }));
		assert.ok(matchesVulnListFilter(finding, { ...emptyVulnListFilter(), cwe: 'CWE-89' }));
		assert.ok(matchesVulnListFilter(finding, { ...emptyVulnListFilter(), type: 'SQL Injection' }));
		assert.ok(matchesVulnListFilter(finding, { ...emptyVulnListFilter(), file: 'src/db/Query.java' }));
		assert.ok(!matchesVulnListFilter(finding, { ...emptyVulnListFilter(), file: 'other.java' }));
	});

	it('collects unique sorted facets', () => {
		const facets = collectVulnFilterFacets([
			vuln({ title: 'XSS', cwe: 'CWE-79', filePath: 'b.java' }),
			vuln({ title: 'SQL Injection', cwe: 'CWE-89', filePath: 'a.java' }),
			vuln({ title: 'SQL Injection', cwe: 'CWE-89', filePath: 'a.java' }),
		]);
		assert.deepStrictEqual(facets.cwes, ['CWE-79', 'CWE-89']);
		assert.deepStrictEqual(facets.types, ['SQL Injection', 'XSS']);
		assert.deepStrictEqual(facets.files, ['a.java', 'b.java']);
		assert.deepStrictEqual(facets.categories, ['A03:2021']);
	});

	it('counts active filter dimensions', () => {
		assert.strictEqual(countActiveVulnFilters(emptyVulnListFilter()), 0);
		assert.ok(!isVulnFilterActive(emptyVulnListFilter()));
		assert.strictEqual(countActiveVulnFilters({
			...emptyVulnListFilter(),
			query: 'sql',
			severities: ['high'],
			cwe: 'CWE-89',
		}), 3);
	});

	it('formats OWASP category labels without code prefixes', () => {
		assert.strictEqual(formatCategoryLabel('A01-2021; broken access control'), 'broken access control');
		assert.strictEqual(formatCategoryLabel('A01:2021-Broken Access Control'), 'Broken Access Control');
		assert.strictEqual(formatCategoryLabel('A03:2021'), 'Injection');
		assert.strictEqual(formatCategoryLabel('A05:2021 - Security Misconfiguration'), 'Security Misconfiguration');
		assert.strictEqual(formatCategoryLabel(''), '');
	});
});

