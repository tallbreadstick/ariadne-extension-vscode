/**
 * - Persisting patterns - warning toast alerting the student
 * - Improving trends - informational toast encouraging the student
 * - Resolved vulnerabilities - informational toast confirming resolution
 * - New vulnerabilities - warning toast for newly detected issues
 *
 * -------------------------------
 * ANTI-SPAM DESIGN
 *
 * 1. Aggregation - multiple findings of the same status category are collapsed into a single summary toast (e.g., "3 persisting patterns detected").
 * 2. Cooldown - a per-category cooldown (default 60 s) prevents the same category from firing again within the window, even if a new scan cycle completes.
 *
 * The service is stateless across VS Code restarts — the cooldown... timers are in-memory only.
 * -------------------------------
 *
 * EXPORTS:
 *   showSessionToasts(analysis)  — fire-and-forget from the scan pipeline
 * -------------------------------
 */

import * as vscode from 'vscode';
import type { SessionAnalysis } from '../analysis/analysisTypes.js';

// CONFIGURATION

// Minimum interval (in ms) between toasts of the same category. 
const COOLDOWN_MS = 60_000; // 60 seconds

// COOLDOWN STATE

/**
 * Tracks the last time a toast was fired for each notification category.
 * In-memory only - resets when the extension host restarts.
 */
type ToastCategory = 'persisting' | 'improving' | 'resolved' | 'new';

const lastFiredAt: Record<ToastCategory, number> = {
	persisting: 0,
	improving: 0,
	resolved: 0,
	new: 0,
};

/**
 * Returns `true` if the category is off cooldown and records the
 * current timestamp so subsequent calls are throttled.
 */
function tryAcquire(category: ToastCategory): boolean {
	const now = Date.now();
	if (now - lastFiredAt[category] < COOLDOWN_MS) {
		return false; // still within cooldown window
	}
	lastFiredAt[category] = now;
	return true;
}

// TOAST BUILDERS

/**
 * Shows a warning toast for persisting patterns.
 *
 * Per UC-4.3: "If a persisting pattern is detected, a soft toast; notification is triggered to alert the student of the unresolved vulnerability class."
 */
function showPersistingToast(analysis: SessionAnalysis): void {
	const count = analysis.persistingPatterns;
	if (count === 0) { return; }
	if (!tryAcquire('persisting')) { return; }

	// Build a human-readable list of the persisting vulnerability types
	const persistingTypes = analysis.deltas
		.filter((d) => d.status === 'persisting')
		.map((d) => d.vulnerability.type);

	// Collapse into a summary when there are many
	const detail = persistingTypes.length <= 3
		? persistingTypes.join(', ')
		: `${persistingTypes.slice(0, 3).join(', ')} and ${persistingTypes.length - 3} more`;

	vscode.window.showWarningMessage(
		`Ariadne: ${count} recurring ${count === 1 ? 'issue persists' : 'issues persist'} — ${detail}`,
	);
}


// Shows an informational toast for improving trends

function showImprovingToast(analysis: SessionAnalysis): void {
	const count = analysis.improvingTrends;
	if (count === 0) { return; }
	if (!tryAcquire('improving')) { return; }

	const improvingTypes = analysis.deltas
		.filter((d) => d.status === 'improving')
		.map((d) => d.vulnerability.type);

	const detail = improvingTypes.length <= 3
		? improvingTypes.join(', ')
		: `${improvingTypes.slice(0, 3).join(', ')} and ${improvingTypes.length - 3} more`;

	vscode.window.showInformationMessage(
		`$(arrow-down) Ariadne: ${count} ${count === 1 ? 'issue is' : 'issues are'} improving — ${detail}`,
	);
}

// Shows an informational toast for resolved vulnerabilities

function showResolvedToast(analysis: SessionAnalysis): void {
	const count = analysis.resolvedThisSession;
	if (count === 0) { return; }
	if (!tryAcquire('resolved')) { return; }

	const resolvedTypes = analysis.deltas
		.filter((d) => d.status === 'resolved')
		.map((d) => d.vulnerability.type);

	const detail = resolvedTypes.length <= 3
		? resolvedTypes.join(', ')
		: `${resolvedTypes.slice(0, 3).join(', ')} and ${resolvedTypes.length - 3} more`;

	vscode.window.showInformationMessage(
		`Ariadne: ${count} ${count === 1 ? 'pattern' : 'patterns'} resolved — ${detail}`,
	);
}

// Shows a warning toast for newly detected vulnerabilities

function showNewToast(analysis: SessionAnalysis): void {
	const count = analysis.newVulnerabilities;
	if (count === 0) { return; }
	if (!tryAcquire('new')) { return; }

	const newTypes = analysis.deltas
		.filter((d) => d.status === 'new')
		.map((d) => d.vulnerability.type);

	const detail = newTypes.length <= 3
		? newTypes.join(', ')
		: `${newTypes.slice(0, 3).join(', ')} and ${newTypes.length - 3} more`;

	vscode.window.showWarningMessage(
		`Ariadne: ${count} new ${count === 1 ? 'vulnerability' : 'vulnerabilities'} detected — ${detail}`,
	);
}


// PUBLIC API

/**
 * Evaluates the session analysis and fires at most one VS Code toast.. notification per applicable category, respecting cooldown windows.
 *
 * This is a fire-and-forget function — call it from the scan pipeline
 * after `analyzeSession()` and `toSessionMetrics()` have updated the
 * Session Metrics panel.
 *
 * Priority order (most urgent first):
 *   1. New vulnerabilities (warning)
 *   2. Persisting patterns (warning)
 *   3. Improving trends (info)
 *   4. Resolved patterns (info)
 *
 * Requires at least two scan cycles to have meaningful delta data;
 * if only one scan has been performed, this function returns silently.
 *
 * @param analysis - The computed SessionAnalysis from `analyzeSession()`
 */
export function showSessionToasts(analysis: SessionAnalysis): void {
	// Guard: need at least 2 scans for meaningful pattern classification
	if (!analysis.previousScan) {
		return;
	}

	try {
		// Fire in priority order — each category independently throttled
		showNewToast(analysis);
		showPersistingToast(analysis);
		showImprovingToast(analysis);
		showResolvedToast(analysis);
	} catch (error) {
		// EF-2: If the toast notification API is unavailable or throws,
		// log internally and continue — the panel update is unaffected.
		console.warn(
			'[Ariadne] Toast notification error (non-fatal):',
			error instanceof Error ? error.message : String(error),
		);
	}
}
