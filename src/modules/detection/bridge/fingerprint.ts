import { createHash } from 'node:crypto';
import { isAbsolute, relative } from 'node:path';
import type { VulnerabilityMetadata } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';

/** Canonical fingerprint schema version mixed into every hash input. */
export const FINGERPRINT_VERSION = 1;

const ENV_HYGIENE_RULE = 'config.env.not_gitignored';
const CONTROL_PREFIX = /^(?:if|for|while|switch|catch|synchronized|try|do)\s*\(/;

/** Why a finding cannot participate in continuity matching. */
export type IneligibilityReason =
	| 'missing-rule-id'
	| 'missing-snapshot'
	| 'missing-buffer'
	| 'missing-enclosing-path'
	| 'missing-relative-path'
	| 'excluded-project-finding'
	| 'missing-content';

/** Hashes and continuity flags for one scanner finding. */
export interface FindingFingerprint {
	fingerprintVersion: number;
	logicalFingerprint: string;
	contentFingerprint: string;
	scopeFingerprint: string;
	continuityEligible: boolean;
	continuityAmbiguous: boolean;
	ineligibilityReason?: IneligibilityReason;
}

/** Scanner finding paired with its derived fingerprint. */
export interface FingerprintedFinding {
	finding: VulnerabilityMetadata;
	fingerprint: FindingFingerprint;
}

/** Per-scan fingerprint outcomes, including duplicate-continuity-key counts. */
export interface ScanFingerprintResult {
	findings: FingerprintedFinding[];
	ambiguousCount: number;
}

type ScopeFrame = {
	kind: 'class' | 'method';
	name: string;
	bodyDepth: number;
};

/**
 * FIFO of file texts last sent on analysis-triggering IPC.
 * Findings must hash the dequeued snapshot, not the live editor buffer.
 */
export class AnalysisBufferTracker {
	private buffers = new Map<string, string>();
	private queue: Array<ReadonlyMap<string, string>> = [];

	/** Replace the live buffer for `path`. Does not enqueue. */
	recordFile(path: string, content: string): void {
		this.buffers.set(path, content);
	}

	/** Drop a deleted path from the live buffer. Does not enqueue. */
	recordDelete(path: string): void {
		this.buffers.delete(path);
	}

	/** Move a recorded buffer to its new path. Does not enqueue. */
	recordRename(oldPath: string, newPath: string): void {
		const content = this.buffers.get(oldPath);
		this.buffers.delete(oldPath);
		if (content !== undefined) {
			this.buffers.set(newPath, content);
		}
	}

	/** Snapshot current buffers for the analysis that was just requested. */
	enqueueAnalysis(): void {
		this.queue.push(new Map(this.buffers));
	}

	/** Take the oldest queued snapshot. Empty when findings have no matching send. */
	dequeueAnalysis(): ReadonlyMap<string, string> | undefined {
		return this.queue.shift();
	}

	/** Clear live buffers and the unmatched-analysis queue (session restart). */
	reset(): void {
		this.buffers = new Map();
		this.queue = [];
	}
}

/** Workspace-relative POSIX path, or undefined when `filePath` is outside the root. */
export function workspaceRelativePath(filePath: string, workspaceRoot: string): string | undefined {
	if (!filePath || !workspaceRoot) {
		return undefined;
	}
	const rel = relative(workspaceRoot, filePath).replace(/\\/g, '/');
	if (!rel || rel.startsWith('../') || rel === '..' || isAbsolute(rel)) {
		return undefined;
	}
	return rel;
}

/**
 * Heuristic package.class.method path for a 1-based Java line.
 * ponytail: brace-depth scan, not a parser; upgrade if nested types collide.
 */
export function deriveEnclosingSymbolPath(source: string, lineNumber: number): string | undefined {
	if (lineNumber < 1) {
		return undefined;
	}
	const lines = source.split('\n');
	if (lineNumber > lines.length) {
		return undefined;
	}

	const pkg = extractPackage(source);
	const stack: ScopeFrame[] = [];
	let depth = 0;
	let pending: { kind: 'class' | 'method'; name: string } | undefined;
	let enclosingAtTarget: ScopeFrame[] = [];

	for (let i = 0; i < lineNumber; i++) {
		const structural = stripForStructure(lines[i] ?? '');
		if (!pending) {
			const className = matchTypeName(structural);
			if (className) {
				pending = { kind: 'class', name: className };
			} else {
				const methodName = matchMethodName(structural);
				if (methodName) {
					pending = { kind: 'method', name: methodName };
				}
			}
		}

		if (i === lineNumber - 1) {
			enclosingAtTarget = stack.slice();
		}

		for (const ch of structural) {
			if (ch === '{') {
				depth += 1;
				if (pending) {
					stack.push({ kind: pending.kind, name: pending.name, bodyDepth: depth });
					pending = undefined;
				}
				if (i === lineNumber - 1 && stack.length > enclosingAtTarget.length) {
					enclosingAtTarget = stack.slice();
				}
			} else if (ch === '}') {
				while (stack.length > 0 && stack[stack.length - 1].bodyDepth === depth) {
					stack.pop();
				}
				depth = Math.max(0, depth - 1);
			}
		}
	}

	const names = enclosingAtTarget.map((frame) => frame.name);
	if (pkg) {
		names.unshift(pkg);
	}
	if (names.length === 0) {
		return undefined;
	}
	return names.join('.');
}

/**
 * Derive per-finding hashes from scanner metadata plus the queued sent-buffer snapshot.
 * Does not persist source text. Ambiguous continuity keys are marked, not matched.
 */
export function fingerprintScan(
	findings: readonly VulnerabilityMetadata[],
	snapshot: ReadonlyMap<string, string> | undefined,
	workspaceRoot: string,
): ScanFingerprintResult {
	const rows = findings.map((finding) => fingerprintOne(finding, snapshot, workspaceRoot));
	const keyCounts = new Map<string, number>();
	for (const row of rows) {
		if (!row.fingerprint.continuityEligible) {
			continue;
		}
		const key = continuityKey(row.fingerprint);
		keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
	}

	let ambiguousCount = 0;
	const marked = rows.map((row) => {
		if (!row.fingerprint.continuityEligible) {
			return row;
		}
		const duplicate = (keyCounts.get(continuityKey(row.fingerprint)) ?? 0) > 1;
		if (!duplicate) {
			return row;
		}
		ambiguousCount += 1;
		return {
			finding: row.finding,
			fingerprint: {
				...row.fingerprint,
				continuityAmbiguous: true,
			},
		};
	});

	return { findings: marked, ambiguousCount };
}

function fingerprintOne(
	finding: VulnerabilityMetadata,
	snapshot: ReadonlyMap<string, string> | undefined,
	workspaceRoot: string,
): FingerprintedFinding {
	const ruleId = finding.rule_id?.trim() ?? '';
	if (!ruleId) {
		return ineligible(finding, 'missing-rule-id');
	}
	if (ruleId === ENV_HYGIENE_RULE) {
		return ineligible(finding, 'excluded-project-finding');
	}
	if (!snapshot) {
		return ineligible(finding, 'missing-snapshot');
	}

	const source = bufferFor(snapshot, finding.file_path);
	if (source === undefined) {
		return ineligible(finding, 'missing-buffer');
	}

	const relativePath = workspaceRelativePath(finding.file_path, workspaceRoot);
	if (!relativePath) {
		return ineligible(finding, 'missing-relative-path');
	}

	const enclosing = enclosingPathFor(finding, source);
	if (!enclosing) {
		return ineligible(finding, 'missing-enclosing-path');
	}

	const contentCanonical = contentCanonicalString(finding, source);
	if (contentCanonical === undefined) {
		return ineligible(finding, 'missing-content');
	}

	const logicalCanonical = canonicalRecord('logical', [
		['rule_id', ruleId],
		['cwe_id', finding.cwe_id],
		['instance_kind', finding.instance_kind ?? ''],
		['instance_name', finding.instance_name ?? ''],
		['enclosing_symbol_path', enclosing],
	]);
	const scopeCanonical = canonicalRecord('scope', [
		['workspace_relative_file_path', relativePath],
		['enclosing_symbol_path', enclosing],
	]);

	return {
		finding,
		fingerprint: {
			fingerprintVersion: FINGERPRINT_VERSION,
			logicalFingerprint: sha256Hex(logicalCanonical),
			contentFingerprint: sha256Hex(contentCanonical),
			scopeFingerprint: sha256Hex(scopeCanonical),
			continuityEligible: true,
			continuityAmbiguous: false,
		},
	};
}

function enclosingPathFor(finding: VulnerabilityMetadata, source: string): string | undefined {
	if (isPropertiesPath(finding.file_path) || finding.rule_id?.startsWith('config.secrets.') === true) {
		const key = finding.instance_name?.trim();
		return key || undefined;
	}
	return deriveEnclosingSymbolPath(source, finding.line_number);
}

function contentCanonicalString(finding: VulnerabilityMetadata, source: string): string | undefined {
	if (isPropertiesPath(finding.file_path) || finding.rule_id?.startsWith('config.secrets.') === true) {
		const line = lineAt(source, finding.line_number);
		if (line === undefined) {
			return undefined;
		}
		const value = parsePropertyValue(line);
		if (value === undefined) {
			return undefined;
		}
		return canonicalRecord('content config_property_value', [['value', value]]);
	}

	const trace = finding.taint_trace;
	if (trace && trace.origin_line > 0 && trace.sink_line > 0) {
		const origin = normalizeJavaSlice(lineAt(source, trace.origin_line));
		const sink = normalizeJavaSlice(lineAt(source, trace.sink_line));
		if (origin === undefined || sink === undefined) {
			return undefined;
		}
		return canonicalRecord('content taint', [
			['source', origin],
			['sink', sink],
		]);
	}

	const slice = normalizeJavaSlice(lineAt(source, finding.line_number));
	if (slice === undefined) {
		return undefined;
	}
	return canonicalRecord('content java', [['slice', slice]]);
}

function canonicalRecord(kind: string, fields: ReadonlyArray<readonly [string, string]>): string {
	const header = `ariadne-fp v${FINGERPRINT_VERSION} ${kind}`;
	const body = fields.map(([name, payload]) => framedField(name, payload));
	return [header, ...body].join('\n');
}

function framedField(name: string, payload: string): string {
	return `${name}:${Buffer.byteLength(payload, 'utf8')}:${payload}`;
}

function sha256Hex(canonical: string): string {
	return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function continuityKey(fp: FindingFingerprint): string {
	return `${fp.fingerprintVersion}\n${fp.logicalFingerprint}\n${fp.scopeFingerprint}`;
}

function ineligible(finding: VulnerabilityMetadata, reason: IneligibilityReason): FingerprintedFinding {
	return {
		finding,
		fingerprint: {
			fingerprintVersion: FINGERPRINT_VERSION,
			logicalFingerprint: '',
			contentFingerprint: '',
			scopeFingerprint: '',
			continuityEligible: false,
			continuityAmbiguous: false,
			ineligibilityReason: reason,
		},
	};
}

function bufferFor(snapshot: ReadonlyMap<string, string>, filePath: string): string | undefined {
	const direct = snapshot.get(filePath);
	if (direct !== undefined) {
		return direct;
	}
	const normalized = filePath.replace(/\\/g, '/');
	for (const [key, value] of snapshot) {
		if (key.replace(/\\/g, '/') === normalized) {
			return value;
		}
	}
	return undefined;
}

function isPropertiesPath(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, '/');
	return normalized.endsWith('/application.properties') || normalized.endsWith('application.properties');
}

function lineAt(source: string, lineNumber: number): string | undefined {
	if (lineNumber < 1) {
		return undefined;
	}
	return source.split('\n')[lineNumber - 1];
}

function parsePropertyValue(line: string): string | undefined {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
		return undefined;
	}
	const eq = trimmed.indexOf('=');
	const colon = trimmed.indexOf(':');
	let splitAt = -1;
	if (eq === -1) {
		splitAt = colon;
	} else if (colon === -1) {
		splitAt = eq;
	} else {
		splitAt = Math.min(eq, colon);
	}
	if (splitAt <= 0) {
		return undefined;
	}
	return trimmed.slice(splitAt + 1).trim();
}

function normalizeJavaSlice(line: string | undefined): string | undefined {
	if (line === undefined) {
		return undefined;
	}
	const collapsed = stripLineComment(line).replace(/\s+/g, ' ').trim();
	return collapsed === '' ? undefined : collapsed;
}

function stripLineComment(line: string): string {
	let inString = false;
	let inChar = false;
	let escaped = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === '\\' && (inString || inChar)) {
			escaped = true;
			continue;
		}
		if (ch === '"' && !inChar) {
			inString = !inString;
			continue;
		}
		if (ch === "'" && !inString) {
			inChar = !inChar;
			continue;
		}
		if (!inString && !inChar && ch === '/' && line[i + 1] === '/') {
			return line.slice(0, i);
		}
	}
	return line;
}

function stripForStructure(line: string): string {
	return stripLineComment(line)
		.replace(/"(?:\\.|[^"\\])*"/g, '""')
		.replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function extractPackage(source: string): string | undefined {
	const match = source.match(/^\s*package\s+([\w.]+)\s*;/m);
	return match?.[1];
}

function matchTypeName(line: string): string | undefined {
	const match = line.match(/\b(?:class|interface|enum|record)\s+(\w+)/);
	return match?.[1];
}

function matchMethodName(line: string): string | undefined {
	const trimmed = line.trim();
	if (CONTROL_PREFIX.test(trimmed)) {
		return undefined;
	}
	const match = trimmed.match(
		/^(?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)*[\w.<>,\[\]?]+\s+(\w+)\s*\(/,
	);
	return match?.[1];
}
