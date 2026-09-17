/**
 * Pure business logic for Candidate state transition toast messages.
 *
 * No `vscode` import — fully testable in pure Node.
 */

import type { FindingClassification } from './lifecycleTypes.js';

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
