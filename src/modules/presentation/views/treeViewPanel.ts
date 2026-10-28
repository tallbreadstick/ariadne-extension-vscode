/**
 * Data audit panel. The core sends one graph for the whole program:
 * every binding (variable, field, literal, environment value, condition,
 * actual and formal parameter, return value, object) and every movement
 * between two bindings, with the moment it happens.
 *
 * Each scope (method, constructor, field block, runtime) is a frame.
 * A movement that depends on a condition is drawn through that
 * condition's diamond, labelled with the branch it takes. Clicking a
 * binding opens its movements and traces where its value can go (or
 * come from), following only time-respecting paths and matched call sites.
 */

import { buildStartupLoadingHtml } from './startupLoading.js';
import type { SnippetPaint } from './snippetSnapshot.js';

export interface ScopeView {
	id: string;
	/** `method`, `constructor`, `initializer`, `class`, or `framework`. */
	kind: string;
	label: string;
	class_name: string;
	file: string;
	line: number;
	/** `main`, `GET /notes`, `listener`, `scheduled`, `bean`, or `framework`. */
	entry?: string;
}

export interface BindingView {
	id: string;
	/** `variable`, `field`, `literal`, `environment`, `condition`, `actual`, `formal`, `return`, or `object`. */
	kind: string;
	label: string;
	subtitle: string;
	scope: string;
	file: string;
	line: number;
	column: number;
	/** `bitwise`, `reference`, or `unknown`. */
	copy: string;
	/** `source`, `library`, or `framework`. */
	origin: string;
	expanded: boolean;
	value?: string;
	/** Source lines around this binding. The binding's line starts with `>`. */
	snippet?: string;
	/** `sensitive`, `input`, `operation`, or `sink`. */
	marks?: string[];
	/** This binding is on a confirmed path from a source into a sink. */
	alert?: boolean;
	/** `end` is a source or sink. `path` lies on the way between them. */
	role?: 'end' | 'path';
}

export interface GuardView {
	condition: string;
	branch: string;
}

export interface MovementView {
	id: string;
	/** `bitwise`, `reference`, `derive`, or `member`. */
	kind: string;
	from: string;
	to: string;
	scope: string;
	step: number;
	file: string;
	line: number;
	label?: string;
	guards?: GuardView[];
	/** Movements that wrote the value `from` holds when this one fires. */
	reads: string[];
	/** Call site shared by the movement into a callee and the one out of it. */
	call?: string;
	expanded: boolean;
	/** Source lines around this movement. Its line starts with `>`. */
	snippet?: string;
	/** `flow` for tainted movement, `alert` when it reaches a sink. */
	taint?: 'flow' | 'alert';
}

export interface IssueView {
	id: string;
	rule_id: string;
	title: string;
	cwe: string;
	severity: string;
	file: string;
	line: number;
	column: number;
	/** Binding the finding is about. */
	focus: string;
	nodes: string[];
	edges: string[];
	/** Sources and the sink. */
	ends: string[];
}

export interface AuditGraph {
	scopes: ScopeView[];
	nodes: BindingView[];
	edges: MovementView[];
	issues?: IssueView[];
}

export interface DataAuditPayload {
	type: 'DataAudit';
	graph: AuditGraph;
}

/** A finding the audit should land on: filter to it and open its card. */
export interface AuditFocus {
	file: string;
	line: number;
	title: string;
	cwe: string;
}

export interface TreeViewPanelOptions {
	signedIn?: boolean;
	loading?: boolean;
	scannerBroken?: boolean;
	/** Applied once, when this document is the live graph. */
	focus?: AuditFocus | null;
	/** Editor-matching HTML for each snippet, keyed by file and snippet text. */
	snippets?: SnippetPaint;
}

function snippetThemeStyle(paint: SnippetPaint | undefined): string {
	if (!paint) {
		return '';
	}
	const family = paint.fontFamily.replace(/[;{}<>]/g, '');
	const variable = /^[#(),.%\w\s-]+$/.test(paint.variable) ? paint.variable : 'var(--vscode-editor-foreground)';
	return `<style>:root{--snippet-font-family:${family};--snippet-font-size:${paint.fontSize}px;--snippet-line-height:${paint.lineHeight}px;--ident-color:${variable};}</style>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function buildDataAuditHtml(
	payload: DataAuditPayload | null,
	options: TreeViewPanelOptions = {},
): string {
	if (options.loading) {
		return buildStartupLoadingHtml('Loading data audit…');
	}
	if (options.scannerBroken) {
		return emptyShell('Scanner unavailable', 'Repair the Ariadne binary in Core settings.');
	}
	if (options.signedIn === false) {
		return emptyShell('Sign in required', 'Sign in to GitHub to open the data audit.');
	}
	if (!payload || !payload.graph || payload.graph.nodes.length === 0) {
		return emptyShell('No bindings indexed', 'Analyze a Java project to build its data audit.');
	}

	const dataJson = JSON.stringify(payload).replaceAll('<', '\\u003c');
	const focusJson = JSON.stringify(options.focus ?? null).replaceAll('<', '\\u003c');
	const paintJson = JSON.stringify(options.snippets ?? null).replaceAll('<', '\\u003c');

	return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Data audit</title>
	<style>
		* { box-sizing: border-box; }
		html, body { margin: 0; height: 100%; overflow: hidden; }
		body {
			display: flex;
			font-family: var(--vscode-font-family, system-ui, sans-serif);
			font-size: 13px;
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			user-select: none;
		}
		input, textarea { user-select: text; }
		.rail {
			position: relative;
			z-index: 2;
			width: 270px;
			flex: 0 0 270px;
			border-right: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
			background: var(--vscode-sideBar-background);
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		.rail-head {
			padding: 14px 14px 8px;
			font-size: 11px;
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground);
		}
		.rail-search {
			margin: 0 12px 8px;
			padding: 6px 8px;
			border-radius: 6px;
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground, var(--vscode-foreground));
			font: inherit;
		}
		.rail-list { overflow: auto; padding: 0 8px 12px; flex: 1; min-height: 0; }
		.rail-label {
			font-size: 10px;
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground);
			padding: 10px 8px 4px;
		}
		.entry {
			display: block;
			width: 100%;
			text-align: left;
			border: 1px solid transparent;
			background: transparent;
			color: var(--vscode-foreground);
			border-radius: 8px;
			padding: 6px 8px 6px 10px;
			margin-bottom: 2px;
			cursor: pointer;
			font: inherit;
		}
		.entry:hover { background: var(--vscode-list-hoverBackground); }
		.entry.active {
			border-color: var(--vscode-focusBorder);
			background: var(--vscode-list-activeSelectionBackground);
			color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
		}
		.entry .t { font-weight: 700; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; overflow-wrap: anywhere; }
		.entry .k { margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; overflow-wrap: anywhere; }
		.entry .step {
			display: inline-block;
			min-width: 22px;
			margin-right: 6px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family, monospace);
		}
		.rail-note { padding: 0 8px 8px; color: var(--vscode-descriptionForeground); font-size: 11px; }
		.stage { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }
		.filter {
			position: absolute;
			z-index: 6;
			top: 58px;
			right: 16px;
			display: flex;
			flex-direction: column;
			width: min(320px, calc(100% - 32px));
			max-height: min(360px, 50vh);
			overflow: hidden;
			padding: 8px;
			background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
			color: var(--vscode-foreground);
			border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, var(--vscode-panel-border)));
			border-radius: 6px;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
		}
		.filter[hidden] { display: none; }
		.filter-bar { display: flex; gap: 6px; margin: 0 0 6px; }
		.filter-search {
			flex: 1;
			width: auto;
			min-width: 0;
			margin: 0;
			padding: 6px 8px;
			border-radius: 6px;
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground, var(--vscode-foreground));
			font: inherit;
			font-size: 12px;
		}
		.filter-clear {
			flex: none;
			width: 28px;
			border-radius: 6px;
			border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
			background: var(--vscode-input-background);
			color: var(--vscode-foreground);
			font: inherit;
			font-size: 14px;
			line-height: 1;
			cursor: pointer;
		}
		.filter-clear:disabled { opacity: 0.35; cursor: default; }
		.filter-search:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: -1px;
		}
		.filter-list { overflow: auto; min-height: 0; }
		.filter label.is-hidden { display: none; }
		#filter-toggle { position: relative; }
		#filter-toggle.has-filters {
			border-color: var(--vscode-focusBorder);
		}
		.filter-badge {
			position: absolute;
			top: -6px;
			right: -6px;
			min-width: 16px;
			height: 16px;
			padding: 0 4px;
			border-radius: 999px;
			background: var(--vscode-button-background, var(--vscode-focusBorder));
			color: var(--vscode-button-foreground, #ffffff);
			font-size: 10px;
			font-weight: 700;
			line-height: 16px;
			text-align: center;
			pointer-events: none;
		}
		.filter-badge[hidden] { display: none; }
		.filter label {
			display: flex;
			gap: 8px;
			align-items: flex-start;
			padding: 5px 4px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
		}
		.filter label:hover { background: var(--vscode-list-hoverBackground); }
		.filter .name { font-weight: 700; }
		.filter .meta { display: block; margin-top: 1px; color: var(--vscode-descriptionForeground); font-size: 11px; }
		.filter .empty { padding: 6px 4px; color: var(--vscode-descriptionForeground); font-size: 12px; }
		.chart-head {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 12px;
			padding: 12px 16px 8px;
			border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
		}
		.chart-head h1 { margin: 0; font-size: 15px; }
		.chart-head .meta { margin-top: 3px; color: var(--vscode-descriptionForeground); font-size: 12px; font-family: var(--vscode-editor-font-family, monospace); }
		.chart-head .status { margin-top: 4px; font-size: 12px; color: var(--vscode-foreground); }
		.chart-head .status button { margin-left: 8px; }
		.tools { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
		.tools button, .tools select, .chart-head .status button {
			border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
			background: var(--vscode-input-background);
			color: var(--vscode-foreground);
			border-radius: 6px;
			padding: 4px 8px;
			cursor: pointer;
			font: inherit;
		}
		.legend {
			display: flex;
			flex-wrap: wrap;
			gap: 8px 14px;
			padding: 8px 16px;
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
			border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
		}
		.legend span { display: inline-flex; align-items: center; gap: 5px; }
		.legend svg { flex: none; }
		.viewport {
			flex: 1;
			overflow: auto;
			background-image: radial-gradient(circle, var(--vscode-widget-border, var(--vscode-panel-border)) 1px, transparent 1px);
			background-size: 18px 18px;
		}
		.viewport.locked { overflow: hidden; }
		.nav-hint {
			flex: none;
			display: flex;
			flex-wrap: wrap;
			gap: 6px 16px;
			padding: 5px 14px;
			border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
			background: var(--vscode-sideBar-background, var(--vscode-editor-background));
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}
		.viewport.panning, .viewport.panning * { cursor: grabbing !important; user-select: none; }
		svg { display: block; }
		.node { cursor: pointer; }
		.frame-box {
			fill: var(--vscode-sideBar-background, var(--vscode-editor-background));
			stroke: var(--vscode-panel-border, var(--vscode-widget-border));
			stroke-width: 1;
		}
		.frame.entry-frame .frame-box { stroke: var(--vscode-focusBorder); }
		.frame-title { cursor: pointer; }
		.edge { fill: none; transition: opacity 0.12s; }
		.edge-label {
			font-size: 10.5px;
			font-family: var(--vscode-editor-font-family, monospace);
			paint-order: stroke;
			stroke: var(--vscode-editor-background);
			stroke-width: 3px;
		}
		@keyframes edge-flow {
			from { stroke-dashoffset: 0; }
			to { stroke-dashoffset: -36; }
		}
		.viewport.has-hot .edge, .viewport.has-hot .edge-label, .viewport.has-hot .node { opacity: 0.22; }
		.viewport.has-hot .hot { opacity: 1 !important; }
		.viewport.has-hot .edge.hot { stroke-width: 2.6; stroke-dasharray: 10 8; animation: edge-flow 0.55s linear infinite; }
		.viewport.has-hot .node.hot .body { stroke-width: 2.8; }
		.viewport.tracing .edge, .viewport.tracing .edge-label, .viewport.tracing .node { opacity: 0.14; }
		.viewport.tracing .on { opacity: 1; }
		.viewport.tracing .edge.on { stroke-width: 2.4; stroke-dasharray: 10 8; animation: edge-flow 0.7s linear infinite; }
		.viewport.tracing .edge.on.implicit { stroke-dasharray: 2 5; opacity: 0.75; }
		.viewport.tracing .node.on .body { stroke-width: 2.6; }
		.viewport.tracing .node.origin .body { stroke-width: 3.6; }
		.viewport.filtering .frame,
		.viewport.filtering .edge,
		.viewport.filtering .edge-label,
		.viewport.filtering .node { opacity: 0.14; }
		.viewport.filtering .keep { opacity: 1 !important; }
		.viewport.filtering .edge.keep { stroke-width: 2.2; }
		.hover {
			position: fixed;
			z-index: 40;
			display: none;
			width: min(440px, calc(100vw - 24px));
			max-height: min(70vh, 540px);
			overflow-x: hidden;
			overflow-y: auto;
			padding: 10px 12px 12px;
			background: var(--vscode-editorHoverWidget-background, var(--vscode-editorWidget-background));
			color: var(--vscode-editorHoverWidget-foreground, var(--vscode-foreground));
			border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-widget-border, var(--vscode-panel-border)));
			border-radius: 6px;
			box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
			font-size: 12px;
		}
		.hover h2 {
			margin: 0;
			font-size: 13px;
			font-family: var(--vscode-editor-font-family, monospace);
		}
		.hover .sub { margin-top: 2px; color: var(--vscode-descriptionForeground); }
		.hover .sec {
			margin: 12px 0 6px;
			font-size: 10px;
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground);
		}
		.hover button.move {
			position: relative;
			display: block;
			width: 100%;
			margin: 0 0 4px;
			padding: 3px 4px;
			border: 0;
			border-radius: 4px;
			background: transparent;
			color: inherit;
			font: inherit;
			line-height: 1.45;
			text-align: left;
			cursor: pointer;
		}
		.hover button.move .move-text { position: relative; z-index: 1; }
		.hover button.move::before {
			content: "";
			position: absolute;
			z-index: 0;
			inset: 0;
			border-radius: 4px;
			pointer-events: none;
		}
		.hover button.move:hover::before { background: var(--vscode-list-hoverBackground); }
		.hover button.move.flow::before {
			background: var(--vscode-editorWarning-foreground, #d18616);
			opacity: 0.22;
		}
		.hover button.move.alert::before { background: #c41212; opacity: 0.22; }
		.hover button.move.flow:hover::before,
		.hover button.move.alert:hover::before { opacity: 0.34; }
		.hover code.ident {
			font-family: var(--snippet-font-family, var(--vscode-editor-font-family, monospace));
			font-size: 0.95em;
			padding: 0 0.35em;
			border-radius: 3px;
			background: var(--vscode-textCodeBlock-background, var(--vscode-textPreformat-background));
			color: var(--ident-color, var(--vscode-editor-foreground));
		}
		.hover .verb {
			text-decoration: underline;
			text-underline-offset: 2px;
			text-decoration-thickness: 1px;
		}
		.hover .verb.k-reference { color: var(--vscode-charts-blue, #3794ff); }
		.hover .verb.k-bitwise { color: var(--vscode-charts-purple, #b180d7); }
		.hover .verb.k-derive { color: var(--vscode-charts-green, #89d185); }
		.hover .verb.k-member { color: var(--vscode-charts-yellow, #cca700); }
		.hover .vuln {
			margin: 0 0 10px;
			padding: 2px 0 2px 8px;
			border-left: 3px solid #c41212;
		}
		.hover .vuln-title { font-weight: 700; color: #c41212; }
		.hover .vuln-meta { margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; }
		.hover .vuln-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
		.hover .vuln-actions button {
			border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
			background: var(--vscode-input-background);
			color: var(--vscode-foreground);
			border-radius: 4px;
			padding: 2px 6px;
			cursor: pointer;
			font: inherit;
		}
		.hover .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
		.hover .tag {
			padding: 1px 6px;
			border-radius: 99px;
			border: 1px dashed var(--vscode-editorWarning-foreground, #d18616);
			color: var(--vscode-editorWarning-foreground, #d18616);
			font-size: 10px;
		}
		.hover .tag.alert {
			border-style: solid;
			border-color: #c41212;
			color: #c41212;
		}
		.hover .tag.path {
			border-style: dashed;
			border-color: #c41212;
			color: #c41212;
		}
		.hover .code {
			margin: 4px 0 8px;
			padding: 4px 0;
			max-width: 100%;
			overflow-x: auto;
			overflow-y: hidden;
			overscroll-behavior: contain;
			border-radius: 4px;
			border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground, var(--vscode-foreground));
			cursor: text;
			font-family: var(--snippet-font-family, var(--vscode-editor-font-family, monospace));
			font-size: var(--snippet-font-size, var(--vscode-editor-font-size, 13px));
			line-height: var(--snippet-line-height, 1.35);
		}
		.hover .code-line {
			display: flex;
			align-items: center;
			width: max-content;
			min-width: 100%;
			min-height: var(--snippet-line-height, 1.35em);
		}
		.hover .code-line.mark { background: var(--vscode-editor-lineHighlightBackground); }
		.hover .ln {
			flex: none;
			width: 4em;
			padding: 0 12px 0 6px;
			text-align: right;
			color: var(--vscode-editorLineNumber-foreground, var(--vscode-descriptionForeground));
			user-select: none;
		}
		.hover .src, .hover .lens { user-select: text; }
		.hover .src {
			flex: none;
			white-space: pre;
			color: var(--vscode-editor-foreground, var(--vscode-foreground));
		}
		.hover .src::selection, .hover .src *::selection, .hover .lens::selection {
			background: var(--vscode-editor-selectionBackground);
			color: var(--vscode-editor-selectionForeground, inherit);
		}
		.hover .wash { border-radius: 0; }
		.hover .lens {
			flex: none;
			margin-left: 16px;
			font-style: italic;
			white-space: pre;
		}
		.hover .lens.diag-error { color: var(--vscode-errorLens-errorForeground, var(--vscode-editorError-foreground)); }
		.hover .lens.diag-warning { color: var(--vscode-errorLens-warningForeground, var(--vscode-editorWarning-foreground)); }
		.hover .lens.diag-info { color: var(--vscode-errorLens-infoForeground, var(--vscode-editorInfo-foreground)); }
		.hover .lens.diag-hint { color: var(--vscode-errorLens-hintForeground, var(--vscode-editorHint-foreground)); }
		.hover .tok-k { color: var(--vscode-symbolIcon-keywordForeground, var(--vscode-textLink-foreground)); }
		.hover .tok-s { color: var(--vscode-debugTokenExpression-string, var(--vscode-charts-orange)); }
		.hover .tok-n { color: var(--vscode-debugTokenExpression-number, var(--vscode-charts-green)); }
		.hover .tok-c { color: var(--vscode-editorLineNumber-foreground, var(--vscode-descriptionForeground)); font-style: italic; }
		.hover .tok-t { color: var(--vscode-symbolIcon-classForeground, var(--vscode-textLink-foreground)); }
		.hover .tok-a { color: var(--vscode-symbolIcon-typeParameterForeground, var(--vscode-symbolIcon-keywordForeground, var(--vscode-textLink-foreground))); }
		.hover .where { color: var(--vscode-descriptionForeground); font-size: 11px; }
		.hover .none { color: var(--vscode-descriptionForeground); font-style: italic; }
		@media (prefers-reduced-motion: reduce) {
			.viewport .edge { animation: none !important; }
		}
	</style>
	${snippetThemeStyle(options.snippets)}
</head>
<body>
	<aside class="rail">
		<div class="rail-head">Data audit</div>
		<input class="rail-search" id="search" type="search" placeholder="Filter scopes, bindings, files" />
		<div class="rail-list" id="rail"></div>
	</aside>
	<section class="stage">
		<div class="chart-head">
			<div>
				<h1 id="title">Whole program</h1>
				<div class="meta" id="meta"></div>
				<div class="status" id="status"></div>
			</div>
			<div class="tools">
				<button type="button" id="filter-toggle" title="Show or hide vulnerabilities" aria-expanded="false">
					Vulnerabilities
					<span class="filter-badge" id="filter-badge" hidden>0</span>
				</button>
				<button type="button" id="zoom-out" title="Zoom out">−</button>
				<button type="button" id="zoom-fit" title="Fit">Fit</button>
				<button type="button" id="zoom-in" title="Zoom in">+</button>
			</div>
		</div>
		<div class="filter" id="filter" hidden>
			<div class="filter-bar">
				<input class="filter-search" id="filter-search" type="search" placeholder="Search vulnerabilities" aria-label="Search vulnerabilities" />
				<button type="button" class="filter-clear" id="filter-clear" title="Clear filters" aria-label="Clear filters" disabled>x</button>
			</div>
			<div class="filter-list" id="filter-list"></div>
		</div>
		<div class="legend" id="legend"></div>
		<div class="viewport" id="viewport"></div>
		<div class="nav-hint" aria-label="Navigation">
			<span>Drag with the mouse, or middle-click and drag, to move around</span>
			<span>Scroll to zoom in and out</span>
			<span>Ctrl + scroll to move up and down</span>
		</div>
	</section>
	<div class="hover" id="hover"></div>
	<script type="application/json" id="payload">${dataJson}</script>
	<script type="application/json" id="audit-focus">${focusJson}</script>
	<script type="application/json" id="snippet-paint">${paintJson}</script>
	<script>
		const vscode = acquireVsCodeApi();
		const payload = JSON.parse(document.getElementById('payload').textContent);
		const snippetPaint = JSON.parse(document.getElementById('snippet-paint').textContent || 'null');
		const G = payload.graph;
		const SVGNS = 'http://www.w3.org/2000/svg';

		const PAINT = {
			variable: 'var(--vscode-charts-purple, #b180d7)',
			field: 'var(--vscode-charts-purple, #b180d7)',
			literal: 'var(--vscode-terminal-ansiBrightGreen, #23d18b)',
			environment: 'var(--vscode-terminal-ansiBrightCyan, #29b8db)',
			condition: 'var(--vscode-editor-foreground, #d4d4d4)',
			actual: 'var(--vscode-charts-orange, #d18616)',
			formal: 'var(--vscode-charts-yellow, #cca700)',
			return: 'var(--vscode-charts-blue, #3794ff)',
			object: 'var(--vscode-descriptionForeground, #9d9d9d)',
		};
		const ALERT = '#c41212';
		const KIND_NAMES = {
			variable: 'Variable',
			field: 'Field / element',
			literal: 'Literal',
			environment: 'Environment',
			condition: 'Condition',
			actual: 'Actual parameter',
			formal: 'Formal parameter',
			return: 'Return value',
			object: 'Object',
		};
		const FILL = 'var(--vscode-input-background, var(--vscode-editorWidget-background, #252526))';
		const INK = 'var(--vscode-editor-foreground, var(--vscode-foreground, #d4d4d4))';
		const MUTED = 'var(--vscode-descriptionForeground, #9d9d9d)';
		const EDGE = 'var(--vscode-descriptionForeground, #9d9d9d)';
		const BG = 'var(--vscode-editor-background, #1e1e1e)';
		const OUT = '__outputs';

		const nodeById = new Map(G.nodes.map((n) => [n.id, n]));
		const edgeById = new Map(G.edges.map((e) => [e.id, e]));
		const scopeById = new Map(G.scopes.map((s) => [s.id, s]));
		const scopeIndex = new Map(G.scopes.map((s, i) => [s.id, i]));
		const outEdges = new Map();
		const inEdges = new Map();
		const guarded = new Map();
		function push(map, key, value) {
			let list = map.get(key);
			if (!list) { list = []; map.set(key, list); }
			list.push(value);
		}
		for (const e of G.edges) {
			push(outEdges, e.from, e);
			push(inEdges, e.to, e);
			for (const g of e.guards || []) push(guarded, g.condition, e);
		}
		const runtime = (G.scopes.find((s) => s.kind === 'framework') || {}).id;
		scopeIndex.set(OUT, G.scopes.length);

		// Runtime bindings that only receive values (responses) get their own
		// frame on the right, so the runtime frame reads as pure sources.
		function frameOf(n) {
			if (n.scope === runtime && !(outEdges.get(n.id) || []).length && (inEdges.get(n.id) || []).length) return OUT;
			return n.scope;
		}
		function frameLabel(id) {
			if (id === OUT) return 'Runtime outputs';
			const s = scopeById.get(id);
			return s ? s.label : id;
		}
		function structural(e) {
			return e.kind === 'member' && !e.step && !(e.reads && e.reads.length);
		}
		function innerGuard(e) {
			const gs = e.guards || [];
			for (let i = gs.length - 1; i >= 0; i--) {
				const g = gs[i];
				if (g.condition !== e.from && g.condition !== e.to) return g;
			}
			return null;
		}

		let focusScope = null;
		let trace = null;
		let hotId = null;
		let scale = 1;
		let laid = null;

		function esc(s) {
			return String(s == null ? '' : s)
				.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		}
		function clip(s, n) {
			const t = String(s || '');
			return t.length > n ? t.slice(0, n - 1) + '…' : t;
		}

		// ---------------------------------------------------------------
		// Layout
		// ---------------------------------------------------------------

		function measure(n) {
			const label = clip(n.label, 36);
			const sub = clip(n.value ? n.subtitle + ' = ' + n.value : n.subtitle, 42);
			const chars = Math.max(label.length * 7.3, sub.length * 6);
			if (n.kind === 'condition') {
				return { w: Math.max(130, Math.min(320, chars + 80)), h: 66, label, sub };
			}
			const slant = n.kind === 'actual' || n.kind === 'formal' ? 20 : 0;
			return { w: Math.max(92, Math.min(300, chars + 30 + slant)), h: sub ? 42 : 30, label, sub };
		}

		// Sugiyama-style layering: break cycles with a DFS, place each node
		// one layer after its latest predecessor, then reorder each layer by
		// the barycenter of its neighbours to cut crossings.
		function layered(ids, pairs, order, sizes, gapX, gapY, top) {
			const adj = new Map(ids.map((id) => [id, []]));
			for (const [a, b] of pairs) if (adj.has(a) && adj.has(b) && a !== b) adj.get(a).push(b);
			for (const list of adj.values()) list.sort((x, y) => order(x) - order(y));
			const color = new Map();
			const back = new Set();
			const sorted = ids.slice().sort((x, y) => order(x) - order(y));
			for (const root of sorted) {
				if (color.get(root)) continue;
				const stack = [[root, 0]];
				color.set(root, 1);
				while (stack.length) {
					const top = stack[stack.length - 1];
					const next = adj.get(top[0]);
					if (top[1] < next.length) {
						const v = next[top[1]++];
						const c = color.get(v);
						if (c === 1) back.add(top[0] + ' ' + v);
						else if (!c) { color.set(v, 1); stack.push([v, 0]); }
					} else {
						color.set(top[0], 2);
						stack.pop();
					}
				}
			}
			const indeg = new Map(ids.map((id) => [id, 0]));
			const fwd = new Map(ids.map((id) => [id, []]));
			const preds = new Map(ids.map((id) => [id, []]));
			for (const [a, list] of adj) {
				for (const b of list) {
					if (back.has(a + ' ' + b)) continue;
					fwd.get(a).push(b);
					preds.get(b).push(a);
					indeg.set(b, indeg.get(b) + 1);
				}
			}
			const layer = new Map(ids.map((id) => [id, 0]));
			const queue = sorted.filter((id) => indeg.get(id) === 0);
			for (let qi = 0; qi < queue.length; qi++) {
				const u = queue[qi];
				for (const v of fwd.get(u)) {
					layer.set(v, Math.max(layer.get(v), layer.get(u) + 1));
					indeg.set(v, indeg.get(v) - 1);
					if (indeg.get(v) === 0) queue.push(v);
				}
			}
			const columns = [];
			for (const id of sorted) {
				const l = layer.get(id);
				while (columns.length <= l) columns.push([]);
				columns[l].push(id);
			}
			for (let pass = 0; pass < 8; pass++) {
				const index = new Map();
				for (const col of columns) col.forEach((id, i) => index.set(id, i));
				const usePreds = pass % 2 === 0;
				const cols = usePreds ? columns : columns.slice().reverse();
				for (const col of cols) {
					const bary = new Map();
					for (const id of col) {
						const ns = usePreds ? preds.get(id) : fwd.get(id);
						bary.set(id, ns.length ? ns.reduce((s, x) => s + index.get(x), 0) / ns.length : index.get(id));
					}
					col.sort((a, b) => bary.get(a) - bary.get(b) || order(a) - order(b));
					col.forEach((id, i) => index.set(id, i));
				}
			}
			const pos = {};
			const colH = columns.map((col) => col.reduce((h, id, i) => h + sizes[id].h + (i ? gapY : 0), 0));
			const maxH = Math.max(0, ...colH);
			let x = 0;
			columns.forEach((col, ci) => {
				const w = Math.max(...col.map((id) => sizes[id].w));
				let y = top ? 0 : (maxH - colH[ci]) / 2;
				for (const id of col) {
					const s = sizes[id];
					pos[id] = { x: x + (w - s.w) / 2, y, w: s.w, h: s.h };
					y += s.h + gapY;
				}
				x += w + gapX;
			});
			return { pos, width: Math.max(0, x - gapX), height: maxH };
		}

		function visibleFrames() {
			const all = new Set(G.nodes.map(frameOf));
			if (!focusScope) return all;
			const keep = new Set([focusScope]);
			for (const e of G.edges) {
				const a = frameOf(nodeById.get(e.from));
				const b = frameOf(nodeById.get(e.to));
				if (a === focusScope) keep.add(b);
				if (b === focusScope) keep.add(a);
				const g = innerGuard(e);
				if (g && (a === focusScope || b === focusScope)) keep.add(frameOf(nodeById.get(g.condition)));
			}
			return keep;
		}

		function layoutAll() {
			const frames = visibleFrames();
			const nodes = G.nodes.filter((n) => frames.has(frameOf(n)));
			const sizes = {};
			const firstStep = {};
			for (const n of nodes) {
				sizes[n.id] = measure(n);
				firstStep[n.id] = Infinity;
			}
			for (const e of G.edges) {
				for (const id of [e.from, e.to]) {
					if (id in firstStep && nodeById.get(id).scope === e.scope) firstStep[id] = Math.min(firstStep[id], e.step);
				}
			}
			const nodeOrder = (id) => {
				const s = firstStep[id];
				return (s === Infinity ? 1e6 : s * 1000) + Number(id.slice(1));
			};
			const byFrame = new Map();
			for (const n of nodes) push(byFrame, frameOf(n), n.id);
			const pairsByFrame = new Map();
			const framePairs = [];
			const sameFrame = (a, b) => frameOf(nodeById.get(a)) === frameOf(nodeById.get(b));
			for (const e of G.edges) {
				if (!(e.from in sizes) || !(e.to in sizes) || structural(e)) continue;
				// A condition is placed before what it guards, but not after
				// what flows through it: values computed after the test would
				// otherwise form a cycle through the diamond.
				const g = innerGuard(e);
				const hops = [[e.from, e.to]];
				if (g && g.condition in sizes) hops.push([g.condition, e.to]);
				for (const [a, b] of hops) {
					if (sameFrame(a, b)) push(pairsByFrame, frameOf(nodeById.get(a)), [a, b]);
					else framePairs.push([frameOf(nodeById.get(a)), frameOf(nodeById.get(b))]);
				}
			}

			const PADX = 18;
			const HEAD = 34;
			const PADY = 16;
			const inner = new Map();
			const frameSizes = {};
			for (const [fid, ids] of byFrame) {
				const l = layered(ids, pairsByFrame.get(fid) || [], nodeOrder, sizes, 64, 16);
				inner.set(fid, l);
				const title = frameLabel(fid);
				const w = Math.max(l.width, Math.min(420, title.length * 7.6 + 30)) + PADX * 2;
				frameSizes[fid] = { w, h: l.height + HEAD + PADY, offset: (w - PADX * 2 - l.width) / 2 };
			}
			const frameIds = Array.from(byFrame.keys());
			const frameOrder = (id) => {
				if (id === runtime) return -1;
				const s = scopeById.get(id);
				const entry = s && s.entry && s.entry !== 'bean' ? 0 : 1;
				return entry * 1e6 + scopeIndex.get(id);
			};
			const top = layered(frameIds, framePairs, frameOrder, frameSizes, 120, 36, true);
			const pos = {};
			const framePos = {};
			for (const fid of frameIds) {
				const f = top.pos[fid];
				framePos[fid] = f;
				const l = inner.get(fid);
				const ox = f.x + PADX + frameSizes[fid].offset;
				const oy = f.y + HEAD;
				for (const id of byFrame.get(fid)) {
					const p = l.pos[id];
					pos[id] = { x: ox + p.x, y: oy + p.y, w: p.w, h: p.h };
				}
			}
			const PAD = 40;
			for (const p of Object.values(pos)) { p.x += PAD; p.y += PAD; }
			for (const f of Object.values(framePos)) { f.x += PAD; f.y += PAD; }
			return {
				pos,
				sizes,
				frames: framePos,
				width: top.width + PAD * 2,
				height: top.height + PAD * 2,
			};
		}

		// ---------------------------------------------------------------
		// Painting
		// ---------------------------------------------------------------

		function borderDash(n) {
			if (n.expanded) return ' stroke-dasharray="6 4"';
			if (n.origin === 'library') return ' stroke-dasharray="2 3"';
			return '';
		}

		function ring(n, b) {
			const ended = n.role === 'end' || (!n.role && n.alert);
			const along = n.role === 'path';
			if (!ended && !along && (!n.marks || !n.marks.length)) return '';
			const pad = 4;
			const x = b.x - pad, y = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2;
			const red = ended || along;
			const stroke = red
				? ALERT
				: 'var(--vscode-editorWarning-foreground, #d18616)';
			const paint = ' fill="none" stroke="' + stroke + '" stroke-width="1.5"' + (ended ? '' : ' stroke-dasharray="5 3"');
			if (n.kind === 'condition') {
				const cx = x + w / 2, cy = y + h / 2;
				return '<polygon' + paint + ' points="' + cx + ',' + y + ' ' + (x + w) + ',' + cy + ' ' + cx + ',' + (y + h) + ' ' + x + ',' + cy + '"/>';
			}
			if (n.kind === 'actual' || n.kind === 'formal') {
				const k = 12;
				const pts = n.kind === 'actual'
					? [[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]]
					: [[x, y], [x + w - k, y], [x + w, y + h], [x + k, y + h]];
				return '<polygon' + paint + ' points="' + pts.map((p) => p.join(',')).join(' ') + '"/>';
			}
			const rx = n.kind === 'return' ? h / 2 : n.kind === 'object' ? 1 : 11;
			return '<rect' + paint + ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '"/>';
		}

		function shapeOf(n, b) {
			const stroke = PAINT[n.kind] || INK;
			const paint = ' class="body" fill="' + FILL + '" stroke="' + stroke + '" stroke-width="1.7"' + borderDash(n);
			const x = b.x, y = b.y, w = b.w, h = b.h;
			if (n.kind === 'condition') {
				const cx = x + w / 2, cy = y + h / 2;
				return '<polygon' + paint + ' points="' + cx + ',' + y + ' ' + (x + w) + ',' + cy + ' ' + cx + ',' + (y + h) + ' ' + x + ',' + cy + '"/>';
			}
			if (n.kind === 'actual' || n.kind === 'formal') {
				const k = 10;
				const pts = n.kind === 'actual'
					? [[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]]
					: [[x, y], [x + w - k, y], [x + w, y + h], [x + k, y + h]];
				return '<polygon' + paint + ' points="' + pts.map((p) => p.join(',')).join(' ') + '"/>';
			}
			if (n.kind === 'return') {
				return '<rect' + paint + ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '"/>';
			}
			if (n.kind === 'object') {
				return '<rect' + paint + ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1"/>';
			}
			const rect = '<rect' + paint + ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="9"/>';
			if (n.kind === 'field') {
				return rect + '<rect fill="none" stroke="' + stroke + '" stroke-width="1" x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="6"' + borderDash(n) + '/>';
			}
			return rect;
		}

		function paintNode(n, b, s) {
			const cx = b.x + b.w / 2;
			const cy = b.y + b.h / 2;
			let text;
			if (s.sub) {
				text = '<text x="' + cx + '" y="' + (cy - 7) + '" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="' + INK + '" font-family="var(--vscode-editor-font-family, monospace)">' + esc(s.label) + '</text>'
					+ '<text x="' + cx + '" y="' + (cy + 9) + '" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="' + MUTED + '">' + esc(s.sub) + '</text>';
			} else {
				text = '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="' + INK + '" font-family="var(--vscode-editor-font-family, monospace)">' + esc(s.label) + '</text>';
			}
			return '<g class="node" data-node-id="' + esc(n.id) + '">' + ring(n, b) + shapeOf(n, b) + text + '</g>';
		}

		function port(box, side, i, count, isDiamond) {
			const x = side === 'right' ? box.x + box.w : box.x;
			if (isDiamond || count <= 1) return { x, y: box.y + box.h / 2 };
			const pad = Math.min(9, box.h * 0.2);
			const span = Math.max(1, box.h - pad * 2);
			return { x, y: box.y + pad + span * (i / (count - 1)) };
		}

		function curve(a, b, p0, p3, self) {
			if (self) {
				const x = a.x + a.w * 0.7;
				return { p0: { x, y: a.y }, p1: { x: x + 26, y: a.y - 34 }, p2: { x: a.x + a.w + 20, y: a.y + 6 }, p3: { x: a.x + a.w, y: a.y + a.h / 2 } };
			}
			if (p3.x <= p0.x + 14) {
				const bow = 40 + Math.min(110, Math.abs(p3.y - p0.y) * 0.25);
				const lift = p0.y <= p3.y ? -bow : bow;
				return { p0, p1: { x: p0.x + 60, y: p0.y + lift }, p2: { x: p3.x - 60, y: p3.y + lift }, p3 };
			}
			const pull = Math.max(36, Math.min((p3.x - p0.x) * 0.45, 260));
			return { p0, p1: { x: p0.x + pull, y: p0.y }, p2: { x: p3.x - pull, y: p3.y }, p3 };
		}
		function pathOf(c) {
			return 'M ' + c.p0.x + ' ' + c.p0.y + ' C ' + c.p1.x + ' ' + c.p1.y + ', ' + c.p2.x + ' ' + c.p2.y + ', ' + c.p3.x + ' ' + c.p3.y;
		}
		function at(c, t) {
			const u = 1 - t;
			return {
				x: u * u * u * c.p0.x + 3 * u * u * t * c.p1.x + 3 * u * t * t * c.p2.x + t * t * t * c.p3.x,
				y: u * u * u * c.p0.y + 3 * u * u * t * c.p1.y + 3 * u * t * t * c.p2.y + t * t * t * c.p3.y,
			};
		}
		function spot(c, t) {
			const p = at(c, t);
			const q = at(c, Math.min(1, t + 0.04));
			const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
			let nx = -(q.y - p.y) / len;
			let ny = (q.x - p.x) / len;
			if (ny > 0) { nx = -nx; ny = -ny; }
			return { x: p.x + nx * 10, y: p.y + ny * 10 };
		}

		function markerFor(kind) {
			if (kind === 'bitwise') return 'url(#m-bitwise)';
			if (kind === 'derive') return 'url(#m-derive)';
			if (kind === 'member') return 'url(#m-member)';
			return 'url(#m-reference)';
		}

		function renderGraph() {
			hideHover();
			setHot(null);
			laid = layoutAll();
			const pos = laid.pos;
			const segs = [];
			for (const e of G.edges) {
				if (!pos[e.from] || !pos[e.to]) continue;
				const g = innerGuard(e);
				const d = g && pos[g.condition];
				const a = pos[e.from];
				const b = pos[e.to];
				if (d && a.x + a.w < d.x && d.x + d.w < b.x) {
					segs.push({ e, a: e.from, b: g.condition, last: false, label: e.label });
					segs.push({ e, a: g.condition, b: e.to, last: true, branch: g.branch, via: g.condition });
				} else {
					segs.push({ e, a: e.from, b: e.to, last: true, label: e.label, tag: g ? g.branch : null, via: g ? g.condition : null });
				}
			}
			const outs = new Map();
			const ins = new Map();
			for (const s of segs) {
				if (s.a === s.b) continue;
				push(outs, s.a, s);
				push(ins, s.b, s);
			}
			for (const list of outs.values()) list.sort((x, y) => pos[x.b].y - pos[y.b].y);
			for (const list of ins.values()) list.sort((x, y) => pos[x.a].y - pos[y.a].y);

			let frames = '';
			for (const [fid, f] of Object.entries(laid.frames)) {
				const s = scopeById.get(fid);
				const entry = s && s.entry && s.entry !== 'bean' && s.kind !== 'framework';
				const sub = fid === OUT ? 'values handed back to the runtime' : s ? [s.entry, s.file && s.line ? s.file + ':' + s.line : ''].filter(Boolean).join('  ·  ') : '';
				frames += '<g class="frame' + (entry ? ' entry-frame' : '') + '" data-frame="' + esc(fid) + '">'
					+ '<rect class="frame-box" x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '" rx="10"/>'
					+ '<text class="frame-title" data-frame="' + esc(fid) + '" x="' + (f.x + 14) + '" y="' + (f.y + 15) + '" font-size="12" font-weight="700" fill="' + INK + '" font-family="var(--vscode-editor-font-family, monospace)">' + esc(clip(frameLabel(fid), 60)) + '</text>'
					+ '<text x="' + (f.x + 14) + '" y="' + (f.y + 27) + '" font-size="10" fill="' + MUTED + '">' + esc(clip(sub, 70)) + '</text>'
					+ '</g>';
			}

			let edges = '';
			let labels = '';
			for (const s of segs) {
				const a = pos[s.a];
				const b = pos[s.b];
				const oList = outs.get(s.a) || [];
				const iList = ins.get(s.b) || [];
				const aDiamond = nodeById.get(s.a).kind === 'condition';
				const bDiamond = nodeById.get(s.b).kind === 'condition';
				const p0 = port(a, 'right', Math.max(0, oList.indexOf(s)), oList.length, aDiamond);
				let p3 = port(b, 'left', Math.max(0, iList.indexOf(s)), iList.length, bDiamond);
				if (p3.x <= p0.x + 14 && !bDiamond) p3 = port(b, 'right', Math.max(0, iList.indexOf(s)), iList.length, false);
				const c = curve(a, b, p0, p3, s.a === s.b);
				const e = s.e;
				const stroke = e.taint === 'alert'
					? ALERT
					: e.taint === 'flow'
						? 'var(--vscode-editorWarning-foreground, #d18616)'
						: EDGE;
				const dash = e.kind === 'member' ? ' stroke-dasharray="2 3"' : e.expanded ? ' stroke-dasharray="7 4"' : '';
				const marker = s.last ? ' marker-end="' + markerFor(e.kind) + '"' : '';
				const attrs = ' data-edge="' + e.id + '" data-from="' + esc(e.from) + '" data-to="' + esc(e.to) + '"' + (s.via ? ' data-via="' + esc(s.via) + '"' : '');
				const tip = e.kind + (e.label ? ' ' + e.label : '') + '  ·  step ' + e.step + '  ·  ' + frameLabel(e.scope) + (e.call ? '  ·  call ' + e.call : '');
				edges += '<path class="edge k-' + e.kind + (e.taint ? ' taint-' + e.taint : '') + '"' + attrs + ' d="' + pathOf(c) + '" stroke="' + stroke + '" stroke-width="' + (e.taint === 'alert' ? '2.1' : '1.5') + '"' + dash + marker + '><title>' + esc(tip) + '</title></path>';
				if (s.label && e.kind !== 'member') {
					const p = spot(c, 0.5);
					labels += '<text class="edge-label"' + attrs + ' x="' + p.x + '" y="' + p.y + '" text-anchor="middle" fill="' + MUTED + '">' + esc(clip(s.label, 24)) + '</text>';
				}
				if (s.tag) {
					const p = spot(c, 0.86);
					labels += '<text class="edge-label"' + attrs + ' x="' + p.x + '" y="' + p.y + '" text-anchor="middle" fill="' + PAINT.condition + '" font-weight="700">' + esc(clip(s.tag, 18)) + '</text>';
				}
				if (s.branch) {
					for (const t of [0.14, 0.86]) {
						const p = spot(c, t);
						labels += '<text class="edge-label"' + attrs + ' x="' + p.x + '" y="' + p.y + '" text-anchor="middle" fill="' + PAINT.condition + '" font-weight="700">' + esc(clip(s.branch, 18)) + '</text>';
					}
				}
			}

			let bodies = '';
			for (const n of G.nodes) if (pos[n.id]) bodies += paintNode(n, pos[n.id], laid.sizes[n.id]);

			const svg = '<svg id="diagram" xmlns="' + SVGNS + '">'
				+ '<defs>'
				+ '<marker id="m-reference" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke"/></marker>'
				+ '<marker id="m-bitwise" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="12" markerHeight="8" orient="auto"><path d="M 0 1 L 8 5 L 0 9 z M 7 1 L 15 5 L 7 9 z" fill="context-stroke"/></marker>'
				+ '<marker id="m-derive" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M 1 1.5 L 11 6 L 1 10.5 z" fill="' + BG + '" stroke="context-stroke" stroke-width="1.4"/></marker>'
				+ '<marker id="m-member" viewBox="0 0 14 10" refX="13" refY="5" markerWidth="11" markerHeight="8" orient="auto"><path d="M 1 5 L 7 1 L 13 5 L 7 9 z" fill="' + BG + '" stroke="context-stroke" stroke-width="1.3"/></marker>'
				+ '</defs><g id="world"><g id="frames">' + frames + '</g><g id="edges">' + edges + '</g><g id="labels">' + labels + '</g><g id="nodes">' + bodies + '</g></g></svg>';
			const vp = document.getElementById('viewport');
			vp.innerHTML = svg;
			vp.querySelectorAll('.node').forEach((el) => {
				const id = el.getAttribute('data-node-id');
				el.addEventListener('click', (event) => {
					if (event.button !== 0 || event.detail > 1) return;
					if (event.ctrlKey || event.metaKey) { openSource(id); return; }
					const pop = document.getElementById('hover');
					if (hotId === id && pop.style.display === 'block') {
						setHot(null);
						hideHover();
						if (trace && trace.origin === id) { trace = null; applyTrace(); }
						return;
					}
					showHover(id, el);
					if (!trace || trace.origin !== id) toggleTrace(id);
					setHot(id);
				});
				el.addEventListener('dblclick', () => openSource(id));
			});
			vp.querySelectorAll('.frame-title').forEach((el) => {
				el.addEventListener('click', () => setFocus(el.getAttribute('data-frame')));
			});
			applyTrace();
			applyFilter();
		}

		function openSource(id) {
			const n = nodeById.get(id);
			if (!n || !n.file || !n.line) return;
			vscode.postMessage({ type: 'goto-line', filePath: n.file, line: n.line, column: n.column || 0 });
		}

		// ---------------------------------------------------------------
		// Trace: realizable slices
		// ---------------------------------------------------------------
		//
		// A walk e1, e2, ... is followed only when it respects time (e1 is
		// one of the writes e2 reads) and calls match: a movement into a
		// formal at call site c pushes c, a movement out of a return at c
		// must pop c. An empty stack may still return, to any caller. A
		// condition reached by the walk also taints what it guards
		// (implicit flow), drawn with a fainter line.

		const SOURCES = new Set(['literal', 'environment', 'object']);
		const LIMIT = 40000;

		function forward(start) {
			const nodes = new Set([start]);
			const edges = new Set();
			const implicit = new Set();
			const seen = new Set();
			const queue = [];
			const seed = (list, stack, imp) => { for (const e of list || []) queue.push([e, stack, imp]); };
			seed(outEdges.get(start), [], false);
			if (nodeById.get(start).kind === 'condition') seed(guarded.get(start), [], true);
			let budget = LIMIT;
			for (let qi = 0; qi < queue.length && budget-- > 0; qi++) {
				const [e, stack, imp] = queue[qi];
				const key = e.id + '|' + stack.join(',') + (imp ? '!' : '');
				if (seen.has(key)) continue;
				seen.add(key);
				let next = stack;
				if (e.call) {
					if (nodeById.get(e.to).kind === 'formal') next = stack.concat([e.call]).slice(-8);
					else if (nodeById.get(e.from).kind === 'return' && stack.length) {
						if (stack[stack.length - 1] !== e.call) continue;
						next = stack.slice(0, -1);
					}
				}
				edges.add(e.id);
				if (imp) implicit.add(e.id); else implicit.delete(e.id);
				nodes.add(e.to);
				for (const f of outEdges.get(e.to) || []) {
					if (!structural(e) && f.reads && f.reads.length && !f.reads.includes(e.id)) continue;
					queue.push([f, next, imp]);
				}
				if (nodeById.get(e.to).kind === 'condition') seed(guarded.get(e.to), next, true);
			}
			return { nodes, edges, implicit };
		}

		function backward(start) {
			const nodes = new Set([start]);
			const edges = new Set();
			const implicit = new Set();
			const seen = new Set();
			const queue = [];
			for (const e of inEdges.get(start) || []) queue.push([e, [], false]);
			let budget = LIMIT;
			for (let qi = 0; qi < queue.length && budget-- > 0; qi++) {
				const [e, stack, imp] = queue[qi];
				const key = e.id + '|' + stack.join(',') + (imp ? '!' : '');
				if (seen.has(key)) continue;
				seen.add(key);
				let next = stack;
				if (e.call) {
					if (nodeById.get(e.from).kind === 'return') next = stack.concat([e.call]).slice(-8);
					else if (nodeById.get(e.to).kind === 'formal' && stack.length) {
						if (stack[stack.length - 1] !== e.call) continue;
						next = stack.slice(0, -1);
					}
				}
				edges.add(e.id);
				if (imp) implicit.add(e.id); else implicit.delete(e.id);
				nodes.add(e.from);
				const from = nodeById.get(e.from);
				if (!SOURCES.has(from.kind)) {
					const preds = e.reads && e.reads.length
						? e.reads.map((id) => edgeById.get(id)).filter(Boolean)
						: inEdges.get(e.from) || [];
					for (const p of preds) queue.push([p, next, imp]);
				}
				for (const g of e.guards || []) {
					nodes.add(g.condition);
					for (const p of inEdges.get(g.condition) || []) queue.push([p, next, true]);
				}
			}
			return { nodes, edges, implicit };
		}

		function toggleTrace(id) {
			if (trace && trace.origin === id) { trace = null; applyTrace(); return; }
			const parts = [forward(id), backward(id)];
			const merged = { origin: id, dir: 'both', nodes: new Set(), edges: new Set(), implicit: new Set() };
			for (const p of parts) {
				p.nodes.forEach((x) => merged.nodes.add(x));
				p.edges.forEach((x) => merged.edges.add(x));
			}
			for (const p of parts) p.implicit.forEach((x) => { if (!parts.some((q) => q !== p && q.edges.has(x) && !q.implicit.has(x))) merged.implicit.add(x); });
			trace = merged;
			applyTrace();
		}

		function traceEdge(id) {
			const e = edgeById.get(id);
			if (!e) return;
			trace = { origin: null, edge: id, dir: 'edge', nodes: new Set([e.from, e.to]), edges: new Set([id]), implicit: new Set() };
			for (const r of e.reads || []) {
				const w = edgeById.get(r);
				if (!w) continue;
				trace.edges.add(r);
				trace.nodes.add(w.from);
			}
			applyTrace();
			revealNode(e.to);
		}

		function applyTrace() {
			const vp = document.getElementById('viewport');
			vp.classList.toggle('tracing', !!trace);
			vp.querySelectorAll('.node').forEach((el) => {
				const id = el.getAttribute('data-node-id');
				el.classList.toggle('on', !!trace && trace.nodes.has(id));
				el.classList.toggle('origin', !!trace && trace.origin === id);
			});
			vp.querySelectorAll('[data-edge]').forEach((el) => {
				const id = el.getAttribute('data-edge');
				const on = !!trace && trace.edges.has(id);
				el.classList.toggle('on', on);
				el.classList.toggle('implicit', on && trace.implicit.has(id));
			});
			if (laid) renderRail();
			const status = document.getElementById('status');
			if (!trace) { status.innerHTML = ''; return; }
			const what = trace.origin
				? (trace.dir === 'forward' ? 'Where ' : trace.dir === 'backward' ? 'What feeds ' : 'Everything touching ') + nodeById.get(trace.origin).label + (trace.dir === 'forward' ? ' can go' : '')
				: 'Movement ' + trace.edge + ' and the writes it reads';
			const hidden = Array.from(trace.nodes).filter((id) => !laid.pos[id]).length;
			status.innerHTML = esc(what) + '  ·  ' + trace.nodes.size + ' bindings, ' + trace.edges.size + ' movements'
				+ (hidden ? '  ·  ' + hidden + ' outside this view' : '')
				+ '<button type="button" id="clear-trace">Clear</button>';
			document.getElementById('clear-trace').addEventListener('click', () => { trace = null; applyTrace(); });
		}

		function ident(name) {
			return '<code class="ident">' + esc(name) + '</code>';
		}

		function movementHtml(e) {
			const from = nodeById.get(e.from);
			const to = nodeById.get(e.to);
			const left = ident(from ? from.label : e.from);
			const right = ident(to ? to.label : e.to);
			let verb = 'moves';
			let tail = ' to ' + right;
			if (e.kind === 'bitwise') verb = 'bitwise copies';
			else if (e.kind === 'reference') verb = 'reference copies';
			else if (e.kind === 'member') { verb = 'is a member of'; tail = ' ' + right; }
			else if (e.kind === 'derive') {
				verb = 'derives';
				tail = ' ' + right + (e.label ? ' by ' + ident(e.label) : '');
			}
			let html = left + ' <span class="verb k-' + esc(e.kind) + '">' + esc(verb) + '</span>' + tail;
			const when = (e.guards || []).map((g) => {
				const c = nodeById.get(g.condition);
				return ident(c ? c.label : g.condition) + ' is ' + esc(g.branch);
			});
			if (when.length) html += ', when ' + when.join(' and ');
			if (e.expanded) html += ' (expanded)';
			return html;
		}

		const MARK_NAMES = {
			sensitive: 'Sensitive data',
			input: 'Unsanitized input',
			operation: 'Sensitive operation',
			sink: 'Unsecure sink',
		};
		const JAVA_WORD = /^(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|var|yield|record|sealed|permits)$/;

		function highlightJava(src) {
			const quote = String.fromCharCode(34);
			const apos = String.fromCharCode(39);
			const slash = String.fromCharCode(92);
			let i = 0;
			let out = '';
			const s = String(src);
			while (i < s.length) {
				const ch = s.charAt(i);
				if (ch === '/' && s.charAt(i + 1) === '/') {
					out += '<span class="tok-c">' + esc(s.slice(i)) + '</span>';
					break;
				}
				if (ch === quote || ch === apos) {
					let j = i + 1;
					while (j < s.length && s.charAt(j) !== ch) {
						if (s.charAt(j) === slash) j += 1;
						j += 1;
					}
					out += '<span class="tok-s">' + esc(s.slice(i, Math.min(s.length, j + 1))) + '</span>';
					i = j + 1;
					continue;
				}
				if (ch === '@') {
					const m = /^@[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i));
					if (m) {
						out += '<span class="tok-a">' + esc(m[0]) + '</span>';
						i += m[0].length;
						continue;
					}
				}
				if (/[A-Za-z_]/.test(ch)) {
					const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
					const word = m[0];
					const cls = JAVA_WORD.test(word) ? 'tok-k' : /^[A-Z]/.test(word) ? 'tok-t' : '';
					out += cls ? '<span class="' + cls + '">' + esc(word) + '</span>' : esc(word);
					i += word.length;
					continue;
				}
				if (ch >= '0' && ch <= '9') {
					const m = /^[0-9][A-Za-z0-9.]*/.exec(s.slice(i));
					out += '<span class="tok-n">' + esc(m[0]) + '</span>';
					i += m[0].length;
					continue;
				}
				out += esc(ch);
				i += 1;
			}
			return out;
		}

		function codeBlock(snippet, file) {
			if (!snippet) return '';
			const key = (file || '') + String.fromCharCode(10) + String(snippet);
			const baked = snippetPaint && snippetPaint.blocks ? snippetPaint.blocks[key] : '';
			if (baked) return '<div class="code" data-file="' + esc(file || '') + '">' + baked + '</div>';
			const rows = String(snippet).split(String.fromCharCode(10)).map((raw) => {
				const marked = raw.charAt(0) === '>';
				let k = 0;
				if (raw.charAt(0) === '>' || raw.charAt(0) === ' ') k = 1;
				while (k < raw.length && raw.charAt(k) === ' ') k += 1;
				const body = raw.slice(k);
				let n = 0;
				while (n < body.length && body.charAt(n) >= '0' && body.charAt(n) <= '9') n += 1;
				const ln = body.slice(0, n);
				let src = body.slice(n);
				if (src.charAt(0) === ' ' && src.charAt(1) === ' ') src = src.slice(2);
				return '<div class="code-line' + (marked ? ' mark' : '') + '" data-line="' + esc(ln) + '"><span class="ln">' + esc(ln) + '</span><span class="src">' + highlightJava(src) + '</span></div>';
			}).join('');
			return '<div class="code" data-file="' + esc(file || '') + '">' + rows + '</div>';
		}

		function moveList(title, list, node, inbound) {
			let html = '<div class="sec">' + esc(title) + '</div>';
			if (!list.length) return html + '<div class="none">None</div>';
			const sorted = list.slice().sort((a, b) => a.step - b.step || a.id.localeCompare(b.id));
			let shown = '';
			for (const e of sorted) {
				const other = inbound ? e.from : e.to;
				const tone = e.taint === 'alert' ? ' alert' : e.taint === 'flow' ? ' flow' : '';
				html += '<button type="button" class="move' + tone + '" data-goto="' + esc(other) + '"><span class="move-text">' + movementHtml(e) + '</span></button>';
				const loc = (e.file || '') + ':' + (e.line || 0);
				const same = node.file === e.file && node.line === e.line;
				if (e.snippet && !same && loc !== shown) {
					html += '<div class="where">' + esc(loc) + '</div>' + codeBlock(e.snippet, e.file);
					shown = loc;
				}
			}
			return html;
		}

		function issuesFor(id) {
			return (G.issues || []).filter((issue) => issue.focus === id || (issue.nodes || []).indexOf(id) !== -1);
		}

		function vulnHead(id) {
			const list = issuesFor(id);
			if (!list.length) return '';
			return list.map((issue) => {
				const meta = [issue.cwe, issue.rule_id].filter(Boolean).join(' · ');
				return '<div class="vuln"><div class="vuln-title">' + esc(issue.title || issue.rule_id || 'Vulnerability') + '</div>'
					+ (meta ? '<div class="vuln-meta">' + esc(meta) + '</div>' : '')
					+ '<div class="vuln-actions">'
					+ '<button type="button" data-goto="' + esc(issue.focus) + '">Jump to the problem</button>'
					+ '<button type="button" class="jump-code" data-file="' + esc(issue.file || '') + '" data-line="' + esc(String(issue.line || 0)) + '">Open the code</button>'
					+ '</div></div>';
			}).join('');
		}

		function hoverHtml(id) {
			const n = nodeById.get(id);
			if (!n) return '';
			const bits = [KIND_NAMES[n.kind] || n.kind, n.subtitle, n.value ? '= ' + n.value : ''].filter(Boolean);
			let html = vulnHead(id) + '<h2>' + esc(n.label) + '</h2><div class="sub">' + esc(bits.join(' · ')) + '</div>';
			const tags = (n.marks || []).map((m) => MARK_NAMES[m] || m);
			if (n.role === 'end') tags.push('Source or sink');
			else if (n.role === 'path') tags.push('On the unsecure path');
			else if (n.alert) tags.push('Confirmed path');
			if (tags.length) {
				const tagClass = n.role === 'end' || n.alert ? ' alert' : n.role === 'path' ? ' path' : '';
				html += '<div class="tags">' + tags.map((t) => '<span class="tag' + tagClass + '">' + esc(t) + '</span>').join('') + '</div>';
			}
			if (n.file && n.line) html += '<div class="where">' + esc(n.file + ':' + n.line) + '</div>';
			if (n.snippet) html += codeBlock(n.snippet, n.file);
			html += moveList('Inbound edges', inEdges.get(id) || [], n, true);
			html += moveList('Outbound edges', outEdges.get(id) || [], n, false);
			return html;
		}

		function placeHover(anchor) {
			const pop = document.getElementById('hover');
			const r = anchor.getBoundingClientRect();
			const stage = document.querySelector('.stage').getBoundingClientRect();
			const pw = pop.offsetWidth;
			const ph = pop.offsetHeight;
			const margin = 8;
			let x = r.right + 10;
			if (x + pw > stage.right - margin) x = r.left - pw - 10;
			if (x < stage.left + margin) x = stage.left + margin;
			if (x + pw > stage.right - margin) x = Math.max(stage.left + margin, stage.right - margin - pw);
			let y = Math.max(stage.top + margin, r.top);
			if (y + ph > window.innerHeight - margin) y = Math.max(stage.top + margin, window.innerHeight - margin - ph);
			pop.style.left = x + 'px';
			pop.style.top = y + 'px';
		}

		function showHover(id, anchor) {
			const pop = document.getElementById('hover');
			pop.innerHTML = hoverHtml(id);
			pop.style.display = 'block';
			document.getElementById('viewport').classList.add('locked');
			placeHover(anchor);
		}

		function hideHover() {
			const pop = document.getElementById('hover');
			pop.style.display = 'none';
			pop.innerHTML = '';
			document.getElementById('viewport').classList.remove('locked');
		}

		function dismissInspect() {
			hideHover();
			setHot(null);
			if (trace) { trace = null; applyTrace(); }
			applyFilter();
		}

		function travelTo(id) {
			const n = nodeById.get(id);
			if (!n) return;
			if (!laid || !laid.pos[id]) {
				const frame = frameOf(n);
				setFocus(frame === OUT ? null : frame);
			}
			const el = document.querySelector('.node[data-node-id="' + id + '"]');
			if (!el) return;
			revealNode(id);
			setHot(id);
			showHover(id, el);
		}

		function setHot(id) {
			hotId = id;
			const vp = document.getElementById('viewport');
			vp.classList.toggle('has-hot', !!id && !trace);
			if (trace) return;
			const near = new Set(id ? [id] : []);
			vp.querySelectorAll('[data-edge]').forEach((el) => {
				const on = !!id && (el.getAttribute('data-from') === id || el.getAttribute('data-to') === id || el.getAttribute('data-via') === id);
				el.classList.toggle('hot', on);
				if (on) {
					near.add(el.getAttribute('data-from'));
					near.add(el.getAttribute('data-to'));
					if (el.getAttribute('data-via')) near.add(el.getAttribute('data-via'));
				}
			});
			vp.querySelectorAll('.node').forEach((el) => {
				el.classList.toggle('hot', near.has(el.getAttribute('data-node-id')));
			});
		}

		// ---------------------------------------------------------------
		// View
		// ---------------------------------------------------------------

		function applyScale() {
			const svg = document.getElementById('diagram');
			if (!svg || !laid) return;
			svg.setAttribute('width', String(Math.ceil(laid.width * scale)));
			svg.setAttribute('height', String(Math.ceil(laid.height * scale)));
			svg.setAttribute('viewBox', '0 0 ' + laid.width + ' ' + laid.height);
		}
		function fit() {
			const vp = document.getElementById('viewport');
			const sx = (vp.clientWidth - 24) / laid.width;
			const sy = (vp.clientHeight - 24) / laid.height;
			const whole = Math.min(sx, sy);
			scale = whole >= 0.55 ? Math.min(1, whole) : Math.max(0.55, Math.min(1, sx));
			applyScale();
			const first = Object.values(laid.frames).sort((a, b) => a.x - b.x || a.y - b.y)[0];
			vp.scrollLeft = 0;
			vp.scrollTop = first ? Math.max(0, first.y * scale - 24) : 0;
		}
		function revealNode(id) {
			const box = laid && laid.pos[id];
			if (!box) return;
			const vp = document.getElementById('viewport');
			vp.scrollLeft = Math.max(0, (box.x + box.w / 2) * scale - vp.clientWidth / 2);
			vp.scrollTop = Math.max(0, (box.y + box.h / 2) * scale - vp.clientHeight / 2);
		}
		function revealFrame(fid) {
			const f = laid && laid.frames[fid];
			if (!f) return;
			const vp = document.getElementById('viewport');
			vp.scrollLeft = Math.max(0, f.x * scale - 24);
			vp.scrollTop = Math.max(0, f.y * scale - 24);
		}

		function setFocus(fid) {
			focusScope = fid;
			renderHeader();
			renderGraph();
			fit();
			if (fid) revealFrame(fid);
			renderRail();
		}

		function renderHeader() {
			const files = new Set(G.nodes.map((n) => n.file).filter(Boolean));
			const counts = {};
			for (const n of G.nodes) counts[n.kind] = (counts[n.kind] || 0) + 1;
			document.getElementById('title').textContent = focusScope ? frameLabel(focusScope) : 'Whole program';
			document.getElementById('meta').textContent = [
				G.scopes.length + ' scopes',
				G.nodes.length + ' bindings',
				G.edges.length + ' movements',
				files.size + ' files',
			].join('  ·  ');
		}

		function legendNode(kind, extra) {
			const n = { kind, label: '', subtitle: '', expanded: extra === 'expanded', origin: extra === 'library' ? 'library' : 'source' };
			const b = kind === 'condition' ? { x: 2, y: 1, w: 24, h: 14 } : { x: 2, y: 2, w: 24, h: 12 };
			return '<svg width="28" height="16" viewBox="0 0 28 16" aria-hidden="true">' + shapeOf(n, b) + '</svg>';
		}
		function legendEdge(kind, dash) {
			const d = dash ? ' stroke-dasharray="' + dash + '"' : '';
			return '<svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true"><path d="M 2 6 L 30 6" stroke="' + EDGE + '" stroke-width="1.5"' + d + ' marker-end="url(#lg-' + kind + ')"/></svg>';
		}
		function renderLegend() {
			const defs = '<svg width="0" height="0" style="position:absolute"><defs>'
				+ '<marker id="lg-reference" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 1 L 10 5 L 0 9 z" fill="' + EDGE + '"/></marker>'
				+ '<marker id="lg-bitwise" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="12" markerHeight="8" orient="auto"><path d="M 0 1 L 8 5 L 0 9 z M 7 1 L 15 5 L 7 9 z" fill="' + EDGE + '"/></marker>'
				+ '<marker id="lg-derive" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M 1 1.5 L 11 6 L 1 10.5 z" fill="' + BG + '" stroke="' + EDGE + '" stroke-width="1.4"/></marker>'
				+ '<marker id="lg-member" viewBox="0 0 14 10" refX="13" refY="5" markerWidth="11" markerHeight="8" orient="auto"><path d="M 1 5 L 7 1 L 13 5 L 7 9 z" fill="' + BG + '" stroke="' + EDGE + '" stroke-width="1.3"/></marker>'
				+ '</defs></svg>';
			const items = Object.keys(KIND_NAMES).map((k) => '<span>' + legendNode(k) + esc(KIND_NAMES[k]) + '</span>');
			items.push('<span>' + legendNode('variable', 'expanded') + 'Expanded</span>');
			items.push('<span>' + legendNode('return', 'library') + 'Library</span>');
			items.push('<span>' + legendEdge('reference') + 'Reference copy</span>');
			items.push('<span>' + legendEdge('bitwise') + 'Bitwise copy</span>');
			items.push('<span>' + legendEdge('derive') + 'Derived (operator)</span>');
			items.push('<span>' + legendEdge('member', '2 3') + 'Member of</span>');
			items.push('<span>' + legendEdge('reference', '7 4') + 'Expanded movement</span>');
			items.push('<span><svg width="28" height="16" viewBox="0 0 28 16" aria-hidden="true"><rect x="1.5" y="1.5" width="25" height="13" rx="4" fill="none" stroke="var(--vscode-editorWarning-foreground, #d18616)" stroke-width="1.5" stroke-dasharray="3 2"/></svg>Sensitive</span>');
			items.push('<span><svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true"><path d="M 2 6 L 34 6" stroke="var(--vscode-editorWarning-foreground, #d18616)" stroke-width="1.7"/></svg>Tainted flow</span>');
			items.push('<span><svg width="28" height="16" viewBox="0 0 28 16" aria-hidden="true"><rect x="1.5" y="1.5" width="25" height="13" rx="4" fill="none" stroke="' + ALERT + '" stroke-width="1.6"/></svg>Source or sink</span>');
			items.push('<span><svg width="28" height="16" viewBox="0 0 28 16" aria-hidden="true"><rect x="1.5" y="1.5" width="25" height="13" rx="4" fill="none" stroke="' + ALERT + '" stroke-width="1.6" stroke-dasharray="3 2"/></svg>On the unsecure path</span>');
			items.push('<span>Click a binding to inspect it · double-click opens source</span>');
			items.push('<span>Drag with the mouse, or middle-click and drag, to move around</span>');
			items.push('<span>Scroll to zoom in and out</span>');
			items.push('<span>Ctrl + scroll to move up and down</span>');
			document.getElementById('legend').innerHTML = defs + items.join('');
		}

		function renderRail() {
			const q = document.getElementById('search').value.trim().toLowerCase();
			const rail = document.getElementById('rail');
			rail.innerHTML = '';
			const match = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);
			function heading(text) {
				const el = document.createElement('div');
				el.className = 'rail-label';
				el.textContent = text;
				rail.appendChild(el);
			}
			function note(text) {
				const el = document.createElement('div');
				el.className = 'rail-note';
				el.textContent = text;
				rail.appendChild(el);
			}
			function add(html, onClick, active) {
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'entry' + (active ? ' active' : '');
				btn.innerHTML = html;
				btn.addEventListener('click', onClick);
				rail.appendChild(btn);
			}
			const item = (t, k) => '<div class="t">' + esc(t) + '</div>' + (k ? '<div class="k">' + esc(k) + '</div>' : '');

			if (focusScope) {
				heading('Timeline · ' + clip(frameLabel(focusScope), 28));
				const events = G.edges.filter((e) => e.scope === focusScope).sort((a, b) => a.step - b.step || Number(a.id.slice(1)) - Number(b.id.slice(1)));
				let shown = 0;
				for (const e of events) {
					const from = nodeById.get(e.from);
					const to = nodeById.get(e.to);
					const verb = e.kind === 'member' ? ' ∈ ' : e.kind === 'derive' ? ' ⇒ ' : ' → ';
					const text = from.label + verb + to.label;
					const branch = (e.guards || []).map((g) => clip(nodeById.get(g.condition).label, 18) + ': ' + g.branch).join(', ');
					const detail = [e.kind + (e.label ? ' ' + e.label : ''), branch, e.call ? 'call ' + e.call : '', e.line ? 'line ' + e.line : ''].filter(Boolean).join('  ·  ');
					if (!match(text, detail)) continue;
					shown += 1;
					add('<div class="t"><span class="step">' + e.step + '</span>' + esc(text) + '</div><div class="k">' + esc(detail) + '</div>', () => traceEdge(e.id), trace && trace.edge === e.id);
				}
				if (!shown) note(q ? 'No matching events' : 'No movements in this scope');
			}

			heading('Entry points');
			let count = 0;
			for (const s of G.scopes) {
				if (!s.entry || s.entry === 'bean' || s.kind === 'framework') continue;
				if (!match(s.label, s.entry, s.file)) continue;
				count += 1;
				add(item(s.label, s.entry + (s.file ? '  ·  ' + s.file + ':' + s.line : '')), () => setFocus(s.id), focusScope === s.id);
			}
			if (!count) note(q ? 'No matching entries' : 'No entry points found');

			const env = G.nodes.filter((n) => n.kind === 'environment' && match(n.label, n.subtitle, n.value || ''));
			if (env.length) {
				heading('Environment');
				for (const n of env) {
					add(item(n.label, n.value ? n.subtitle + ' = ' + n.value : n.subtitle), () => {
						if (focusScope) setFocus(null);
						toggleTrace(n.id);
						revealNode(n.id);
					}, trace && trace.origin === n.id);
				}
			}

			heading('Scopes');
			if (focusScope) {
				add(item('Whole program', 'Every scope'), () => setFocus(null), false);
			}
			const byClass = new Map();
			for (const s of G.scopes) {
				if (s.kind === 'framework') continue;
				if (!match(s.label, s.class_name, s.file)) continue;
				push(byClass, s.class_name || '(top level)', s);
			}
			const runtimeScope = scopeById.get(runtime);
			if (runtimeScope && match(runtimeScope.label)) {
				add(item(runtimeScope.label, 'beans, configuration, request values'), () => setFocus(runtime), focusScope === runtime);
			}
			for (const cls of Array.from(byClass.keys()).sort()) {
				const el = document.createElement('div');
				el.className = 'rail-note';
				el.style.paddingTop = '6px';
				el.textContent = cls;
				rail.appendChild(el);
				for (const s of byClass.get(cls)) {
					add(item(s.label, s.kind + (s.file ? '  ·  ' + s.file + ':' + s.line : '')), () => setFocus(s.id), focusScope === s.id);
				}
			}

			if (q) {
				const hits = G.nodes.filter((n) => match(n.label, n.subtitle)).slice(0, 40);
				if (hits.length) {
					heading('Bindings');
					for (const n of hits) {
						add(item(n.label, (KIND_NAMES[n.kind] || n.kind) + '  ·  ' + frameLabel(frameOf(n))), () => {
							if (!laid.pos[n.id]) setFocus(frameOf(n));
							toggleTrace(n.id);
							revealNode(n.id);
						}, trace && trace.origin === n.id);
					}
				}
			}
		}

		function bindPan() {
			const vp = document.getElementById('viewport');
			let panning = false;
			let captured = null;
			let ox = 0, oy = 0, ol = 0, ot = 0;
			const stop = () => {
				panning = false;
				vp.classList.remove('panning');
				if (captured !== null && vp.hasPointerCapture(captured)) {
					try { vp.releasePointerCapture(captured); } catch (err) { /* already released */ }
				}
				captured = null;
			};
			vp.addEventListener('pointerdown', (event) => {
				const background = event.button === 0 && !event.target.closest('.node, .frame-title');
				const cardOpen = document.getElementById('hover').style.display === 'block';
				if (event.button === 0 && background) dismissInspect();
				if (cardOpen) return;
				if (event.button !== 1 && !background) return;
				event.preventDefault();
				panning = true;
				captured = event.pointerId;
				ox = event.clientX; oy = event.clientY; ol = vp.scrollLeft; ot = vp.scrollTop;
				vp.classList.add('panning');
				try { vp.setPointerCapture(event.pointerId); } catch (err) { /* capture is optional */ }
			});
			vp.addEventListener('pointermove', (event) => {
				if (!panning) return;
				if ((event.buttons & 5) === 0) { stop(); return; }
				event.preventDefault();
				vp.scrollLeft = ol - (event.clientX - ox);
				vp.scrollTop = ot - (event.clientY - oy);
			});
			vp.addEventListener('pointerup', stop);
			vp.addEventListener('pointercancel', stop);
			vp.addEventListener('lostpointercapture', (event) => {
				if ((event.buttons & 5) === 0) stop();
			});
			window.addEventListener('pointerup', stop);
			window.addEventListener('pointercancel', stop);
			window.addEventListener('blur', stop);
			document.addEventListener('pointerdown', (event) => {
				if (event.button === 1) event.preventDefault();
			}, true);
			vp.addEventListener('auxclick', (event) => { if (event.button === 1) event.preventDefault(); });
		}

		function zoomTo(next, anchorX, anchorY) {
			const vp = document.getElementById('viewport');
			const ax = anchorX == null ? vp.clientWidth / 2 : anchorX;
			const ay = anchorY == null ? vp.clientHeight / 2 : anchorY;
			const cx = (vp.scrollLeft + ax) / scale;
			const cy = (vp.scrollTop + ay) / scale;
			scale = Math.min(2.2, Math.max(0.2, next));
			applyScale();
			vp.scrollLeft = cx * scale - ax;
			vp.scrollTop = cy * scale - ay;
		}

		document.getElementById('search').addEventListener('input', renderRail);
		document.getElementById('zoom-in').addEventListener('click', () => zoomTo(scale * 1.15));
		document.getElementById('zoom-out').addEventListener('click', () => zoomTo(scale / 1.15));
		document.getElementById('zoom-fit').addEventListener('click', fit);
		document.getElementById('viewport').addEventListener('wheel', (event) => {
			if (document.getElementById('hover').style.display === 'block') {
				event.preventDefault();
				return;
			}
			event.preventDefault();
			const vp = document.getElementById('viewport');
			let dy = event.deltaY;
			let dx = event.deltaX;
			if (event.deltaMode === 1) { dy *= 16; dx *= 16; }
			else if (event.deltaMode === 2) { dy *= vp.clientHeight; dx *= vp.clientWidth; }
			if (event.ctrlKey || event.metaKey) {
				vp.scrollTop += dy;
				vp.scrollLeft += dx;
				return;
			}
			if (!dy) return;
			const rect = vp.getBoundingClientRect();
			zoomTo(scale * (dy < 0 ? 1.08 : 0.92), event.clientX - rect.left, event.clientY - rect.top);
		}, { passive: false });
		let filterRules = new Set();
		let filterQuery = '';

		function syncFilterBadge() {
			const badge = document.getElementById('filter-badge');
			const toggle = document.getElementById('filter-toggle');
			const count = filterRules.size;
			badge.hidden = count === 0;
			badge.textContent = String(count);
			toggle.classList.toggle('has-filters', count > 0);
			const clear = document.getElementById('filter-clear');
			if (clear) clear.disabled = count === 0;
		}

		function applyFilterQuery() {
			const q = filterQuery.trim().toLowerCase();
			const list = document.getElementById('filter-list');
			let shown = 0;
			list.querySelectorAll('label').forEach((label) => {
				const hide = !!q && (label.textContent || '').toLowerCase().indexOf(q) < 0;
				label.classList.toggle('is-hidden', hide);
				if (!hide) shown += 1;
			});
			let empty = document.getElementById('filter-miss');
			if (!empty) {
				empty = document.createElement('div');
				empty.id = 'filter-miss';
				empty.className = 'empty';
				empty.textContent = 'No matching vulnerabilities.';
				list.appendChild(empty);
			}
			empty.hidden = !q || shown > 0;
		}

		function ruleKey(issue) {
			return issue.rule_id || issue.title || issue.id;
		}

		function selectedIssueNodes() {
			const nodes = new Set();
			const edges = new Set();
			for (const issue of G.issues || []) {
				if (!filterRules.has(ruleKey(issue))) continue;
				for (const id of issue.nodes || []) nodes.add(id);
				if (issue.focus) nodes.add(issue.focus);
				for (const id of issue.edges || []) edges.add(id);
			}
			return { nodes, edges };
		}

		function applyFilter() {
			const vp = document.getElementById('viewport');
			const active = filterRules.size > 0;
			const kept = active ? selectedIssueNodes() : { nodes: new Set(), edges: new Set() };
			const frames = new Set();
			if (active) {
				for (const id of kept.nodes) {
					const n = nodeById.get(id);
					if (n) frames.add(frameOf(n));
				}
			}
			vp.classList.toggle('filtering', active);
			vp.querySelectorAll('.node').forEach((el) => {
				el.classList.toggle('keep', active && kept.nodes.has(el.getAttribute('data-node-id')));
			});
			vp.querySelectorAll('[data-edge]').forEach((el) => {
				el.classList.toggle('keep', active && kept.edges.has(el.getAttribute('data-edge')));
			});
			vp.querySelectorAll('.frame').forEach((el) => {
				el.classList.toggle('keep', active && frames.has(el.getAttribute('data-frame')));
			});
			if (trace) return;
			const status = document.getElementById('status');
			if (!active) {
				if (!status.querySelector('#clear-trace')) status.innerHTML = '';
				return;
			}
			const names = [];
			const seen = new Set();
			for (const issue of G.issues || []) {
				const key = ruleKey(issue);
				if (!filterRules.has(key) || seen.has(key)) continue;
				seen.add(key);
				names.push(issue.title || key);
			}
			status.textContent = 'Showing ' + names.join(', ') + '  ·  ' + kept.nodes.size + ' bindings';
		}

		function renderFilter() {
			const list = document.getElementById('filter-list');
			const groups = new Map();
			for (const issue of G.issues || []) {
				const key = ruleKey(issue);
				if (!groups.has(key)) groups.set(key, { title: issue.title || key, cwe: issue.cwe || '', n: 0 });
				groups.get(key).n += 1;
			}
			if (!groups.size) {
				list.innerHTML = '<div class="empty">No vulnerabilities from the rule scripts.</div>';
				syncFilterBadge();
				return;
			}
			const keys = Array.from(groups.keys()).sort((a, b) => groups.get(a).title.localeCompare(groups.get(b).title));
			list.innerHTML = keys.map((key) => {
				const g = groups.get(key);
				const meta = [g.cwe, g.n === 1 ? '1 site' : g.n + ' sites'].filter(Boolean).join(' · ');
				return '<label><input type="checkbox" data-rule="' + esc(key) + '"' + (filterRules.has(key) ? ' checked' : '') + ' /><span><span class="name">' + esc(g.title) + '</span><span class="meta">' + esc(meta) + '</span></span></label>';
			}).join('');
			list.querySelectorAll('input').forEach((box) => {
				box.addEventListener('change', () => {
					const key = box.getAttribute('data-rule');
					if (box.checked) filterRules.add(key);
					else filterRules.delete(key);
					syncFilterBadge();
					const kept = selectedIssueNodes().nodes;
					const hidden = Array.from(kept).some((id) => !laid || !laid.pos[id]);
					if (hidden && focusScope) setFocus(null);
					else applyFilter();
					const first = Array.from(kept)[0];
					if (first && laid && laid.pos[first]) revealNode(first);
				});
			});
			applyFilterQuery();
			syncFilterBadge();
		}

		function normPath(p) {
			const sep = String.fromCharCode(92);
			return String(p || '').split(sep).join('/').toLowerCase();
		}

		function sameFile(a, b) {
			const x = normPath(a);
			const y = normPath(b);
			if (!x || !y) return false;
			return x === y || x.endsWith('/' + y) || y.endsWith('/' + x);
		}

		function matchIssue(target) {
			const issues = G.issues || [];
			const line = Number(target.line);
			const title = String(target.title || '');
			const cwe = String(target.cwe || '');
			const file = String(target.file || '');
			let loose = null;
			for (let i = 0; i < issues.length; i++) {
				const issue = issues[i];
				if (line && Number(issue.line) !== line) continue;
				if (file && issue.file && !sameFile(issue.file, file)) continue;
				if (!loose) loose = issue;
				const titleOk = !title || !issue.title || issue.title === title;
				const cweOk = !cwe || !issue.cwe || issue.cwe === cwe;
				if (titleOk && cweOk) return issue;
			}
			return loose;
		}

		function openIssue(target) {
			if (!target) return;
			const issue = matchIssue(target);
			if (!issue) return;
			filterRules = new Set([ruleKey(issue)]);
			renderFilter();
			const kept = selectedIssueNodes().nodes;
			const hidden = Array.from(kept).some((id) => !laid || !laid.pos[id]);
			if (hidden && focusScope) setFocus(null);
			else applyFilter();
			const dest = issue.focus || (issue.ends && issue.ends[0]) || (issue.nodes && issue.nodes[0]);
			if (dest) travelTo(dest);
		}

		document.getElementById('filter-clear').addEventListener('click', () => {
			filterRules = new Set();
			filterQuery = '';
			const search = document.getElementById('filter-search');
			search.value = '';
			renderFilter();
			applyFilter();
		});
		document.getElementById('filter-search').addEventListener('input', (event) => {
			filterQuery = event.target.value;
			applyFilterQuery();
		});
		document.getElementById('filter-toggle').addEventListener('click', () => {
			const panel = document.getElementById('filter');
			panel.hidden = !panel.hidden;
			document.getElementById('filter-toggle').setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
			if (!panel.hidden) document.getElementById('filter-search').focus();
		});

		window.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			const panel = document.getElementById('filter');
			if (!panel.hidden) { panel.hidden = true; document.getElementById('filter-toggle').setAttribute('aria-expanded', 'false'); return; }
			dismissInspect();
		});

		const hover = document.getElementById('hover');
		hover.addEventListener('wheel', (event) => {
			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				return;
			}
			const code = event.target.closest('.code');
			if (!code || !event.shiftKey) return;
			event.preventDefault();
			code.scrollLeft += event.deltaY;
		}, { passive: false });
		hover.addEventListener('click', (event) => {
			const jump = event.target.closest('.jump-code');
			if (jump) {
				const filePath = jump.getAttribute('data-file');
				const ln = Number(jump.getAttribute('data-line') || 0);
				if (filePath && ln) vscode.postMessage({ type: 'goto-line', filePath, line: ln, column: 0 });
				return;
			}
			const go = event.target.closest('[data-goto]');
			if (go) {
				travelTo(go.getAttribute('data-goto'));
				return;
			}
			const line = event.target.closest('.code-line');
			const block = event.target.closest('.code');
			if (!block) return;
			const selected = window.getSelection();
			if (selected && String(selected) !== '') return;
			const filePath = block.getAttribute('data-file');
			const ln = Number((line && line.getAttribute('data-line')) || 0);
			if (!filePath || !ln) return;
			vscode.postMessage({ type: 'goto-line', filePath, line: ln, column: 0 });
		});
		document.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			const panel = document.getElementById('filter');
			const toggle = document.getElementById('filter-toggle');
			if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) {
				panel.hidden = true;
				toggle.setAttribute('aria-expanded', 'false');
			}
			if (event.target.closest('#hover') || event.target.closest('.node')) return;
			dismissInspect();
		});
		document.getElementById('viewport').addEventListener('scroll', () => {
			if (hover.style.display !== 'block' || !hotId) return;
			const el = document.querySelector('.node[data-node-id="' + hotId + '"]');
			if (el) placeHover(el);
		});

		bindPan();
		renderFilter();
		renderLegend();
		renderHeader();
		renderGraph();
		fit();
		renderRail();
		window.addEventListener('message', (event) => {
			const msg = event.data;
			if (!msg || msg.type !== 'focus-issue') return;
			openIssue(msg);
		});
		const focusNode = document.getElementById('audit-focus');
		const initialFocus = focusNode ? JSON.parse(focusNode.textContent) : null;
		if (initialFocus) openIssue(initialFocus);
	</script>
</body>
</html>`;
}

function emptyShell(title: string, message: string): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><style>
	html,body{margin:0;height:100%;overflow:hidden}
	body{padding:48px 24px;font-family:var(--vscode-font-family,sans-serif);
	color:var(--vscode-foreground,#e6e6e6);background:var(--vscode-editor-background,#1e1e1e);text-align:center}
	h2{margin:0 0 8px;font-size:15px} p{margin:0;color:var(--vscode-descriptionForeground,#a0a0a0);font-size:12px}
</style></head><body><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></body></html>`;
}

export const buildTreeViewHtml = buildDataAuditHtml;
export type TreeViewPayload = DataAuditPayload;
