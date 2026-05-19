/**
 * Mock data simulating a response from the Ariadne backend.
 *
 * ─────────────────────────────────────────────────────────────────────
 * HOW TO SWAP TO REAL DATA
 * ─────────────────────────────────────────────────────────────────────
 * When the backend is ready, replace the exports below with real API
 * calls (e.g. parsing stdout from iostream / the Ariadne CLI process).
 *
 * The view builders and AriadneViewProvider.ts remain unchanged — they
 * only depend on the shapes defined in types.ts, not on where the data
 * comes from.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { FeedbackFinding } from './types.js';

// Shared file path used across all mock vulnerability findings.
const LOGIN_CONTROLLER =
	'src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java';

/**
 * Mock vulnerability findings — mirrors what the Feedback module shows
 * in the design.
 */
export const mockFeedbackFindings: FeedbackFinding[] = [
	{
		type: 'SQL Injection',
		cwe: 'CWE-89',
		owasp: 'OWASP A03:2021 - Injection',
		severity: 'critical',
		path: LOGIN_CONTROLLER,
		line: 3,
		vulnerability:
			'Untrusted input is concatenated into a SQL query string.',
		impact:
			'Attackers can bypass authentication or extract the user table.',
		suggestion: 'Use parameterized queries (PreparedStatement).',
	},
	{
		type: 'Hardcoded Secret',
		cwe: 'CWE-798',
		owasp: 'OWASP A07:2021 - Identification and Authentication Failures',
		severity: 'high',
		path: LOGIN_CONTROLLER,
		line: 7,
		vulnerability:
			'An API key is hardcoded in a variable assignment in source.',
		impact:
			'Exposed secrets can be reused to access protected services.',
		suggestion: 'Load secrets from a secure vault or environment vars.',
	},
	{
		type: 'Sensitive Data in Logs',
		cwe: 'CWE-200',
		owasp: 'OWASP A09:2021 - Security Logging and Monitoring Failures',
		severity: 'medium',
		path: LOGIN_CONTROLLER,
		line: 8,
		vulnerability:
			'User input is logged verbatim in a login attempt message.',
		impact:
			'Sensitive values may leak to log aggregation systems.',
		suggestion: 'Redact or hash user input before logging.',
	},
	{
		type: 'Token Exposure',
		cwe: 'CWE-201',
		owasp: 'OWASP A02:2021 - Cryptographic Failures',
		severity: 'low',
		path: LOGIN_CONTROLLER,
		line: 9,
		vulnerability:
			'Access token is returned in a plain response body.',
		impact:
			'Tokens can be intercepted or recorded by middleware.',
		suggestion: 'Return tokens via secure headers and use TLS.',
	},
];