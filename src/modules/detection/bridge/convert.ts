/**
 * Converters from the flat VulnerabilityMetadata emitted by the Rust
 * SAST engine to the two UI-facing type shapes used by the extension:
 *
 * 1. `Vulnerability`   — presentation/panelTypes.ts  (active-vulns panel)
 * 2. `AriadneFinding`  — presentation/diagnostics/diagnosticTypes.ts (inline highlights)
 * 3. `ScanSnapshot`    — feedback/vulnerability_results/vulnerabilityTypes.ts
 *                        (session-metrics tracker)
 */

import type { Vulnerability as PanelVulnerability } from '../../presentation/panelTypes.js';
import type { AriadneFinding } from '../../presentation/diagnostics/diagnosticTypes.js';
import type {
	VulnerabilityMetadata,
	ScanSnapshot,
	Vulnerability as TrackerVulnerability,
	Instance,
	Occurrence,
} from '../../feedback/vulnerability_results/vulnerabilityTypes.js';

// ── Presentation panel ────────────────────────────────────────────────

/**
 * Maps one flat VulnerabilityMetadata to the card shape used by the
 * Active Vulnerabilities panel.
 */
export function metadataToVulnerability(
	m: VulnerabilityMetadata,
	idx: number,
): PanelVulnerability {
	return {
		id: `vuln-${idx}`,
		severity: m.severity,
		cwe: m.cwe_id,
		owaspRef: m.owasp_category || undefined,
		title: m.type,
		description:
			m.description ??
			`${m.type} detected in ${shortPath(m.file_path)} at line ${m.line_number}.`,
		filePath: m.file_path,
		line: m.line_number,
	};
}

// ── Inline diagnostics ────────────────────────────────────────────────

/**
 * Maps one flat VulnerabilityMetadata to the AriadneFinding shape used
 * by DiagnosticManager for inline squiggles and hover popups.
 *
 * Line numbers from the engine are 1-based; VS Code ranges are 0-based.
 * `start_column` / `end_column` are already 0-based byte offsets.
 */
export function metadataToAriadneFinding(
	m: VulnerabilityMetadata,
	idx: number,
): AriadneFinding {
	const line0 = Math.max(0, m.line_number - 1);
	const sev = capitalize(m.severity) as AriadneFinding['severity'];
	const startCol = startColumn0(m);
	const endLine = m.end_line !== undefined ? Math.max(0, m.end_line - 1) : line0;

	return {
		id: `engine-finding-${idx}`,
		vulnerabilityName: m.type,
		severity: sev,
		cweId: m.cwe_id,
		owaspCategory: m.owasp_category,
		shortExplanation: m.description ?? m.type,
		filePath: m.file_path,
		startLine: line0,
		startColumn: startCol,
		endLine,
		endColumn: m.end_column ?? 999,
		taintPath: m.taint_trace
			? {
				originLine: m.taint_trace.origin_line,
				sinkLine: m.taint_trace.sink_line,
			}
			: undefined,
	};
}

/**
 * Groups a flat array of findings by their file path.
 * Returns a Map<absoluteFilePath, AriadneFinding[]>.
 */
export function groupFindingsByFile(
	findings: VulnerabilityMetadata[],
): Map<string, AriadneFinding[]> {
	const byFile = new Map<string, AriadneFinding[]>();
	findings.forEach((m, idx) => {
		const f = metadataToAriadneFinding(m, idx);
		const existing = byFile.get(m.file_path) ?? [];
		existing.push(f);
		byFile.set(m.file_path, existing);
	});
	return byFile;
}

// ── Session tracker (3-layer hierarchy) ───────────────────────────────

/**
 * Converts a flat VulnerabilityMetadata[] from a single analysis run
 * into a ScanSnapshot for the session-metrics tracker.
 *
 * Grouping strategy:
 *   Level 1  Vulnerability  — by (cwe_id + type)
 *   Level 2  Instance       — by instance_fingerprint, then composed
 *                             hashes, then enclosing path / name / file:line
 *   Level 3  Occurrence     — one per flat finding, carrying fingerprints
 */
export function metadataToScanSnapshot(
	findings: VulnerabilityMetadata[],
	scanId: string,
): ScanSnapshot {
	// Group flat findings → Vulnerability[] (3-layer)
	const vulnMap = new Map<string, VulnerabilityMetadata[]>();
	for (const f of findings) {
		const key = `${f.cwe_id}::${f.type}`;
		const existing = vulnMap.get(key) ?? [];
		existing.push(f);
		vulnMap.set(key, existing);
	}

	const vulnerabilities: TrackerVulnerability[] = [];

	for (const items of vulnMap.values()) {
		const first = items[0];

		// Group within a vulnerability by durable identity → Instance[]
		const instanceMap = new Map<string, VulnerabilityMetadata[]>();
		for (const item of items) {
			const iKey = instanceGroupKey(item);
			const existing = instanceMap.get(iKey) ?? [];
			existing.push(item);
			instanceMap.set(iKey, existing);
		}

		const instances: Instance[] = [];
		for (const [, iItems] of instanceMap) {
			const firstItem = iItems[0];
			const occurrences: Occurrence[] = iItems.map((item) => ({
				file_path: item.file_path,
				line_number: item.line_number,
				column_number: item.column_number,
				taint_trace: item.taint_trace,
				enclosing_symbol_path: item.enclosing_symbol_path,
				start_column: item.start_column,
				end_column: item.end_column,
				end_line: item.end_line,
				fingerprint_version: item.fingerprint_version,
				logical_fingerprint: item.logical_fingerprint,
				scope_fingerprint: item.scope_fingerprint,
				content_fingerprint: item.content_fingerprint,
				instance_fingerprint: item.instance_fingerprint,
			}));
			instances.push({
				name: firstItem.instance_name
					?? firstItem.enclosing_symbol_path
					?? `${firstItem.file_path}:${firstItem.line_number}`,
				kind: (firstItem.instance_kind ?? 'variable') as Instance['kind'],
				occurrences,
			});
		}

		vulnerabilities.push({
			type: first.type,
			cwe_id: first.cwe_id,
			owasp_category: first.owasp_category,
			severity: first.severity as TrackerVulnerability['severity'],
			rule_id: first.rule_id,
			instances,
		});
	}

	return { scan_id: scanId, timestamp: Date.now(), vulnerabilities };
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Columns from the current engine are 0-based byte offsets (`start_column`).
 * Older payloads may only send `column_number`; those without
 * `fingerprint_version` are treated as 1-based.
 */
function startColumn0(m: VulnerabilityMetadata): number {
	if (m.start_column !== undefined) {
		return m.start_column;
	}
	if (m.column_number === undefined) {
		return 0;
	}
	if (m.fingerprint_version !== undefined) {
		return m.column_number;
	}
	return Math.max(0, m.column_number - 1);
}

/**
 * Group tracker instances by durable identity so inserting blank lines
 * does not split one finding into a new instance.
 */
function instanceGroupKey(item: VulnerabilityMetadata): string {
	if (item.instance_fingerprint) {
		return item.instance_fingerprint;
	}
	if (item.logical_fingerprint && item.scope_fingerprint && item.content_fingerprint) {
		return `${item.logical_fingerprint}:${item.scope_fingerprint}:${item.content_fingerprint}`;
	}
	return item.logical_fingerprint
		?? item.enclosing_symbol_path
		?? item.instance_name
		?? `${item.file_path}:${item.line_number}`;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Returns the file name portion of an absolute path. */
function shortPath(p: string): string {
	return p.replace(/\\/g, '/').split('/').at(-1) ?? p;
}
