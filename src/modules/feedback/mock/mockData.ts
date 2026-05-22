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

import type { FeedbackFinding } from './mockTypes.js';

// Shared file path used across all mock vulnerability findings.
const LOGIN_CONTROLLER =
	'LoginController.java';

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
		type: 'Sensitive Data in Log — user value exposed in log statement',
		cwe: 'CWE-789',
		owasp: 'OWASP A09:2021 - Logging & Monitoring Failures',
		severity: 'medium',
		path: LOGIN_CONTROLLER,
		line: 8,
		vulnerability:
			'User-supplied values are logged verbatim, which may leak sensitive data to log aggregators or anyone with access to the application logs.',
		impact:
			'Sensitive data exposure through log files can lead to unauthorized access and privacy violations.',
		suggestion: 'Redact sensitive information before logging, or use structured logging with field masking.',
	},
	{
		type: 'Token Exposed in Response — access token returned in plain response body',
		cwe: 'CWE-200',
		owasp: 'OWASP A01:2021',
		severity: 'low',
		path: LOGIN_CONTROLLER,
		line: 9,
		vulnerability:
			'The generated access token is returned directly in the plain response body without transport-layer verification, potentially exposing it to logging middleware or interception.',
		impact:
			'Tokens can be intercepted during transit or recorded by logging middleware, allowing attackers to impersonate authenticated users.',
		suggestion: 'Return tokens via secure, HttpOnly cookies or use TLS with proper header-based token delivery.',
	},
];