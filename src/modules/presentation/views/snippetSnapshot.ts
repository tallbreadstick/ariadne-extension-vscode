/**
 * Paints audit-graph snippets with the same colors, vulnerability wash,
 * and end-of-line labels the editor is using.
 *
 * Token colors come from the active color theme and from
 * editor.tokenColorCustomizations / editor.semanticTokenColorCustomizations.
 * When the language server answers in time, its semantic tokens replace the
 * Java fallback on those spans. Ariadne's highlight is the same background
 * wash DiagnosticManager paints behind the glyphs. Error Lens messages are
 * added when that extension is installed and enabled.
 */

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import * as vscode from 'vscode';

import { resolveWorkspaceFsPath } from '../../detection/bridge/convert.js';
import type { AriadneFinding } from '../diagnostics/diagnosticTypes.js';
import { SEVERITY_BG_TITLE, SEVERITY_COLORS_TITLE } from '../severityColors.js';
import type { AuditGraph } from './treeViewPanel.js';

export interface SnippetPaint {
	blocks: Record<string, string>;
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	variable: string;
}

type Kind =
	| 'plain'
	| 'keyword'
	| 'control'
	| 'string'
	| 'comment'
	| 'number'
	| 'type'
	| 'function'
	| 'variable'
	| 'parameter'
	| 'property'
	| 'annotation';

interface Palette {
	keyword: string;
	control: string;
	string: string;
	comment: string;
	number: string;
	type: string;
	function: string;
	variable: string;
	parameter: string;
	property: string;
	annotation: string;
}

interface TokenRule {
	scopes: string[];
	foreground?: string;
}

interface Span {
	line: number;
	start: number;
	length: number;
	type: number;
	mod: number;
}

const CONTROL = new Set([
	'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'return',
	'break', 'continue', 'throw', 'try', 'catch', 'finally', 'new', 'instanceof',
	'assert', 'yield',
]);
const MODIFIER = new Set([
	'public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized',
	'native', 'transient', 'volatile', 'strictfp', 'sealed', 'non-sealed',
]);
const PRIMITIVE = new Set([
	'void', 'boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double',
]);
const KEYWORD = new Set([
	...CONTROL, ...MODIFIER, ...PRIMITIVE,
	'class', 'interface', 'enum', 'extends', 'implements', 'import', 'package',
	'this', 'super', 'throws', 'const', 'goto', 'var', 'record', 'permits', 'while',
]);

const TOKEN_TYPES = [
	'namespace', 'class', 'enum', 'interface', 'struct', 'typeParameter', 'type',
	'parameter', 'variable', 'property', 'enumMember', 'decorator', 'event',
	'function', 'method', 'macro', 'keyword', 'modifier', 'comment', 'string',
	'number', 'regexp', 'operator',
];

const SEMANTIC_KIND: Record<string, Kind> = {
	namespace: 'variable',
	class: 'type',
	enum: 'type',
	interface: 'type',
	struct: 'type',
	typeParameter: 'type',
	type: 'type',
	parameter: 'parameter',
	variable: 'variable',
	property: 'property',
	enumMember: 'type',
	decorator: 'annotation',
	event: 'function',
	function: 'function',
	method: 'function',
	macro: 'function',
	keyword: 'keyword',
	modifier: 'keyword',
	comment: 'comment',
	string: 'string',
	number: 'number',
	regexp: 'number',
	operator: 'plain',
};

const PROBES: Record<Exclude<Kind, 'plain'>, string> = {
	keyword: 'keyword',
	control: 'keyword.control',
	string: 'string',
	comment: 'comment',
	number: 'constant.numeric',
	type: 'entity.name.type',
	function: 'entity.name.function',
	variable: 'variable.other.readwrite',
	parameter: 'variable.parameter',
	property: 'variable.other.property',
	annotation: 'storage.type.annotation',
};

const RANK: Record<AriadneFinding['severity'], number> = {
	Critical: 0,
	High: 1,
	Medium: 2,
	Low: 3,
};

const DARK: Palette = {
	keyword: '#569CD6',
	control: '#C586C0',
	string: '#CE9178',
	comment: '#6A9955',
	number: '#B5CEA8',
	type: '#4EC9B0',
	function: '#DCDCAA',
	variable: '#9CDCFE',
	parameter: '#9CDCFE',
	property: '#9CDCFE',
	annotation: '#DCDCAA',
};

const LIGHT: Palette = {
	keyword: '#0000FF',
	control: '#AF00DB',
	string: '#A31515',
	comment: '#008000',
	number: '#098658',
	type: '#267F99',
	function: '#795E26',
	variable: '#001080',
	parameter: '#001080',
	property: '#001080',
	annotation: '#795E26',
};

export async function paintAuditSnippets(
	graph: AuditGraph,
	findings: AriadneFinding[],
	highlightsVisible: boolean,
): Promise<SnippetPaint> {
	const editor = vscode.workspace.getConfiguration('editor');
	const fontSize = editor.get<number>('fontSize') ?? 14;
	const configuredLine = editor.get<number>('lineHeight') ?? 0;
	const fontFamily = editor.get<string>('fontFamily') || 'monospace';
	const palette = loadPalette();
	const byFile = new Map<string, string[]>();
	for (const node of graph.nodes) {
		if (node.snippet && node.file) {
			const list = byFile.get(node.file) ?? [];
			list.push(node.snippet);
			byFile.set(node.file, list);
		}
	}
	for (const edge of graph.edges) {
		if (edge.snippet && edge.file) {
			const list = byFile.get(edge.file) ?? [];
			list.push(edge.snippet);
			byFile.set(edge.file, list);
		}
	}

	const blocks: Record<string, string> = {};
	const files = [...byFile.entries()];
	const painted = await mapPool(files, 6, async ([file, snippets]) => {
		const unique = [...new Set(snippets)];
		return paintFile(file, unique, findings, highlightsVisible, palette);
	});
	for (const part of painted) {
		Object.assign(blocks, part);
	}
	return {
		blocks,
		fontFamily,
		fontSize,
		lineHeight: configuredLine > 0 ? configuredLine : Math.round(fontSize * 1.35),
		variable: palette.variable,
	};
}

async function paintFile(
	file: string,
	snippets: string[],
	findings: AriadneFinding[],
	highlightsVisible: boolean,
	palette: Palette,
): Promise<Record<string, string>> {
	const abs = resolveWorkspaceFsPath(file);
	const uri = vscode.Uri.file(abs);
	const lines = readLines(abs);
	const visible = vscode.window.visibleTextEditors.some((editor) => editor.document.uri.fsPath === abs);
	const spans = lines ? await semanticSpans(uri, visible ? 1500 : 500) : undefined;
	const fileFindings = findings.filter((finding) => sameFile(finding.filePath, abs) || sameFile(finding.filePath, file));
	const diagnostics = lensDiagnostics(uri);
	const out: Record<string, string> = {};
	for (const snippet of snippets) {
		out[`${file}\n${snippet}`] = renderSnippet(snippet, lines, spans, fileFindings, highlightsVisible, diagnostics, palette);
	}
	return out;
}

function renderSnippet(
	snippet: string,
	lines: string[] | undefined,
	spans: Span[] | undefined,
	findings: AriadneFinding[],
	highlightsVisible: boolean,
	diagnostics: vscode.Diagnostic[],
	palette: Palette,
): string {
	return snippet.split('\n').map((raw) => {
		const parsed = parseRow(raw);
		if (!parsed) {
			return '';
		}
		const source = lines && parsed.line > 0 && parsed.line <= lines.length
			? lines[parsed.line - 1]
			: parsed.text;
		const line0 = parsed.line - 1;
		const html = renderSource(source, line0, spans, findings, highlightsVisible, palette);
		const lens = lensHtml(line0, source, findings, highlightsVisible, diagnostics);
		const mark = parsed.marked ? ' mark' : '';
		return `<div class="code-line${mark}" data-line="${parsed.line}"><span class="ln">${parsed.line}</span><span class="src">${html}</span>${lens}</div>`;
	}).join('');
}

function renderSource(
	text: string,
	line0: number,
	spans: Span[] | undefined,
	findings: AriadneFinding[],
	highlightsVisible: boolean,
	palette: Palette,
): string {
	const kinds: Kind[] = Array.from({ length: text.length }, () => 'plain');
	const bolds: boolean[] = Array.from({ length: text.length }, () => false);
	const washes: (string | undefined)[] = Array.from({ length: text.length }, () => undefined);
	applyFallback(text, kinds);
	if (spans) {
		for (const span of spans) {
			if (span.line !== line0 || span.length <= 0) {
				continue;
			}
			const name = TOKEN_TYPES[span.type] ?? 'variable';
			const kind = SEMANTIC_KIND[name] ?? 'plain';
			const bold = (span.mod & 1) !== 0;
			const end = Math.min(text.length, span.start + span.length);
			for (let i = Math.max(0, span.start); i < end; i += 1) {
				kinds[i] = kind;
				bolds[i] = bold;
			}
		}
	}
	if (highlightsVisible) {
		for (const finding of findings) {
			const range = columnsOnLine(finding, text, line0);
			if (!range) {
				continue;
			}
			const bg = SEVERITY_BG_TITLE[finding.severity];
			for (let i = range.start; i < range.end && i < washes.length; i += 1) {
				const previous = washes[i];
				if (!previous || RANK[finding.severity] < rankOfWash(previous)) {
					washes[i] = bg;
				}
			}
		}
	}
	let html = '';
	let i = 0;
	while (i < text.length) {
		const kind = kinds[i];
		const bold = bolds[i];
		const wash = washes[i];
		let j = i + 1;
		while (j < text.length && kinds[j] === kind && bolds[j] === bold && washes[j] === wash) {
			j += 1;
		}
		let chunk = esc(text.slice(i, j));
		const color = kind === 'plain' ? undefined : palette[kind];
		if (color || bold) {
			const style = [
				color ? `color:${color}` : '',
				bold ? 'font-weight:600' : '',
			].filter(Boolean).join(';');
			chunk = `<span style="${style}">${chunk}</span>`;
		}
		if (wash) {
			chunk = `<span class="wash" style="background-color:${wash}">${chunk}</span>`;
		}
		html += chunk;
		i = j;
	}
	return html;
}

function lensHtml(
	line0: number,
	text: string,
	findings: AriadneFinding[],
	highlightsVisible: boolean,
	diagnostics: vscode.Diagnostic[],
): string {
	let html = '';
	if (highlightsVisible) {
		const here = findings.filter((finding) => columnsOnLine(finding, text, line0) && finding.endLine === line0);
		if (here.length) {
			const lead = here.reduce((best, finding) => RANK[finding.severity] < RANK[best.severity] ? finding : best);
			const label = here.map((finding) => finding.vulnerabilityName).join('  ·  ');
			html += `<span class="lens" style="color:${SEVERITY_COLORS_TITLE[lead.severity]}">  ${esc(label)}</span>`;
		}
	}
	for (const diagnostic of diagnostics) {
		if (diagnostic.range.start.line !== line0 || !diagnostic.message) {
			continue;
		}
		html += `<span class="lens ${diagClass(diagnostic.severity)}">  ${esc(diagnostic.message)}</span>`;
	}
	return html;
}

function columnsOnLine(
	finding: AriadneFinding,
	lineText: string,
	line0: number,
): { start: number; end: number } | undefined {
	if (line0 < finding.startLine || line0 > finding.endLine) {
		return undefined;
	}
	const leading = /^\s*/.exec(lineText)?.[0].length ?? 0;
	let start = line0 === finding.startLine ? Math.max(finding.startColumn, leading) : leading;
	let end = line0 === finding.endLine
		? (finding.endColumn >= 999 ? lineText.length : Math.min(finding.endColumn, lineText.length))
		: lineText.length;
	if (start >= end) {
		end = lineText.length;
	}
	if (start >= end || start >= lineText.length) {
		return undefined;
	}
	return { start, end };
}

function rankOfWash(bg: string): number {
	const entry = Object.entries(SEVERITY_BG_TITLE).find(([, color]) => color === bg);
	if (!entry) {
		return 4;
	}
	return RANK[entry[0] as AriadneFinding['severity']];
}

function applyFallback(text: string, kinds: Kind[]): void {
	const quote = '"';
	const apos = "'";
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '/' && text[i + 1] === '/') {
			fill(kinds, i, text.length, 'comment');
			return;
		}
		if (ch === quote || ch === apos) {
			let j = i + 1;
			while (j < text.length && text[j] !== ch) {
				if (text[j] === '\\') {
					j += 1;
				}
				j += 1;
			}
			fill(kinds, i, Math.min(text.length, j + 1), 'string');
			i = j + 1;
			continue;
		}
		if (ch === '@') {
			const match = /^@[A-Za-z_][A-Za-z0-9_.]*/.exec(text.slice(i));
			if (match) {
				fill(kinds, i, i + match[0].length, 'annotation');
				i += match[0].length;
				continue;
			}
		}
		if (/[A-Za-z_]/.test(ch)) {
			const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
			const word = match?.[0] ?? ch;
			let kind: Kind = 'plain';
			if (CONTROL.has(word)) {
				kind = 'control';
			} else if (MODIFIER.has(word) || KEYWORD.has(word)) {
				kind = 'keyword';
			} else if (PRIMITIVE.has(word)) {
				kind = 'keyword';
			} else if (/^[A-Z]/.test(word)) {
				kind = 'type';
			} else {
				let look = i + word.length;
				while (look < text.length && text[look] === ' ') {
					look += 1;
				}
				kind = text[look] === '(' ? 'function' : 'variable';
			}
			fill(kinds, i, i + word.length, kind);
			i += word.length;
			continue;
		}
		if (ch >= '0' && ch <= '9') {
			const match = /^[0-9][A-Za-z0-9.]*/.exec(text.slice(i));
			const word = match?.[0] ?? ch;
			fill(kinds, i, i + word.length, 'number');
			i += word.length;
			continue;
		}
		i += 1;
	}
}

function fill(kinds: Kind[], start: number, end: number, kind: Kind): void {
	for (let i = start; i < end && i < kinds.length; i += 1) {
		kinds[i] = kind;
	}
}

function parseRow(raw: string): { marked: boolean; line: number; text: string } | undefined {
	const match = /^([> ])\s+(\d+)\s{2}(.*)$/.exec(raw);
	if (!match) {
		return undefined;
	}
	return {
		marked: match[1] === '>',
		line: Number(match[2]),
		text: match[3],
	};
}

function readLines(abs: string): string[] | undefined {
	const open = vscode.workspace.textDocuments.find((document) => document.uri.fsPath === abs);
	if (open) {
		return Array.from({ length: open.lineCount }, (_, index) => open.lineAt(index).text);
	}
	try {
		return readFileSync(abs, 'utf8').split(/\r?\n/);
	} catch {
		return undefined;
	}
}

async function semanticSpans(uri: vscode.Uri, timeoutMs: number): Promise<Span[] | undefined> {
	const tokens = await withTimeout(
		Promise.resolve(vscode.commands.executeCommand<vscode.SemanticTokens>(
			'vscode.executeDocumentSemanticTokensProvider',
			uri,
		)),
		timeoutMs,
	);
	if (!tokens?.data) {
		return undefined;
	}
	const data = tokens.data instanceof Uint32Array
		? tokens.data
		: Uint32Array.from(tokens.data as ArrayLike<number>);
	if (!data.length) {
		return undefined;
	}
	const spans: Span[] = [];
	let line = 0;
	let start = 0;
	for (let i = 0; i + 4 < data.length; i += 5) {
		const deltaLine = data[i];
		const deltaStart = data[i + 1];
		if (deltaLine === 0) {
			start += deltaStart;
		} else {
			line += deltaLine;
			start = deltaStart;
		}
		spans.push({
			line,
			start,
			length: data[i + 2],
			type: data[i + 3],
			mod: data[i + 4],
		});
	}
	return spans;
}

function lensDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
	const extension = vscode.extensions.getExtension('usernamehw.errorlens');
	if (!extension) {
		return [];
	}
	const config = vscode.workspace.getConfiguration('errorLens');
	if (config.get('enabled') === false) {
		return [];
	}
	const excluded = new Set(
		(config.get<string[]>('excludeBySource') ?? []).map((source) => source.toLowerCase()),
	);
	const template = config.get<string>('messageTemplate') ?? '$message';
	return vscode.languages.getDiagnostics(uri).flatMap((diagnostic) => {
		const source = (diagnostic.source ?? '').toLowerCase();
		if (source && excluded.has(source)) {
			return [];
		}
		const message = formatLens(template, diagnostic);
		if (!message) {
			return [];
		}
		return [{ ...diagnostic, message }];
	});
}

function formatLens(template: string, diagnostic: vscode.Diagnostic): string {
	const severity = diagnostic.severity === vscode.DiagnosticSeverity.Error
		? 'Error'
		: diagnostic.severity === vscode.DiagnosticSeverity.Warning
			? 'Warning'
			: diagnostic.severity === vscode.DiagnosticSeverity.Information
				? 'Info'
				: 'Hint';
	const code = typeof diagnostic.code === 'object' && diagnostic.code
		? String(diagnostic.code.value)
		: diagnostic.code ? String(diagnostic.code) : '';
	return template
		.replaceAll('$message', diagnostic.message)
		.replaceAll('$source', diagnostic.source ?? '')
		.replaceAll('$severity', severity)
		.replaceAll('$code', code)
		.replaceAll('$count', '1')
		.trim();
}

function diagClass(severity: vscode.DiagnosticSeverity): string {
	if (severity === vscode.DiagnosticSeverity.Error) {
		return 'diag-error';
	}
	if (severity === vscode.DiagnosticSeverity.Warning) {
		return 'diag-warning';
	}
	if (severity === vscode.DiagnosticSeverity.Information) {
		return 'diag-info';
	}
	return 'diag-hint';
}

function loadPalette(): Palette {
	const kind = vscode.window.activeColorTheme.kind;
	const dark = kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
	const palette: Palette = { ...(dark ? DARK : LIGHT) };
	const rules = loadTokenRules();
	(Object.keys(PROBES) as (keyof typeof PROBES)[]).forEach((key) => {
		const color = bestColor(rules, PROBES[key]);
		if (color) {
			palette[key] = color;
		}
	});
	const themeName = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') ?? '';
	applyShortcuts(palette, vscode.workspace.getConfiguration('editor').get('tokenColorCustomizations'), themeName);
	const semanticOn = vscode.workspace.getConfiguration('editor').get('semanticHighlighting.enabled');
	if (semanticOn !== false) {
		applySemantic(palette, themeSemanticColors(), themeName);
		applySemantic(
			palette,
			vscode.workspace.getConfiguration('editor').get('semanticTokenColorCustomizations'),
			themeName,
		);
	}
	return palette;
}

function applyShortcuts(palette: Palette, custom: unknown, themeName: string): void {
	for (const block of blocksFor(custom, themeName)) {
		const record = block as Record<string, unknown>;
		const assign = (key: keyof Palette, value: unknown) => {
			if (typeof value === 'string' && value) {
				palette[key] = value;
			}
		};
		assign('comment', record.comments);
		assign('string', record.strings);
		assign('keyword', record.keywords);
		assign('control', record.keywords);
		assign('number', record.numbers);
		assign('function', record.functions);
		assign('variable', record.variables);
		assign('parameter', record.variables);
		assign('property', record.variables);
		assign('type', record.types);
		const extra = record.textMateRules;
		if (Array.isArray(extra)) {
			const rules = extra.flatMap(readRule);
			(Object.keys(PROBES) as (keyof typeof PROBES)[]).forEach((key) => {
				const color = bestColor(rules, PROBES[key]);
				if (color) {
					palette[key] = color;
				}
			});
		}
	}
}

function applySemantic(palette: Palette, custom: unknown, themeName: string): void {
	for (const block of blocksFor(custom, themeName)) {
		const record = block as Record<string, unknown>;
		const rules = (record.rules && typeof record.rules === 'object') ? record.rules as Record<string, unknown> : record;
		for (const [name, value] of Object.entries(rules)) {
			const kind = SEMANTIC_KIND[name.split('.')[0] ?? ''];
			const color = colorValue(value);
			if (kind && kind !== 'plain' && color) {
				palette[kind] = color;
			}
		}
	}
}

function blocksFor(custom: unknown, themeName: string): unknown[] {
	if (!custom || typeof custom !== 'object') {
		return [];
	}
	const record = custom as Record<string, unknown>;
	const specific = record[`[${themeName}]`];
	return specific && typeof specific === 'object' ? [custom, specific] : [custom];
}

function themeSemanticColors(): unknown {
	const theme = readThemeFile();
	return theme?.semanticTokenColors;
}

function loadTokenRules(): TokenRule[] {
	const theme = readThemeFile();
	if (!theme) {
		return [];
	}
	const rules: TokenRule[] = [];
	const visit = (file: ThemeFile, seen: Set<string>) => {
		if (file.include && !seen.has(file.include)) {
			seen.add(file.include);
			const included = readThemeAt(file.include);
			if (included) {
				visit(included, seen);
			}
		}
		const colors = file.tokenColors;
		if (typeof colors === 'string') {
			const included = readThemeAt(isAbsolute(colors) ? colors : join(dirname(file.path), colors));
			if (included) {
				visit(included, seen);
			}
			return;
		}
		for (const rule of colors ?? []) {
			rules.push(...readRule(rule));
		}
	};
	visit(theme, new Set([theme.path]));
	return rules;
}

interface ThemeFile {
	path: string;
	include?: string;
	tokenColors?: unknown[] | string;
	semanticTokenColors?: unknown;
}

function readThemeFile(): ThemeFile | undefined {
	const name = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme');
	if (!name) {
		return undefined;
	}
	for (const extension of vscode.extensions.all) {
		const themes = (extension.packageJSON as { contributes?: { themes?: { id?: string; label?: string; path?: string }[] } }).contributes?.themes;
		for (const theme of themes ?? []) {
			if ((theme.label === name || theme.id === name) && theme.path) {
				const path = join(extension.extensionUri.fsPath, theme.path);
				return readThemeAt(path);
			}
		}
	}
	return undefined;
}

function readThemeAt(path: string): ThemeFile | undefined {
	if (path.endsWith('.tmTheme')) {
		return undefined;
	}
	try {
		const parsed = parseJsonc(readFileSync(path, 'utf8')) as {
			include?: string;
			tokenColors?: unknown[] | string;
			semanticTokenColors?: unknown;
		};
		const include = parsed.include
			? (isAbsolute(parsed.include) ? parsed.include : join(dirname(path), parsed.include))
			: undefined;
		return {
			path,
			include,
			tokenColors: parsed.tokenColors,
			semanticTokenColors: parsed.semanticTokenColors,
		};
	} catch {
		return undefined;
	}
}

function readRule(value: unknown): TokenRule[] {
	if (!value || typeof value !== 'object') {
		return [];
	}
	const rule = value as { scope?: string | string[]; settings?: { foreground?: string } };
	const scopes = Array.isArray(rule.scope) ? rule.scope : rule.scope ? [rule.scope] : [];
	if (!scopes.length || !rule.settings?.foreground) {
		return [];
	}
	return [{ scopes, foreground: rule.settings.foreground }];
}

function bestColor(rules: TokenRule[], probe: string): string | undefined {
	let best: { depth: number; index: number; color: string } | undefined;
	rules.forEach((rule, index) => {
		if (!rule.foreground) {
			return;
		}
		for (const scope of rule.scopes) {
			if (probe === scope || probe.startsWith(`${scope}.`)) {
				const depth = scope.split('.').length;
				if (!best || depth > best.depth || (depth === best.depth && index >= best.index)) {
					best = { depth, index, color: rule.foreground };
				}
			}
		}
	});
	return best?.color;
}

function colorValue(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value;
	}
	if (value && typeof value === 'object' && typeof (value as { foreground?: string }).foreground === 'string') {
		return (value as { foreground: string }).foreground;
	}
	return undefined;
}

function parseJsonc(text: string): unknown {
	const stripped = text
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^\s*\/\/.*$/gm, '')
		.replace(/,\s*([}\]])/g, '$1');
	return JSON.parse(stripped);
}

function sameFile(a: string, b: string): boolean {
	const left = a.replaceAll('\\', '/').toLowerCase();
	const right = b.replaceAll('\\', '/').toLowerCase();
	return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

function esc(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(undefined), ms);
		work.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(undefined);
			},
		);
	});
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next;
			next += 1;
			out[index] = await fn(items[index]);
		}
	});
	await Promise.all(workers);
	return out;
}
