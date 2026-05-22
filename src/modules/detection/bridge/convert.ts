/**
 * Converters from the flat VulnerabilityMetadata emitted by the Rust
 * SAST engine to the two UI-facing type shapes used by the extension:
 *
 * 1. `Vulnerability`   — presentation/mock/types.ts  (active-vulns panel)
 * 2. `AriadneFinding`  — presentation/diagnostics/types.ts (inline highlights)
 * 3. `ScanSnapshot`    — feedback/vulnerability_results/vulnerabilityTypes.ts
 *                        (session-metrics tracker)
 */

import type { Vulnerability as PanelVulnerability } from '../../presentation/mock/types.js';
import type { AriadneFinding } from '../../presentation/diagnostics/types.js';
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
 */
export function metadataToAriadneFinding(
	m: VulnerabilityMetadata,
	idx: number,
): AriadneFinding {
	const line0 = Math.max(0, m.line_number - 1);
	const sev = capitalize(m.severity) as AriadneFinding['severity'];

	return {
		id: `engine-finding-${idx}`,
		vulnerabilityName: m.type,
		severity: sev,
		cweId: m.cwe_id,
		owaspCategory: m.owasp_category,
		shortExplanation: m.description ?? m.type,
		filePath: m.file_path,
		startLine: line0,
		startColumn: 0,
		endLine: line0,
		endColumn: 999,
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
 *   Level 2  Instance       — by instance_name (falls back to file:line)
 *   Level 3  Occurrence     — one per flat finding
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

		// Group within a vulnerability by instance_name → Instance[]
		const instanceMap = new Map<string, VulnerabilityMetadata[]>();
		for (const item of items) {
			const iKey = item.instance_name ?? `${item.file_path}:${item.line_number}`;
			const existing = instanceMap.get(iKey) ?? [];
			existing.push(item);
			instanceMap.set(iKey, existing);
		}

		const instances: Instance[] = [];
		for (const [iName, iItems] of instanceMap) {
			const occurrences: Occurrence[] = iItems.map((item) => ({
				file_path: item.file_path,
				line_number: item.line_number,
				column_number: item.column_number,
				taint_trace: item.taint_trace,
			}));
			instances.push({
				name: iName,
				kind: (iItems[0].instance_kind ?? 'variable') as Instance['kind'],
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

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Returns the file name portion of an absolute path. */
function shortPath(p: string): string {
	return p.replace(/\\/g, '/').split('/').at(-1) ?? p;
}
