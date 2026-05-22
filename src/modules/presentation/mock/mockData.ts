/**
 * Mock data simulating a response from the Ariadne backend.
 *
 * ─────────────────────────────────────────────────────────────────────
 * HOW TO SWAP TO REAL DATA
 * ─────────────────────────────────────────────────────────────────────
 * When the backend is ready, replace the exports below with real API
 * calls (e.g. parsing stdout from iostream / the Ariadne CLI process).
 *
 * The view builders (activeVulnerabilities.ts, sessionMetrics.ts) and
 * AriadneViewProvider.ts remain completely unchanged — they only depend
 * on the shapes defined in types.ts, not on where the data comes from.
 * ─────────────────────────────────────────────────────────────────────
 */

import { Vulnerability, SessionMetrics } from './types';

// Shared file path used across all mock vulnerability findings.
const LOGIN_CONTROLLER =
	'src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java';

/**
 * Mock vulnerability findings — mirrors what the Active Vulnerabilities
 * panel shows in the design.
 */
export const mockVulnerabilities: Vulnerability[] = [
	{
		id: 'vuln-001',
		severity: 'critical',
		cwe: 'CWE-89',
		owaspRef: 'OWASP A03',
		title: 'SQL Injection — unsanitized input in query string',
		description:
			'Unsanitized user input is concatenated directly into a SQL query string. ' +
			'An attacker can manipulate the query to bypass authentication or exfiltrate the database.',
		filePath: LOGIN_CONTROLLER,
		line: 3,
	},
	{
		id: 'vuln-002',
		severity: 'high',
		cwe: 'CWE-798',
		title: 'Hardcoded Secret — API key in variable assignment',
		description:
			'An API key is hardcoded in a variable assignment, which exposes a secret in source control. ' +
			'Anyone with repository access can retrieve and misuse the credential.',
		filePath: LOGIN_CONTROLLER,
		line: 7,
	},
	{
		id: 'vuln-003',
		severity: 'medium',
		cwe: 'CWE-789',
		title: 'Sensitive Data in Log — user value exposed in log statement',
		description:
			'User-supplied values are logged verbatim, which may leak sensitive data to log aggregators ' +
			'or anyone with access to the application logs.',
		filePath: LOGIN_CONTROLLER,
		line: 8,
	},
	{
		id: 'vuln-004',
		severity: 'low',
		cwe: 'CWE-200',
		owaspRef: 'OWASP A01',
		title: 'Token Exposed in Response — access token returned in plain response body',
		description:
			'The generated access token is returned directly in the plain response body without ' +
			'transport-layer verification, potentially exposing it to logging middleware or interception.',
		filePath: LOGIN_CONTROLLER,
		line: 9,
	},
];

/**
 * Mock session metrics — mirrors what the Session Metrics panel shows
 * in the design, including the notification banner.
 */
export const mockSessionMetrics: SessionMetrics = {
	critical: 1,
	high: 1,
	medium: 1,
	low: 1,
	trends: {
		persistingPatterns: 1,
		improvingTrends: 2,
		resolvedThisSession: 4,
	},
	notifications: [
		{
			message: 'Security improving',
			detail: 'SQL Injection resolved across 3 consecutive scans. Keep it up.',
			timestamp: 'just now',
		},
		{
			message: 'New vulnerability detected',
			detail: 'Hardcoded Secret found in LoginController.java at line 7. Review immediately.',
			timestamp: '2 min ago',
		},
		{
			message: 'Pattern resolved',
			detail: 'Sensitive Data in Log is no longer detected in the latest scan.',
			timestamp: '5 min ago',
		},
		{
			message: 'Recurring issue',
			detail: 'SQL Injection has persisted for 3 consecutive scans in LoginController.java.',
			timestamp: '8 min ago',
		},
		{
			message: 'Scan complete',
			detail: 'Ariadne finished analysing 12 files. 4 issues found across 1 file.',
			timestamp: '10 min ago',
		},
	],
};
