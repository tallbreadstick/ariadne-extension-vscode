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

	const types = Array.from(new Set(findings.map((f) => f.lifecycle.type)));
	const detail = types.length <= 3
		? types.join(', ')
		: `${types.slice(0, 3).join(', ')} and ${types.length - 3} more`;

	return findings.length === 1
		? `Ariadne: A new vulnerability has been detected (${detail}). Checking validity...`
		: `Ariadne: ${findings.length} new vulnerabilities detected (${detail}). Checking validity...`;
}

/**
 * Formats the notification message for vulnerabilities previously active that are no longer detected
 * (transition: Active/Persisting/Recurring/Improving -> Candidate).
 */
export function formatAbsentCandidateMessage(findings: FindingClassification[]): string {
	if (findings.length === 0) {
		return '';
	}

	const types = Array.from(new Set(findings.map((f) => f.lifecycle.type)));
	const detail = types.length <= 3
		? types.join(', ')
		: `${types.slice(0, 3).join(', ')} and ${types.length - 3} more`;

	return findings.length === 1
		? `Ariadne: Vulnerability is no longer detected (${detail}). Resolution status is being processed...`
		: `Ariadne: ${findings.length} vulnerabilities are no longer detected (${detail}). Resolution status is being processed...`;
}
