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
import { SEVERITY_COLORS } from '../../presentation/severityColors.js';

// ── Status bar item ───────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem | undefined;

// ══════════════════════════════════════════════════════════════════════
// PRIORITY-BASED TEXT
// ══════════════════════════════════════════════════════════════════════

/**
 * Builds the status bar text with a single authoritative total count.
 * Matches the Active Vulnerabilities panel and toast notifications to avoid
 * user confusion across different presentation surfaces.
 */
function buildStatusText(analysis: SessionAnalysis): string {
	const { critical, high, medium, low } = analysis.severityCounts;
	const total = critical + high + medium + low;

	if (total === 0) {
		return `$(check) Ariadne: All Clear`;
	}

	return `$(shield) Ariadne: ${total} ${total === 1 ? 'Issue' : 'Issues'}`;
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
	const red = SEVERITY_COLORS.critical;
	const orange = SEVERITY_COLORS.high;
	const yellow = SEVERITY_COLORS.medium;
	const green = SEVERITY_COLORS.low;
	const teal = '#4EC9B0';

	// ── Severity breakdown ────────────────────────────────────────
	md.appendMarkdown(`<span style="color:${red};">$(graph-line)</span>&ensp;**${critical}** Critical Issues\n\n`);
	md.appendMarkdown(`<span style="color:${orange};">$(graph-line)</span>&ensp;**${high}** High Issues\n\n`);
	md.appendMarkdown(`<span style="color:${yellow};">$(graph-line)</span>&ensp;**${medium}** Medium Issues\n\n`);
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
	statusBarItem.command = 'ariadne-extension-vscode.openPanel';

	if (analysis) {
		statusBarItem.text = buildStatusText(analysis);
		statusBarItem.tooltip = buildTooltip(analysis);
	} else {
		statusBarItem.text = `$(shield) Ariadne`;
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

