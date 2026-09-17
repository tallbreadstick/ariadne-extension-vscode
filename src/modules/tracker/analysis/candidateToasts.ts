/**
 * Pure business logic for Candidate state transition toast messages.
 *
 * No `vscode` import — fully testable in pure Node.
 */

import type { FindingClassification } from './lifecycleTypes.js';
import type { SessionAnalysis } from './analysisTypes.js';

export type NotificationLevel = 'milestones' | 'all' | 'quiet';

export type ToastType =
	| 'recurring'
	| 'resolved'
	| 'absentCandidate'
	| 'newCandidate'
	| 'persisting'
	| 'improving';

export interface ToastPlan {
	type: ToastType;
	severity: 'info' | 'warning';
	message: string;
}

/**
 * Formats the notification message for newly detected candidate vulnerabilities
 * (transition: None -> Candidate).
 */
export function formatNewCandidateMessage(findings: FindingClassification[]): string {
	if (findings.length === 0) {
		return '';
	}

	return findings.length === 1
		? 'Ariadne: 1 new vulnerability detected — verification in progress...'
		: `Ariadne: ${findings.length} new vulnerabilities detected — verification in progress...`;
}

/**
 * Formats the notification message for vulnerabilities previously active that are no longer detected
 * (transition: Active/Persisting/Recurring/Improving -> Candidate).
 */
export function formatAbsentCandidateMessage(findings: FindingClassification[]): string {
	if (findings.length === 0) {
		return '';
	}

	return findings.length === 1
		? 'Ariadne: 1 issue fixed — resolution status is being processed...'
		: `Ariadne: ${findings.length} issues fixed — resolution status is being processed...`;
}

/**
 * Determines the single prioritized toast to display (pure logic, no vscode dependency).
 *
 * Priority order:
 *   1. Recurring patterns (warning) — regression
 *   2. Improving trends (info) — milestone: fewer occurrences detected
 *   3. Resolved patterns (info) — milestone: pattern resolved
 *   4. Absent candidates (info) — immediate "fix detected" feedback
 *   5. New candidates (info) — immediate "new issue detected" feedback
 *   6. Newly persisting (warning) — graduation to persisting
 */
export function determinePrioritizedToast(
	analysis: SessionAnalysis,
	level: NotificationLevel = 'milestones',
	isEligible: (type: ToastType) => boolean = () => true,
): ToastPlan | null {
	if (level === 'quiet') {
		return null;
	}

	if (analysis.recurringPatterns > 0 && isEligible('recurring')) {
		const count = analysis.recurringPatterns;
		return {
			type: 'recurring',
			severity: 'warning',
			message: `Ariadne: ${count} ${count === 1 ? 'pattern has reappeared! It needs to be addressed again.' : 'patterns have reappeared! They need to be addressed again.'}`,
		};
	}

	if (analysis.improvingTrends > 0 && isEligible('improving')) {
		const count = analysis.improvingTrends;
		return {
			type: 'improving',
			severity: 'info',
			message: `Ariadne: ${count} ${count === 1 ? 'vulnerability pattern is improving' : 'vulnerability patterns are improving'} — fewer occurrences detected!`,
		};
	}

	if (analysis.resolvedThisSession > 0 && isEligible('resolved')) {
		const count = analysis.resolvedThisSession;
		return {
			type: 'resolved',
			severity: 'info',
			message: `Ariadne: ${count} ${count === 1 ? 'pattern resolved' : 'patterns resolved'} — check Session Metrics for details.`,
		};
	}

	if (
		analysis.absentCandidateFindings &&
		analysis.absentCandidateFindings.length > 0 &&
		isEligible('absentCandidate')
	) {
		const msg = formatAbsentCandidateMessage(analysis.absentCandidateFindings);
		if (msg) {
			return {
				type: 'absentCandidate',
				severity: 'info',
				message: msg,
			};
		}
	}

	if (
		analysis.newCandidateFindings &&
		analysis.newCandidateFindings.length > 0 &&
		isEligible('newCandidate')
	) {
		const msg = formatNewCandidateMessage(analysis.newCandidateFindings);
		if (msg) {
			return {
				type: 'newCandidate',
				severity: 'info',
				message: msg,
			};
		}
	}

	const persistingCount = level === 'all'
		? analysis.persistingPatterns
		: (analysis.newPersistingFindings?.length ?? 0);

	if (persistingCount > 0 && isEligible('persisting')) {
		return {
			type: 'persisting',
			severity: 'warning',
			message: `Ariadne: ${persistingCount} ${persistingCount === 1 ? 'issue is still persisting' : 'issues are still persisting'} — unresolved and requires your attention.`,
		};
	}

	return null;
}
