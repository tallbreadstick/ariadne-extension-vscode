/**
 * Client-side filter state for the Active Vulnerabilities list.
 */

import type { Severity, Vulnerability } from '../panelTypes.js';

export interface VulnListFilter {
	query: string;
	/** Empty means every severity. Multiple values are OR'd. */
	severities: readonly Severity[];
	/** OWASP category (`owaspRef`). Empty means every category. */
	category: string;
	cwe: string;
	/** Vulnerability title / type. Empty means every type. */
	type: string;
	file: string;
}

export interface VulnFilterFacets {
	categories: string[];
	cwes: string[];
	types: string[];
	files: string[];
}

export function emptyVulnListFilter(): VulnListFilter {
	return {
		query: '',
		severities: [],
		category: '',
		cwe: '',
		type: '',
		file: '',
	};
}

export function isVulnFilterActive(filter: VulnListFilter): boolean {
	return Boolean(
		filter.query.trim()
		|| filter.severities.length > 0
		|| filter.category
		|| filter.cwe
		|| filter.type
		|| filter.file,
	);
}

export function countActiveVulnFilters(filter: VulnListFilter): number {
	let count = 0;
	if (filter.query.trim()) {
		count += 1;
	}
	if (filter.severities.length > 0) {
		count += 1;
	}
	if (filter.category) {
		count += 1;
	}
	if (filter.cwe) {
		count += 1;
	}
	if (filter.type) {
		count += 1;
	}
	if (filter.file) {
		count += 1;
	}
	return count;
}

function uniqueSorted(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function collectVulnFilterFacets(vulns: readonly Vulnerability[]): VulnFilterFacets {
	return {
		categories: uniqueSorted(vulns.map((v) => v.owaspRef ?? '')),
		cwes: uniqueSorted(vulns.map((v) => v.cwe)),
		types: uniqueSorted(vulns.map((v) => v.title)),
		files: uniqueSorted(vulns.map((v) => v.filePath)),
	};
}

/**
 * Search matches title and file path only. Structured filters AND together.
 * Selected severities OR together.
 */
export function matchesVulnListFilter(
	vuln: Vulnerability,
	filter: VulnListFilter,
): boolean {
	if (filter.severities.length > 0 && !filter.severities.includes(vuln.severity)) {
		return false;
	}
	if (filter.category && (vuln.owaspRef ?? '') !== filter.category) {
		return false;
	}
	if (filter.cwe && vuln.cwe !== filter.cwe) {
		return false;
	}
	if (filter.type && vuln.title !== filter.type) {
		return false;
	}
	if (filter.file && vuln.filePath !== filter.file) {
		return false;
	}

	const query = filter.query.trim().toLowerCase();
	if (query) {
		const haystack = `${vuln.title} ${vuln.filePath}`.toLowerCase();
		if (!haystack.includes(query)) {
			return false;
		}
	}

	return true;
}
