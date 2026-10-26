/**
 * Flowchart panel. The core sends one chart for the whole project.
 * Flow reads left to right. Terminators, processes, decisions, and calls
 * use ordinary programming-flowchart symbols. A dashed border marks a
 * method entered through an annotation.
 */

import { severityCssVars } from '../severityColors.js';
import { buildStartupLoadingHtml } from './startupLoading.js';

export interface FlowNodeView {
	id: string;
	kind: string;
	label: string;
	subtitle: string;
	file: string;
	line: number;
	column: number;
	/** `path` when the node sits on a confirmed source-to-sink trace. */
	taint_mark?: string;
	/** Synthesized from an annotation. Drawn with a dashed border. */
	dashed?: boolean;
	rule_labels?: string[];
	severity?: string;
	cwe?: string;
}

export interface FlowEdgeView {
	from: string;
	to: string;
	on_taint_path: boolean;
	/** `Yes`, `No`, or a switch case. */
	label?: string;
	/** When false, the edge is drawn but does not place the blocks. */
	rank?: boolean;
}

export interface FlowChartView {
	id: string;
	title: string;
	/** `main` | `request` | `listener` | `scheduled` | `root` */
	entry_kind: string;
	file: string;
	line: number;
	insecure: boolean;
	truncated: boolean;
	source_count: number;
	sink_count: number;
	open_paths: number;
	nodes: FlowNodeView[];
	edges: FlowEdgeView[];
}

export interface FlowchartPayload {
	type: 'Flowchart';
	charts: FlowChartView[];
}

export interface TreeViewPanelOptions {
	signedIn?: boolean;
	loading?: boolean;
	scannerBroken?: boolean;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function buildFlowchartHtml(
	payload: FlowchartPayload | null,
	options: TreeViewPanelOptions = {},
): string {
	if (options.loading) {
		return buildStartupLoadingHtml('Loading flowchart…');
	}
	if (options.scannerBroken) {
		return emptyShell('Scanner unavailable', 'Repair the Ariadne binary in Core settings.');
	}
	if (options.signedIn === false) {
		return emptyShell('Sign in required', 'Sign in to GitHub to open the flowchart.');
	}
	if (!payload || payload.charts.length === 0 || payload.charts[0].nodes.length === 0) {
		return emptyShell('No methods indexed', 'Analyze a Java project to build its flowchart.');
	}

	const dataJson = JSON.stringify(payload).replaceAll('<', '\\u003c');

	return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Flowchart</title>
	<style>
		${severityCssVars()}
		:root {
			--mono: var(--vscode-editor-font-family, ui-monospace, monospace);
		}
		* { box-sizing: border-box; }
		html, body { margin: 0; height: 100%; overflow: hidden; }
		body {
			display: flex;
			font-family: var(--vscode-font-family, system-ui, sans-serif);
			font-size: 13px;
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
		}
		.rail {
			width: 240px;
			flex: 0 0 240px;
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
		.rail-list { overflow: auto; padding: 0 8px 12px; }
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
			padding: 8px 8px 8px 10px;
			margin-bottom: 4px;
			cursor: pointer;
			font: inherit;
		}
		.entry:hover { background: var(--vscode-list-hoverBackground); }
		.entry.active {
			border-color: var(--vscode-focusBorder);
			background: var(--vscode-list-activeSelectionBackground);
			color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
		}
		.entry .t { font-weight: 700; font-family: var(--mono); font-size: 12px; }
		.entry .k { margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; }
		.entry .dot {
			display: inline-block;
			width: 7px;
			height: 7px;
			border-radius: 50%;
			margin-right: 6px;
			background: var(--critical, #e24b4a);
			vertical-align: middle;
		}
		.stage { flex: 1; min-width: 0; display: flex; flex-direction: column; }
		.chart-head {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 12px;
			padding: 12px 16px 8px;
			border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
		}
		.chart-head h1 { margin: 0; font-size: 15px; }
		.chart-head .meta { margin-top: 3px; color: var(--vscode-descriptionForeground); font-size: 12px; font-family: var(--mono); }
		.tools { display: flex; gap: 6px; align-items: center; }
		.tools button {
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
			gap: 10px 14px;
			padding: 8px 16px;
			color: var(--vscode-descriptionForeground);
			font-size: 11px;
		}
		.swatch { display: inline-block; width: 18px; height: 10px; margin-right: 5px; vertical-align: -1px; border: 1.5px solid var(--vscode-foreground); background: var(--vscode-input-background, var(--vscode-editorWidget-background)); }
		.swatch.term { border-radius: 8px; border-color: var(--vscode-testing-iconPassed, var(--vscode-charts-green, var(--vscode-focusBorder))); }
		.swatch.decision { width: 11px; height: 11px; transform: rotate(45deg); margin-right: 8px; vertical-align: -2px; border-color: var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow)); }
		.swatch.call { border-color: var(--vscode-textLink-foreground, var(--vscode-charts-blue)); box-shadow: inset 3px 0 0 var(--vscode-textLink-foreground, var(--vscode-charts-blue)), inset -3px 0 0 var(--vscode-textLink-foreground, var(--vscode-charts-blue)); }
		.swatch.expanded { border-style: dashed; border-width: 1.5px; }
		.viewport {
			flex: 1;
			overflow: auto;
			background-image: radial-gradient(circle, var(--vscode-widget-border, var(--vscode-panel-border)) 1px, transparent 1px);
			background-size: 18px 18px;
		}
		.viewport.panning, .viewport.panning * { cursor: grabbing !important; user-select: none; }
		svg { display: block; }
		.node { cursor: pointer; }
		.node text { fill: var(--vscode-editor-foreground, var(--vscode-foreground)); font-family: var(--mono); }
		.shape :is(rect, ellipse, polygon, line) {
			fill: var(--vscode-input-background, var(--vscode-editorWidget-background));
			stroke: var(--vscode-foreground);
			stroke-width: 1.6;
		}
		.shape.term :is(rect, ellipse, polygon, line) {
			stroke: var(--vscode-testing-iconPassed, var(--vscode-charts-green, var(--vscode-focusBorder)));
		}
		.shape.decision :is(rect, ellipse, polygon, line) {
			stroke: var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow));
		}
		.shape.call :is(rect, ellipse, polygon, line) {
			stroke: var(--vscode-textLink-foreground, var(--vscode-charts-blue));
		}
		.shape.dashed :is(rect, ellipse, polygon, line) { stroke-dasharray: 7 4; }
		.edge { fill: none; stroke: var(--vscode-descriptionForeground, var(--vscode-foreground)); stroke-width: 1.4; }
		.edge-label { fill: var(--vscode-descriptionForeground, var(--vscode-foreground)); font-size: 11px; font-family: var(--mono); }
		.viewport.has-hot .edge,
		.viewport.has-hot .edge-label { opacity: 0.28; }
		@keyframes edge-flow {
			from { stroke-dashoffset: 0; }
			to { stroke-dashoffset: -36; }
		}
		.viewport.has-hot .edge.hot {
			opacity: 1;
			stroke: var(--vscode-charts-purple, var(--vscode-symbolIcon-keywordForeground, #b180d7));
			stroke-width: 2.4;
			stroke-dasharray: 10 8;
			animation: edge-flow 0.55s linear infinite;
		}
		.viewport.has-hot .edge-label.hot { opacity: 1; fill: var(--vscode-charts-purple, var(--vscode-symbolIcon-keywordForeground, #b180d7)); }
		@media (prefers-reduced-motion: reduce) {
			.viewport.has-hot .edge.hot { animation: none; }
		}
		.node.hot .shape :is(rect, ellipse, polygon, line) { stroke: var(--vscode-charts-purple, var(--vscode-symbolIcon-keywordForeground, #b180d7)); stroke-width: 2.6; }
	</style>
</head>
<body>
	<aside class="rail">
		<div class="rail-head">Whole program</div>
		<input class="rail-search" id="search" type="search" placeholder="Filter entries and files" />
		<div class="rail-list" id="rail"></div>
	</aside>
	<section class="stage">
		<div class="chart-head">
			<div>
				<h1 id="title">Flowchart</h1>
				<div class="meta" id="meta"></div>
			</div>
			<div class="tools">
				<button type="button" id="zoom-out" title="Zoom out">−</button>
				<button type="button" id="zoom-fit" title="Fit">Fit</button>
				<button type="button" id="zoom-in" title="Zoom in">+</button>
			</div>
		</div>
		<div class="legend">
			<span><i class="swatch term"></i>Terminator</span>
			<span><i class="swatch"></i>Process</span>
			<span><i class="swatch decision"></i>Decision</span>
			<span><i class="swatch call"></i>Function</span>
			<span><i class="swatch expanded"></i>Annotation entry</span>
		</div>
		<div class="viewport" id="viewport"></div>
	</section>
	<script type="application/json" id="payload">${dataJson}</script>
	<script>
		const vscode = acquireVsCodeApi();
		const payload = JSON.parse(document.getElementById('payload').textContent);
		const chart = payload.charts[0];
		let scale = 1;
		let lastPos = {};
		let baseW = 1;
		let baseH = 1;

		function esc(s) {
			return String(s == null ? '' : s)
				.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		}
		function wrapLabel(text, width) {
			const raw = String(text || '').trim();
			if (!raw) return [];
			const lines = [];
			let rest = raw;
			while (rest.length > width && lines.length < 3) {
				let cut = rest.lastIndexOf(' ', width);
				if (cut < Math.floor(width * 0.45)) cut = width;
				lines.push(rest.slice(0, cut).trim());
				rest = rest.slice(cut).trim();
			}
			if (rest) {
				if (lines.length >= 3) {
					const last = lines[2];
					lines[2] = (last + ' ' + rest).length > width
						? last.slice(0, Math.max(1, width - 1)) + '…'
						: last + ' ' + rest;
				} else {
					lines.push(rest.length > width ? rest.slice(0, width - 1) + '…' : rest);
				}
			}
			return lines.filter(Boolean);
		}
		function measure(node) {
			const kind = node.kind === 'branch' ? 'decision' : node.kind;
			const wrapAt = kind === 'decision' ? 22 : 34;
			const lines = wrapLabel(node.label || '', wrapAt);
			const shown = lines.length ? lines : [''];
			const longest = shown.reduce((m, s) => Math.max(m, s.length), 1);
			let w;
			let h;
			if (kind === 'decision') {
				w = Math.max(172, Math.min(300, longest * 7.6 + 84));
				h = Math.max(100, 52 + shown.length * 16 + 28);
			} else if (kind === 'start' || kind === 'end') {
				w = Math.max(150, Math.min(320, longest * 7.8 + 44));
				h = Math.max(48, 24 + shown.length * 16);
			} else if (kind === 'call') {
				w = Math.max(168, Math.min(340, longest * 7.4 + 52));
				h = Math.max(46, 20 + shown.length * 16);
			} else {
				w = Math.max(160, Math.min(340, longest * 7.4 + 36));
				h = Math.max(44, 18 + shown.length * 16);
			}
			return { w, h, lines: shown };
		}

		function layout(chart) {
			const nodes = chart.nodes || [];
			const edges = chart.edges || [];
			const sizes = {};
			for (const n of nodes) sizes[n.id] = measure(n);
			function ranked(e) {
				return e && e.rank !== false && e.from !== e.to;
			}
			const layer = {};
			const adj = {};
			for (const n of nodes) {
				layer[n.id] = 0;
				adj[n.id] = [];
			}
			const color = {};
			const back = new Set();
			function dfs(u) {
				color[u] = 1;
				for (const v of adj[u] || []) {
					if (color[v] === 1) back.add(u + '\\0' + v);
					else if (color[v] !== 2) dfs(v);
				}
				color[u] = 2;
			}
			for (const e of edges) {
				if (ranked(e) && adj[e.from]) adj[e.from].push(e.to);
			}
			for (const n of nodes) if (color[n.id] !== 2) dfs(n.id);

			const indeg = {};
			const fwd = {};
			for (const n of nodes) { indeg[n.id] = 0; fwd[n.id] = []; }
			for (const e of edges) {
				if (!ranked(e) || back.has(e.from + '\\0' + e.to)) continue;
				if (fwd[e.from] && indeg[e.to] != null) {
					fwd[e.from].push(e.to);
					indeg[e.to] += 1;
				}
			}
			const q = [];
			for (const n of nodes) if (indeg[n.id] === 0) q.push(n.id);
			for (const id of q) layer[id] = 0;
			let qi = 0;
			while (qi < q.length) {
				const u = q[qi++];
				for (const v of fwd[u] || []) {
					layer[v] = Math.max(layer[v] || 0, (layer[u] || 0) + 1);
					indeg[v] -= 1;
					if (indeg[v] === 0) q.push(v);
				}
			}

			let maxL = 0;
			for (const n of nodes) maxL = Math.max(maxL, layer[n.id] || 0);
			const columns = [];
			for (let i = 0; i <= maxL; i++) columns.push([]);
			for (const n of nodes) columns[layer[n.id] || 0].push(n);
			for (const col of columns) {
				col.sort((a, b) => (a.file || '').localeCompare(b.file || '') || (a.label || '').localeCompare(b.label || '') || a.id.localeCompare(b.id));
			}

			const parents = {};
			const children = {};
			for (const n of nodes) { parents[n.id] = []; children[n.id] = []; }
			for (const e of edges) {
				if (!ranked(e) || back.has(e.from + '\\0' + e.to)) continue;
				if (parents[e.to]) parents[e.to].push(e.from);
				if (children[e.from]) children[e.from].push(e.to);
			}
			for (let pass = 0; pass < 8; pass++) {
				const index = {};
				for (const col of columns) col.forEach((n, i) => { index[n.id] = i; });
				const bary = (ids, self) => {
					if (!ids || !ids.length) return index[self] || 0;
					let s = 0;
					for (const id of ids) s += index[id] || 0;
					return s / ids.length;
				};
				const useParents = pass % 2 === 0;
				for (const col of columns) {
					col.sort((a, b) => {
						const ba = bary(useParents ? parents[a.id] : children[a.id], a.id);
						const bb = bary(useParents ? parents[b.id] : children[b.id], b.id);
						if (ba !== bb) return ba - bb;
						return a.id < b.id ? -1 : 1;
					});
				}
			}

			const GAP_Y = 28;
			const PAD = 36;
			const pos = {};
			const colX = [];
			const colW = [];
			const colH = [];
			let maxH = 0;
			for (const col of columns) {
				let h = 0;
				let maxW = 46;
				col.forEach((n, i) => {
					const s = sizes[n.id];
					h += s.h;
					if (i) h += GAP_Y;
					maxW = Math.max(maxW, s.w);
				});
				colH.push(h);
				colW.push(maxW);
				maxH = Math.max(maxH, h);
			}
			function columnGap(height) {
				const extra = Math.max(0, height - 180);
				return Math.round(Math.min(560, 96 + extra * 0.16));
			}
			let x = PAD;
			for (let ci = 0; ci < columns.length; ci++) {
				colX.push(x);
				const between = ci + 1 < columns.length ? Math.max(colH[ci], colH[ci + 1]) : 0;
				const gap = ci + 1 < columns.length ? columnGap(between) : 0;
				x += colW[ci] + gap;
			}
			columns.forEach((col, ci) => {
				let y = PAD + (maxH - colH[ci]) / 2;
				for (const n of col) {
					const s = sizes[n.id];
					pos[n.id] = { x: colX[ci], y, w: s.w, h: s.h, lines: s.lines };
					y += s.h + GAP_Y;
				}
			});
			const width = Math.max(x + PAD, 320);
			const height = maxH + PAD * 2;
			return { pos, back, width, height };
		}

		function shape(node, box) {
			const x = box.x, y = box.y, w = box.w, h = box.h;
			const kind = node.kind === 'branch' ? 'decision' : node.kind;
			let stroke = 'var(--vscode-foreground)';
			if (kind === 'start' || kind === 'end') stroke = 'var(--vscode-testing-iconPassed, var(--vscode-charts-green, var(--vscode-focusBorder)))';
			else if (kind === 'decision') stroke = 'var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow))';
			else if (kind === 'call') stroke = 'var(--vscode-textLink-foreground, var(--vscode-charts-blue))';
			const paint = ' fill="var(--vscode-input-background, var(--vscode-editorWidget-background))" stroke="' + stroke + '" stroke-width="1.6"';
			if (kind === 'start' || kind === 'end') {
				return '<ellipse' + paint + ' cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + (w / 2) + '" ry="' + (h / 2) + '"/>';
			}
			if (kind === 'decision') {
				const cx = x + w / 2, cy = y + h / 2;
				return '<polygon' + paint + ' points="' + cx + ',' + y + ' ' + (x + w) + ',' + cy + ' ' + cx + ',' + (y + h) + ' ' + x + ',' + cy + '"/>';
			}
			const rect = '<rect' + paint + ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4"/>';
			if (kind === 'call') {
				return rect
					+ '<line' + paint + ' x1="' + (x + 10) + '" y1="' + y + '" x2="' + (x + 10) + '" y2="' + (y + h) + '"/>'
					+ '<line' + paint + ' x1="' + (x + w - 10) + '" y1="' + y + '" x2="' + (x + w - 10) + '" y2="' + (y + h) + '"/>';
			}
			return rect;
		}

		function textBlock(lines, cx, cy) {
			const shown = (lines || []).filter(Boolean);
			if (!shown.length) return '';
			const lh = 15;
			const start = cy - ((shown.length - 1) * lh) / 2;
			let out = '';
			for (let i = 0; i < shown.length; i++) {
				out += '<text x="' + cx + '" y="' + (start + i * lh) + '" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--vscode-editor-foreground, var(--vscode-foreground))">'
					+ esc(shown[i]) + '</text>';
			}
			return out;
		}

		function paintNode(node, box) {
			const kind = node.kind === 'branch' ? 'decision' : node.kind;
			let tone = 'process';
			if (kind === 'start' || kind === 'end') tone = 'term';
			else if (kind === 'decision') tone = 'decision';
			else if (kind === 'call') tone = 'call';
			const toneClass = 'shape ' + tone + (node.dashed ? ' dashed' : '');
			const cx = box.x + box.w / 2;
			const cy = box.y + box.h / 2;
			const tip = [node.label, node.file && node.line ? node.file + ':' + node.line : '']
				.filter(Boolean).join(' · ');
			return '<g class="node" data-node-id="' + esc(node.id) + '" data-file="' + esc(node.file) + '" data-line="' + String(node.line || 0) + '" data-col="' + String(node.column || 0) + '">'
				+ '<title>' + esc(tip) + '</title>'
				+ '<g class="' + toneClass + '">' + shape(node, box) + '</g>'
				+ textBlock(box.lines, cx, cy) + '</g>';
		}

		function sidePoint(box, side, index, count) {
			const pad = Math.min(12, box.h * 0.22);
			const span = Math.max(1, box.h - pad * 2);
			const t = count <= 1 ? 0.5 : index / (count - 1);
			const y = box.y + pad + span * t;
			const x = side === 'right' ? box.x + box.w : box.x;
			return { x, y };
		}

		function curve(a, b, back, outSlot, inSlot) {
			if (!a || !b) return null;
			if (a === b) {
				const x = a.x + a.w * 0.7;
				const y = a.y;
				return {
					p0: { x: x, y: y },
					p1: { x: x + 28, y: y - 34 },
					p2: { x: a.x + a.w + 18, y: y + 8 },
					p3: { x: a.x + a.w, y: a.y + 16 },
				};
			}
			const from = sidePoint(a, 'right', outSlot.i, outSlot.n);
			const to = sidePoint(b, back ? 'right' : 'left', inSlot.i, inSlot.n);
			if (back || to.x <= from.x + 12) {
				const bow = 42 + Math.min(90, Math.abs(to.y - from.y) * 0.2);
				const lift = from.y <= to.y ? -bow : bow;
				return {
					p0: from,
					p1: { x: from.x + 48, y: from.y + lift },
					p2: { x: to.x + 48, y: to.y + lift },
					p3: to,
				};
			}
			const dx = to.x - from.x;
			const pull = Math.max(48, Math.min(dx * 0.42, 280));
			return {
				p0: from,
				p1: { x: from.x + pull, y: from.y },
				p2: { x: to.x - pull, y: to.y },
				p3: to,
			};
		}

		function route(a, b, back, outSlot, inSlot) {
			const c = curve(a, b, back, outSlot, inSlot);
			if (!c) return '';
			return 'M ' + c.p0.x + ' ' + c.p0.y
				+ ' C ' + c.p1.x + ' ' + c.p1.y
				+ ', ' + c.p2.x + ' ' + c.p2.y
				+ ', ' + c.p3.x + ' ' + c.p3.y;
		}

		function bezierAt(c, t) {
			const u = 1 - t;
			const uu = u * u;
			const tt = t * t;
			return {
				x: uu * u * c.p0.x + 3 * uu * t * c.p1.x + 3 * u * tt * c.p2.x + tt * t * c.p3.x,
				y: uu * u * c.p0.y + 3 * uu * t * c.p1.y + 3 * u * tt * c.p2.y + tt * t * c.p3.y,
			};
		}

		function labelSpots(c) {
			const mid = bezierAt(c, 0.5);
			const ahead = bezierAt(c, 0.62);
			const len = Math.hypot(ahead.x - mid.x, ahead.y - mid.y) || 1;
			let nx = -(ahead.y - mid.y) / len;
			let ny = (ahead.x - mid.x) / len;
			if (ny > 0) { nx = -nx; ny = -ny; }
			return [0.16, 0.84].map((t) => {
				const p = bezierAt(c, t);
				return { x: p.x + nx * 13, y: p.y + ny * 13 };
			});
		}

		function renderChart() {
			document.getElementById('title').textContent = 'Program';
			const files = new Set((chart.nodes || []).map((n) => n.file).filter(Boolean));
			const processes = (chart.nodes || []).filter((n) => n.kind === 'process').length;
			const calls = (chart.nodes || []).filter((n) => n.kind === 'call').length;
			const decisions = (chart.nodes || []).filter((n) => n.kind === 'decision' || n.kind === 'branch').length;
			const bits = [
				files.size + ' files',
				processes + ' processes',
				calls + ' calls',
				decisions + ' decisions',
			];
			document.getElementById('meta').textContent = bits.join('  ·  ');

			const laid = layout(chart);
			lastPos = laid.pos;
			baseW = laid.width;
			baseH = laid.height;
			const drawn = (chart.edges || []).filter((e) => laid.pos[e.from] && laid.pos[e.to]);
			const outgoing = {};
			const incoming = {};
			for (const e of drawn) {
				if (e.from === e.to) continue;
				(outgoing[e.from] ||= []).push(e);
				(incoming[e.to] ||= []).push(e);
			}
			for (const id of Object.keys(outgoing)) {
				outgoing[id].sort((a, b) => laid.pos[a.to].y - laid.pos[b.to].y || a.to.localeCompare(b.to));
			}
			for (const id of Object.keys(incoming)) {
				incoming[id].sort((a, b) => laid.pos[a.from].y - laid.pos[b.from].y || a.from.localeCompare(b.from));
			}
			let edges = '';
			let edgeLabels = '';
			for (const e of drawn) {
				const a = laid.pos[e.from];
				const b = laid.pos[e.to];
				const isBack = e.from !== e.to && (laid.back.has(e.from + '\\0' + e.to) || b.x + 12 < a.x);
				const outs = outgoing[e.from] || [];
				const ins = incoming[e.to] || [];
				const outSlot = { i: Math.max(0, outs.indexOf(e)), n: Math.max(1, outs.length) };
				const inSlot = { i: Math.max(0, ins.indexOf(e)), n: Math.max(1, ins.length) };
				const c = curve(a, b, isBack, outSlot, inSlot);
				edges += '<path class="edge" data-from="' + esc(e.from) + '" data-to="' + esc(e.to) + '" d="' + route(a, b, isBack, outSlot, inSlot) + '" fill="none" stroke="var(--vscode-descriptionForeground, var(--vscode-foreground))" stroke-width="1.4" marker-end="url(#arrow)"/>';
				if (e.label && c) {
					for (const spot of labelSpots(c)) {
						edgeLabels += '<text class="edge-label" data-from="' + esc(e.from) + '" data-to="' + esc(e.to) + '" x="' + spot.x + '" y="' + spot.y + '" text-anchor="middle" fill="var(--vscode-descriptionForeground, var(--vscode-foreground))">' + esc(e.label) + '</text>';
					}
				}
			}
			let bodies = '';
			for (const n of chart.nodes || []) {
				if (laid.pos[n.id]) bodies += paintNode(n, laid.pos[n.id]);
			}
			const svg = '<svg id="diagram" xmlns="http://www.w3.org/2000/svg">'
				+ '<defs>'
				+ '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke"/></marker>'
				+ '</defs><g id="world"><g id="edges">' + edges + '</g><g id="labels">' + edgeLabels + '</g><g id="nodes">' + bodies + '</g></g></svg>';
			document.getElementById('viewport').innerHTML = svg;
			document.getElementById('viewport').querySelectorAll('.node').forEach((el) => {
				const id = el.getAttribute('data-node-id');
				el.addEventListener('mouseenter', () => setHot(id));
				el.addEventListener('mouseleave', () => setHot(null));
				el.addEventListener('click', (event) => {
					if (event.button !== 0) return;
					const filePath = el.getAttribute('data-file');
					const line = Number(el.getAttribute('data-line') || 0);
					if (!filePath || !line) return;
					vscode.postMessage({
						type: 'goto-line',
						filePath,
						line,
						column: Number(el.getAttribute('data-col') || 0),
					});
				});
			});
			fit();
		}

		function applyScale() {
			const svg = document.getElementById('diagram');
			const world = document.getElementById('world');
			if (!svg || !world) return;
			svg.setAttribute('width', String(Math.ceil(baseW * scale)));
			svg.setAttribute('height', String(Math.ceil(baseH * scale)));
			svg.setAttribute('viewBox', '0 0 ' + baseW + ' ' + baseH);
		}

		function fit() {
			const vp = document.getElementById('viewport');
			const sx = (vp.clientWidth - 24) / baseW;
			scale = Math.max(0.55, Math.min(1, sx));
			applyScale();
			vp.scrollTop = 0;
			vp.scrollLeft = 0;
		}

		function focusNode(id) {
			const box = lastPos[id];
			if (!box) return;
			const vp = document.getElementById('viewport');
			vp.scrollLeft = Math.max(0, box.x * scale - vp.clientWidth / 2 + box.w / 2);
			vp.scrollTop = Math.max(0, box.y * scale - 48);
			document.querySelectorAll('.entry').forEach((el) => {
				el.classList.toggle('active', el.getAttribute('data-focus') === id);
			});
		}

		function renderRail() {
			const q = document.getElementById('search').value.trim().toLowerCase();
			const rail = document.getElementById('rail');
			rail.innerHTML = '';
			const starts = (chart.nodes || []).filter((n) => n.kind === 'start');
			const files = [];
			const seen = new Set();
			for (const n of chart.nodes || []) {
				if (!n.file || seen.has(n.file)) continue;
				seen.add(n.file);
				const anchor = (chart.nodes || []).find((m) => m.file === n.file && (m.kind === 'start' || m.kind === 'process'));
				files.push({ file: n.file, id: (anchor || n).id });
			}
			files.sort((a, b) => a.file.localeCompare(b.file));

			function heading(text) {
				const el = document.createElement('div');
				el.className = 'rail-label';
				el.textContent = text;
				rail.appendChild(el);
			}
			function add(title, detail, id) {
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'entry';
				btn.setAttribute('data-focus', id);
				btn.innerHTML = '<div class="t">' + esc(title) + '</div>'
					+ (detail ? '<div class="k">' + esc(detail) + '</div>' : '');
				btn.addEventListener('click', () => focusNode(id));
				rail.appendChild(btn);
			}

			heading('Entries');
			let entryCount = 0;
			for (const n of starts) {
				const hay = (n.label + ' ' + n.subtitle + ' ' + n.file).toLowerCase();
				if (q && !hay.includes(q)) continue;
				entryCount += 1;
				const title = n.label;
				add(title, n.file || '', n.id);
			}
			if (!entryCount) {
				const note = document.createElement('div');
				note.className = 'k';
				note.style.padding = '0 8px 8px';
				note.textContent = q ? 'No matching entries' : 'No entry points';
				rail.appendChild(note);
			}
			heading('Files');
			for (const f of files) {
				if (q && !f.file.toLowerCase().includes(q)) continue;
				add(f.file, '', f.id);
			}
		}

		function setHot(id) {
			const vp = document.getElementById('viewport');
			vp.classList.toggle('has-hot', !!id);
			document.querySelectorAll('.node').forEach((el) => {
				const on = !!id && el.getAttribute('data-node-id') === id;
				el.classList.toggle('hot', on);
				if (on && el.parentNode) el.parentNode.appendChild(el);
			});
			document.querySelectorAll('.edge, .edge-label').forEach((el) => {
				const on = !!id && (el.getAttribute('data-from') === id || el.getAttribute('data-to') === id);
				el.classList.toggle('hot', on);
				if (on && el.parentNode) el.parentNode.appendChild(el);
			});
		}

		function bindPan() {
			const vp = document.getElementById('viewport');
			let panning = false;
			let originX = 0;
			let originY = 0;
			let originLeft = 0;
			let originTop = 0;
			function stop() {
				if (!panning) return;
				panning = false;
				vp.classList.remove('panning');
			}
			vp.addEventListener('mousedown', (event) => {
				if (event.button !== 1) return;
				event.preventDefault();
				panning = true;
				originX = event.clientX;
				originY = event.clientY;
				originLeft = vp.scrollLeft;
				originTop = vp.scrollTop;
				vp.classList.add('panning');
			});
			window.addEventListener('mousemove', (event) => {
				if (!panning) return;
				event.preventDefault();
				vp.scrollLeft = originLeft - (event.clientX - originX);
				vp.scrollTop = originTop - (event.clientY - originY);
			});
			window.addEventListener('mouseup', (event) => {
				if (event.button !== 1) return;
				stop();
			});
			window.addEventListener('blur', stop);
			vp.addEventListener('auxclick', (event) => {
				if (event.button === 1) event.preventDefault();
			});
		}

		document.getElementById('search').addEventListener('input', renderRail);
		document.getElementById('zoom-in').addEventListener('click', () => { scale = Math.min(2.2, scale * 1.12); applyScale(); });
		document.getElementById('zoom-out').addEventListener('click', () => { scale = Math.max(0.4, scale / 1.12); applyScale(); });
		document.getElementById('zoom-fit').addEventListener('click', fit);
		document.getElementById('viewport').addEventListener('wheel', (event) => {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			scale = Math.min(2.2, Math.max(0.4, scale * (event.deltaY < 0 ? 1.08 : 0.92)));
			applyScale();
		}, { passive: false });

		bindPan();
		renderRail();
		renderChart();
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

/** @deprecated Use {@link buildFlowchartHtml}. Kept so existing imports keep compiling. */
export const buildTreeViewHtml = buildFlowchartHtml;
/** @deprecated Use {@link FlowchartPayload}. */
export type TreeViewPayload = FlowchartPayload;
