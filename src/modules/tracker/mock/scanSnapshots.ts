/**
 * Mock scan timeline for the Session-Based Reinforcement Tracker.
 *
 * ─────────────────────────────────────────────────────────────────────
 * This file contains 5 ScanSnapshot objects that simulate a realistic
 * session where vulnerabilities are discovered, persist, improve, and
 * resolve over consecutive analysis runs.
 *
 * The timeline is designed to demonstrate every tracker behavior:
 *
 *  Scan 1 → Scan 2:  New vulnerability appears (Token Exposed)
 *  Scan 2 → Scan 3:  Some instances resolve (Weak Hash gone),
 *                     others improve (Hardcoded Secret, Sensitive Log)
 *  Scan 3 → Scan 4:  SQL Injection improves, Hardcoded Secret resolves
 *  Scan 4 → Scan 5:  SQL Injection continues improving, new Path Traversal
 *                     appears, Sensitive Log & Token Exposed persist
 *
 * At Scan 5 (current):
 *   Active:     SQL Injection (critical), Path Traversal (high),
 *               Sensitive Data in Log (medium), Token Exposed (low)
 *   Improving:  1 — SQL Injection (2→1 instances)
 *   Persisting: 2 — Sensitive Data in Log, Token Exposed
 *   Resolved:   2 — Hardcoded Secret, Weak Hash (across session)
 *   New:        1 — Path Traversal
 *
 * HOW TO SWAP TO REAL DATA
 * ─────────────────────────────────────────────────────────────────────
 * When the SAST engine is wired, replace this export with a function
 * that accumulates real ScanSnapshot[] during the VS Code session.
 * The analysis engine (snapshotAnalyzer.ts) and all downstream views
 * remain unchanged — they only depend on the ScanSnapshot shape.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { ScanSnapshot, Vulnerability } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';

// ── File paths used across scans ──────────────────────────────────────

const LOGIN_CONTROLLER =
	'src/java/com/edu/cit/capstone/ariadne/features/user/LoginController.java';
const SEARCH_CONTROLLER =
	'src/java/com/edu/cit/capstone/ariadne/features/search/SearchController.java';
const CONFIG_MANAGER =
	'src/java/com/edu/cit/capstone/ariadne/config/ConfigManager.java';
const AUTH_SERVICE =
	'src/java/com/edu/cit/capstone/ariadne/features/auth/AuthService.java';
const PASSWORD_UTIL =
	'src/java/com/edu/cit/capstone/ariadne/util/PasswordUtil.java';
const FILE_CONTROLLER =
	'src/java/com/edu/cit/capstone/ariadne/features/file/FileController.java';

// ══════════════════════════════════════════════════════════════════════
// VULNERABILITY BUILDERS
// ══════════════════════════════════════════════════════════════════════
// Each function returns a Vulnerability with the specified instance count.
// This makes the scan definitions readable and the instance-removal
// pattern across scans explicit.

/**
 * SQL Injection (CWE-89, critical)
 * Instances: userInput, query, searchParam
 */
function sqlInjection(instanceCount: 3 | 2 | 1): Vulnerability {
	const allInstances = [
		{
			name: 'userInput',
			kind: 'variable' as const,
			occurrences: [{
				file_path: LOGIN_CONTROLLER,
				line_number: 3,
				taint_trace: {
					origin_line: 1,
					sink_line: 3,
					path_summary: 'userInput → String.concat → Statement.executeQuery',
				},
			}],
		},
		{
			name: 'query',
			kind: 'variable' as const,
			occurrences: [{
				file_path: LOGIN_CONTROLLER,
				line_number: 5,
				taint_trace: {
					origin_line: 3,
					sink_line: 5,
					path_summary: 'query → PreparedStatement.execute',
				},
			}],
		},
		{
			name: 'searchParam',
			kind: 'parameter' as const,
			occurrences: [{
				file_path: SEARCH_CONTROLLER,
				line_number: 12,
				taint_trace: {
					origin_line: 10,
					sink_line: 12,
					path_summary: 'searchParam → String.format → Statement.executeQuery',
				},
			}],
		},
	];

	return {
		type: 'SQL Injection',
		cwe_id: 'CWE-89',
		owasp_category: 'OWASP A03:2021 - Injection',
		severity: 'critical',
		rule_id: 'taint.sqli.concat',
		instances: allInstances.slice(0, instanceCount),
	};
}

/**
 * Hardcoded Secret (CWE-798, high)
 * Instances: apiKey, dbPassword
 */
function hardcodedSecret(instanceCount: 2 | 1): Vulnerability {
	const allInstances = [
		{
			name: 'apiKey',
			kind: 'variable' as const,
			occurrences: [{
				file_path: LOGIN_CONTROLLER,
				line_number: 7,
			}],
		},
		{
			name: 'dbPassword',
			kind: 'variable' as const,
			occurrences: [{
				file_path: CONFIG_MANAGER,
				line_number: 15,
			}],
		},
	];

	return {
		type: 'Hardcoded Secret',
		cwe_id: 'CWE-798',
		owasp_category: 'OWASP A07:2021 - Identification and Authentication Failures',
		severity: 'high',
		rule_id: 'pattern.secret.hardcoded',
		instances: allInstances.slice(0, instanceCount),
	};
}

/**
 * Sensitive Data in Log (CWE-532, medium)
 * Instances: logger.info(username), logger.debug(token)
 */
function sensitiveDataInLog(instanceCount: 2 | 1): Vulnerability {
	const allInstances = [
		{
			name: 'logger.info(username)',
			kind: 'method' as const,
			occurrences: [{
				file_path: LOGIN_CONTROLLER,
				line_number: 8,
				taint_trace: {
					origin_line: 1,
					sink_line: 8,
					path_summary: 'username → Logger.info',
				},
			}],
		},
		{
			name: 'logger.debug(token)',
			kind: 'method' as const,
			occurrences: [{
				file_path: AUTH_SERVICE,
				line_number: 22,
				taint_trace: {
					origin_line: 18,
					sink_line: 22,
					path_summary: 'token → Logger.debug',
				},
			}],
		},
	];

	return {
		type: 'Sensitive Data in Log',
		cwe_id: 'CWE-532',
		owasp_category: 'OWASP A09:2021 - Security Logging and Monitoring Failures',
		severity: 'medium',
		rule_id: 'taint.log.sensitive',
		instances: allInstances.slice(0, instanceCount),
	};
}

/**
 * Weak Hash Algorithm (CWE-328, medium)
 * Instances: MessageDigest.getInstance("MD5")
 */
function weakHash(): Vulnerability {
	return {
		type: 'Weak Hash Algorithm',
		cwe_id: 'CWE-328',
		owasp_category: 'OWASP A02:2021 - Cryptographic Failures',
		severity: 'medium',
		rule_id: 'pattern.crypto.weakHash',
		instances: [{
			name: 'MessageDigest.getInstance("MD5")',
			kind: 'method' as const,
			occurrences: [{
				file_path: PASSWORD_UTIL,
				line_number: 10,
			}],
		}],
	};
}

/**
 * Token Exposed in Response (CWE-200, low)
 * Instances: accessToken
 */
function tokenExposed(): Vulnerability {
	return {
		type: 'Token Exposed in Response',
		cwe_id: 'CWE-200',
		owasp_category: 'OWASP A01:2021 - Broken Access Control',
		severity: 'low',
		rule_id: 'pattern.token.responseBody',
		instances: [{
			name: 'accessToken',
			kind: 'variable' as const,
			occurrences: [{
				file_path: LOGIN_CONTROLLER,
				line_number: 9,
			}],
		}],
	};
}

/**
 * Path Traversal (CWE-22, high)
 * Instances: filePath
 */
function pathTraversal(): Vulnerability {
	return {
		type: 'Path Traversal',
		cwe_id: 'CWE-22',
		owasp_category: 'OWASP A01:2021 - Broken Access Control',
		severity: 'high',
		rule_id: 'taint.path.traversal',
		instances: [{
			name: 'filePath',
			kind: 'parameter' as const,
			occurrences: [{
				file_path: FILE_CONTROLLER,
				line_number: 20,
				taint_trace: {
					origin_line: 15,
					sink_line: 20,
					path_summary: 'filePath → new File → FileInputStream',
				},
			}],
		}],
	};
}

// ══════════════════════════════════════════════════════════════════════
// SCAN TIMELINE
// ══════════════════════════════════════════════════════════════════════

/**
 * Mock scan timeline — 5 consecutive analysis snapshots.
 *
 * Timestamps are spaced ~5 minutes apart to simulate a realistic
 * development session where the student iterates on their code.
 */
export const mockScanTimeline: ScanSnapshot[] = [

	// ── Scan 1: Initial baseline ──────────────────────────────────────
	// 4 vulnerabilities, 8 total instances
	{
		scan_id: 'scan-001',
		timestamp: Date.now() - 20 * 60 * 1000, // 20 min ago
		vulnerabilities: [
			sqlInjection(3),
			hardcodedSecret(2),
			sensitiveDataInLog(2),
			weakHash(),
		],
	},

	// ── Scan 2: Token Exposed appears ─────────────────────────────────
	// Same as Scan 1 + 1 new low-severity vulnerability
	{
		scan_id: 'scan-002',
		timestamp: Date.now() - 15 * 60 * 1000, // 15 min ago
		vulnerabilities: [
			sqlInjection(3),
			hardcodedSecret(2),
			sensitiveDataInLog(2),
			weakHash(),
			tokenExposed(),
		],
	},

	// ── Scan 3: Student starts fixing ─────────────────────────────────
	// Weak Hash: RESOLVED (gone)
	// Hardcoded Secret: 2→1 instances (apiKey fixed, dbPassword remains)
	// Sensitive Data in Log: 2→1 instances (logger.debug fixed)
	// SQL Injection: still 3 instances (persisting)
	// Token Exposed: still 1 instance (persisting)
	{
		scan_id: 'scan-003',
		timestamp: Date.now() - 10 * 60 * 1000, // 10 min ago
		vulnerabilities: [
			sqlInjection(3),
			hardcodedSecret(1),
			sensitiveDataInLog(1),
			tokenExposed(),
		],
	},

	// ── Scan 4: Continued improvement ─────────────────────────────────
	// Hardcoded Secret: RESOLVED (dbPassword also fixed)
	// SQL Injection: 3→2 instances (searchParam fixed)
	// Sensitive Data in Log: still 1 instance (persisting)
	// Token Exposed: still 1 instance (persisting)
	{
		scan_id: 'scan-004',
		timestamp: Date.now() - 5 * 60 * 1000, // 5 min ago
		vulnerabilities: [
			sqlInjection(2),
			sensitiveDataInLog(1),
			tokenExposed(),
		],
	},

	// ── Scan 5: Current state ─────────────────────────────────────────
	// SQL Injection: 2→1 instances (query fixed) → IMPROVING
	// Sensitive Data in Log: still 1 instance → PERSISTING
	// Token Exposed: still 1 instance → PERSISTING
	// Path Traversal: NEW (1 instance)
	// All 4 severity levels represented in active findings.
	{
		scan_id: 'scan-005',
		timestamp: Date.now(), // now
		vulnerabilities: [
			sqlInjection(1),
			sensitiveDataInLog(1),
			tokenExposed(),
			pathTraversal(),
		],
	},
];
