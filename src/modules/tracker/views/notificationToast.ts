/**
 * Toast notification service for the Session-Based Reinforcement Tracker.
 *
 * Fires VS Code toast notifications for significant lifecycle events:
 *
 * - Recurring patterns — warning toast for findings that keep reappearing
 * - Persisting patterns — warning toast alerting the student
 * - Improving trends — informational toast encouraging the student
 * - Resolved vulnerabilities — informational toast confirming resolution
 * - Candidate transitions — new vulnerability detected / fix applied underway
 *
 * -------------------------------
 * ANTI-SPAM & NON-INVASIVE DESIGN
 *
 * 1. Notification Level — configurable via `ariadne.notifications.level`:
 *    - `milestones` (default): Only alerts on state transitions (new candidate, fix applied,
 *      first-time persisting, recurring, resolved). No 60s repetitive steady-state spam.
 *    - `all`: Allows repeating 60s cooldown toasts for steady-state persisting issues (debugging).
 *    - `quiet`: Suppresses all popup toasts; metrics remain visible in sidebar & status bar.
 * 2. Single Prioritized Toast — at most ONE toast is shown per save scan to prevent notification
 *    stacking / clutter.
 * 3. Cooldowns — per-category cooldowns prevent rapid duplicate alerts.
 *
 * The service is stateless across VS Code restarts — cooldown timers are in-memory only.
 * -------------------------------
 *
 * EXPORTS:
 *   showSessionToasts(analysis)  — fire-and-forget from the scan pipeline
 * -------------------------------
 */

import * as vscode from 'vscode';
import type { SessionAnalysis } from '../analysis/analysisTypes.js';

import {
	formatNewCandidateMessage,
	formatAbsentCandidateMessage,
	determinePrioritizedToast,
	type NotificationLevel,
	type ToastType,
	type ToastPlan,
} from '../analysis/candidateToasts.js';

export {
	formatNewCandidateMessage,
	formatAbsentCandidateMessage,
	determinePrioritizedToast,
	type NotificationLevel,
	type ToastType,
	type ToastPlan,
};

// CONFIGURATION

const COOLDOWN_MS = 60_000; // 60 seconds for steady-state categories
const CANDIDATE_COOLDOWN_MS = 2_000; // 2 seconds for event-driven candidate transitions

// COOLDOWN STATE

export type ToastCategory =
	| 'persisting'
	| 'improving'
	| 'resolved'
	| 'recurring'
	| 'newCandidate'
	| 'absentCandidate';

const lastFiredAt: Record<ToastCategory, number> = {
	persisting: 0,
	improving: 0,
	resolved: 0,
	recurring: 0,
	newCandidate: 0,
	absentCandidate: 0,
};

/**
 * Returns `true` if the category is off cooldown and records the
 * current timestamp so subsequent calls are throttled.
 */
export function tryAcquire(category: ToastCategory): boolean {
	const now = Date.now();
	const cooldown = (category === 'newCandidate' || category === 'absentCandidate')
		? CANDIDATE_COOLDOWN_MS
		: COOLDOWN_MS;

	if (now - lastFiredAt[category] < cooldown) {
		return false; // still within cooldown window
	}
	lastFiredAt[category] = now;
	return true;
}

/** Reads the current notification level from VS Code settings. */
export function getNotificationLevel(): NotificationLevel {
	try {
		const config = vscode.workspace.getConfiguration('ariadne.notifications');
		return config.get<NotificationLevel>('level', 'milestones');
	} catch {
		return 'milestones';
	}
}

// TOAST BUILDERS (INDIVIDUAL HANDLERS)

/**
 * Shows a warning toast for persisting patterns.
 * In `milestones` mode, only fires when findings transition to persisting (newPersistingFindings).
 * In `all` mode, fires for all persisting patterns on 60s cooldown.
 */
export function showPersistingToast(
	analysis: SessionAnalysis,
	level: NotificationLevel = 'milestones',
): boolean {
	const count = level === 'all'
		? analysis.persistingPatterns
		: (analysis.newPersistingFindings?.length ?? 0);

	if (count === 0) { return false; }
	if (!tryAcquire('persisting')) { return false; }

	vscode.window.showWarningMessage(
		`Ariadne: ${count} ${count === 1 ? 'issue is still persisting' : 'issues are still persisting'} — unresolved and requires your attention.`,
	);
	return true;
}

/** Shows an informational toast for improving trends. */
export function showImprovingToast(analysis: SessionAnalysis): boolean {
	const count = analysis.improvingTrends;
	if (count === 0) { return false; }
	if (!tryAcquire('improving')) { return false; }

	vscode.window.showInformationMessage(
		`Ariadne: ${count} ${count === 1 ? 'issue is' : 'issues are'} improving — great progress, keep it up!`,
	);
	return true;
}

/** Shows an informational toast for resolved vulnerabilities. */
export function showResolvedToast(analysis: SessionAnalysis): boolean {
	const count = analysis.resolvedThisSession;
	if (count === 0) { return false; }
	if (!tryAcquire('resolved')) { return false; }

	vscode.window.showInformationMessage(
		`Ariadne: ${count} ${count === 1 ? 'pattern resolved' : 'patterns resolved'} — check Session Metrics for details.`,
	);
	return true;
}

/** Shows a warning toast for recurring patterns. */
export function showRecurringToast(analysis: SessionAnalysis): boolean {
	const count = analysis.recurringPatterns;
	if (count === 0) { return false; }
	if (!tryAcquire('recurring')) { return false; }

	vscode.window.showWarningMessage(
		`Ariadne: ${count} ${count === 1 ? 'pattern has reappeared! It needs to be addressed again.' : 'patterns have reappeared! They need to be addressed again.'}`,
	);
	return true;
}

/** Shows an informational toast for newly detected candidate vulnerabilities. */
export function showNewCandidateToast(analysis: SessionAnalysis): boolean {
	const findings = analysis.newCandidateFindings ?? [];
	if (findings.length === 0) { return false; }
	if (!tryAcquire('newCandidate')) { return false; }

	const message = formatNewCandidateMessage(findings);
	if (message) {
		vscode.window.showInformationMessage(message);
		return true;
	}
	return false;
}

/** Shows an informational toast when previously active vulnerabilities are no longer detected. */
export function showAbsentCandidateToast(analysis: SessionAnalysis): boolean {
	const findings = analysis.absentCandidateFindings ?? [];
	if (findings.length === 0) { return false; }
	if (!tryAcquire('absentCandidate')) { return false; }

	const message = formatAbsentCandidateMessage(findings);
	if (message) {
		vscode.window.showInformationMessage(message);
		return true;
	}
	return false;
}

/** Resets in-memory cooldown timestamps (primarily for unit tests). */
export function resetToastCooldowns(): void {
	for (const key of Object.keys(lastFiredAt) as ToastCategory[]) {
		lastFiredAt[key] = 0;
	}
}

// PUBLIC API

/**
 * Evaluates the session analysis and fires at most ONE prioritized VS Code toast
 * notification per save scan, respecting notification level and cooldowns.
 *
 * Priority order (most urgent / significant first):
 *   1. Recurring patterns (warning) — critical regressions
 *   2. Improving trends (info) — milestone: fewer occurrences detected
 *   3. Resolved patterns (info) — milestone completion
 *   4. Absent candidates (info) — fix applied feedback
 *   5. Newly detected candidates (info) — initial discovery
 *   6. Newly persisting (warning) — escalation to persisting
 *
 * @param analysis - The computed SessionAnalysis from buildSessionAnalysis()
 * @param levelOverride - Optional level override (e.g. for testing)
 */
export function showSessionToasts(
	analysis: SessionAnalysis,
	levelOverride?: NotificationLevel,
): boolean {
	const level = levelOverride ?? getNotificationLevel();
	if (level === 'quiet') {
		return false;
	}

	try {
		const plan = determinePrioritizedToast(analysis, level, (type) => tryAcquire(type));
		if (!plan) {
			return false;
		}

		if (plan.severity === 'warning') {
			vscode.window.showWarningMessage(plan.message);
		} else {
			vscode.window.showInformationMessage(plan.message);
		}
		return true;
	} catch (error) {
		console.warn(
			'[Ariadne] Toast notification error (non-fatal):',
			error instanceof Error ? error.message : String(error),
		);
		return false;
	}
}
