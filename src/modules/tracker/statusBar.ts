/**
 * Status bar integration for the Session-Based Reinforcement Tracker.
 *
 * Displays an "Ariadne" indicator in the VS Code status bar with a
 * hover tooltip summarising the current session's progress metrics.
 *
 * ─────────────────────────────────────────────────────────────────────
 * The data is currently hardcoded.  When the backend is ready, replace
 * `MOCK_STATUS_DATA` with live values and call `updateStatusBar()`
 * whenever new scan results arrive.
 * ─────────────────────────────────────────────────────────────────────
 */

import * as vscode from 'vscode';

// ── Types ─────────────────────────────────────────────────────────────

/** Shape of the data the status bar tooltip needs. */
export interface StatusBarData {
	criticalIssues: number;
	mediumIssues: number;
	persistingPatterns: number;
	improvingTrends: number;
}

// ── Hardcoded mock data ───────────────────────────────────────────────

const MOCK_STATUS_DATA: StatusBarData = {
	criticalIssues: 1,
	mediumIssues: 1,
	persistingPatterns: 1,
	improvingTrends: 1,
};

// ── Status bar item ───────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Builds a rich Markdown tooltip matching the design mockup.
 *
 * Each line shows a trend-chart icon followed by the count and label,
 * using VS Code's built-in theme icons (codicons).
 */
function buildTooltip(data: StatusBarData): vscode.MarkdownString {
	const md = new vscode.MarkdownString('', true);
	md.isTrusted = true;
	md.supportThemeIcons = true;
	md.supportHtml = true;

	const teal = '#4EC9B0';
	const red = '#E24B4A';

	md.appendMarkdown(`<span style="color:${red};">$(graph-line)</span>&ensp;**${data.criticalIssues}** Critical Issues\n\n`);
	md.appendMarkdown(`<span style="color:${teal};">$(graph-line)</span>&ensp;**${data.mediumIssues}** Medium Issues\n\n`);
	md.appendMarkdown(`<span style="color:${teal};">$(graph-line)</span>&ensp;**${data.persistingPatterns}** Persisting Patterns\n\n`);
	md.appendMarkdown(`<span style="color:${teal};">$(graph-line)</span>&ensp;**${data.improvingTrends}** Improving Trends`);

	return md;
}

/**
 * Creates and registers the Ariadne status bar item.
 *
 * Call this once during extension activation. The returned disposable
 * should be pushed into `context.subscriptions` so VS Code cleans it
 * up automatically on deactivation.
 */
export function createAriadneStatusBarItem(): vscode.Disposable {
	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		0,
	);

	statusBarItem.text = `$(circle-filled) Ariadne`;
	statusBarItem.tooltip = buildTooltip(MOCK_STATUS_DATA);
	statusBarItem.show();

	return statusBarItem;
}

/**
 * Updates the status bar item with fresh data.
 *
 * Call this whenever a new scan completes or the tracker state changes.
 */
export function updateStatusBar(data: StatusBarData): void {
	if (!statusBarItem) {
		return;
	}

	statusBarItem.text = `$(circle-filled) Ariadne`;
	statusBarItem.tooltip = buildTooltip(data);
}
