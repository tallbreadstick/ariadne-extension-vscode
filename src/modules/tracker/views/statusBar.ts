/**
 * Status bar integration for the Session-Based Reinforcement Tracker.
 *
 * Displays an "Ariadne" indicator in the VS Code status bar with:
 *
 * 1. **Priority-based text** — shows the two most relevant severity
 *    counts based on which levels have active findings.
 * 2. **Rich tooltip** — full breakdown of severity counts, persisting
 *    patterns, and improving trends on hover.
 *
 * ─────────────────────────────────────────────────────────────────────
 * The status bar is driven by `SessionAnalysis` from the snapshot
 * analysis engine. Call `createAriadneStatusBarItem(analysis)` during
 * activation and `updateStatusBar(analysis)` after each scan.
 * ─────────────────────────────────────────────────────────────────────
 */

import * as vscode from 'vscode';
import type { SessionAnalysis } from '../analysis/analysisTypes.js';

// ── Status bar item ───────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem | undefined;

// ══════════════════════════════════════════════════════════════════════
// PRIORITY-BASED TEXT
// ══════════════════════════════════════════════════════════════════════

/**
 * Builds the status bar text based on severity priority rules:
 *
 * - If critical AND high > 0  →  "X Critical · Y High"
 * - If only critical > 0      →  critical + next available (medium > low)
 * - If only high > 0          →  high + next available (medium > low)
 * - If no critical/high       →  medium and/or low
 * - If all zero               →  "All Clear"
 */
function buildStatusText(analysis: SessionAnalysis): string {
	const { critical, high, medium, low } = analysis.severityCounts;

	const segments: string[] = [];

	if (critical > 0 && high > 0) {
		segments.push(`${critical} Critical`, `${high} High`);
	} else if (critical > 0) {
		segments.push(`${critical} Critical`);
		if (medium > 0) { segments.push(`${medium} Medium`); }
		else if (low > 0) { segments.push(`${low} Low`); }
	} else if (high > 0) {
		segments.push(`${high} High`);
		if (medium > 0) { segments.push(`${medium} Medium`); }
		else if (low > 0) { segments.push(`${low} Low`); }
	} else if (medium > 0) {
		segments.push(`${medium} Medium`);
		if (low > 0) { segments.push(`${low} Low`); }
	} else if (low > 0) {
		segments.push(`${low} Low`);
	}

	if (segments.length === 0) {
		return `$(circle-filled) Ariadne — All Clear`;
	}

	return `$(circle-filled) Ariadne | ${segments.join(' · ')}`;
}

// ══════════════════════════════════════════════════════════════════════
// TOOLTIP
// ══════════════════════════════════════════════════════════════════════

/**
 * Builds a rich Markdown tooltip showing the full session metrics.
 *
 * Layout:
 *   $(graph-line)  X Critical Issues
 *   $(graph-line)  Y High Issues
 *   $(graph-line)  Z Medium Issues
 *   $(graph-line)  W Low Issues
 *   ─────────────────────────
 *   $(graph-line)  N Persisting Patterns
 *   $(graph-line)  N Improving Trends
 */
function buildTooltip(analysis: SessionAnalysis): vscode.MarkdownString {
	const md = new vscode.MarkdownString('', true);
	md.isTrusted = true;
	md.supportThemeIcons = true;
	md.supportHtml = true;

	const { critical, high, medium, low } = analysis.severityCounts;
	const red = '#E24B4A';
	const orange = '#BA7517';
	const blue = '#227AD0';
	const green = '#5CA221';
	const teal = '#4EC9B0';

	// ── Severity breakdown ────────────────────────────────────────
	md.appendMarkdown(`<span style="color:${red};">$(graph-line)</span>&ensp;**${critical}** Critical Issues\n\n`);
	md.appendMarkdown(`<span style="color:${orange};">$(graph-line)</span>&ensp;**${high}** High Issues\n\n`);
	md.appendMarkdown(`<span style="color:${blue};">$(graph-line)</span>&ensp;**${medium}** Medium Issues\n\n`);
	md.appendMarkdown(`<span style="color:${green};">$(graph-line)</span>&ensp;**${low}** Low Issues\n\n`);

	// ── Separator ─────────────────────────────────────────────────
	md.appendMarkdown(`---\n\n`);

	// ── Trend metrics ─────────────────────────────────────────────
	md.appendMarkdown(`<span style="color:${red};">$(graph-line)</span>&ensp;**${analysis.persistingPatterns}** Persisting Patterns\n\n`);
	md.appendMarkdown(`<span style="color:${teal};">$(graph-line)</span>&ensp;**${analysis.improvingTrends}** Improving Trends`);

	return md;
}

// ══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════

/**
 * Creates and registers the Ariadne status bar item.
 *
 * Call this once during extension activation. The returned disposable
 * should be pushed into `context.subscriptions` so VS Code cleans it
 * up automatically on deactivation.
 *
 * @param analysis - Initial session analysis to display. If omitted,
 *                   the status bar shows a neutral "Ariadne" label.
 */
export function createAriadneStatusBarItem(
	analysis?: SessionAnalysis,
): vscode.Disposable {
	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		0,
	);

	if (analysis) {
		statusBarItem.text = buildStatusText(analysis);
		statusBarItem.tooltip = buildTooltip(analysis);
	} else {
		statusBarItem.text = `$(circle-filled) Ariadne`;
	}

	statusBarItem.show();

	return statusBarItem;
}

/**
 * Updates the status bar item with fresh analysis results.
 *
 * Call this whenever a new scan completes or the tracker state changes.
 */
export function updateStatusBar(analysis: SessionAnalysis): void {
	if (!statusBarItem) {
		return;
	}

	statusBarItem.text = buildStatusText(analysis);
	statusBarItem.tooltip = buildTooltip(analysis);
}

