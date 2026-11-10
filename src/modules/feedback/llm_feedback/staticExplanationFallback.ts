/**
 * Offline explanations when Copilot is unavailable or returns invalid output.
 * Generic, educational content keyed by CWE — not tied to the student's code.
 */

import type { LlmFailureReason } from '../llm_request/llmFailureReason.js';
import { llmFailureReasonLabel } from '../llm_request/llmFailureReason.js';
import type { LLMExplanation } from '../llm_request/requestTypes.js';
import type { VulnerabilityMetadata } from '../vulnerability_results/vulnerabilityTypes.js';

const FALLBACK_PREFIX =
	'Offline guide (live Copilot explanation unavailable). ';

type FallbackBuilder = (meta: VulnerabilityMetadata) => LLMExplanation;

function normalizeCwe(cwe: string): string {
	const trimmed = cwe.trim().toUpperCase();
	if (/^CWE-\d+$/.test(trimmed)) {
		return trimmed;
	}
	const match = trimmed.match(/(\d+)/);
	return match ? `CWE-${match[1]}` : trimmed;
}

const CWE_FALLBACKS: Record<string, FallbackBuilder> = {
	'CWE-89': () => ({
		summary: `${FALLBACK_PREFIX}SQL injection (${'CWE-89'}) happens when user-controlled text is pasted into a database command instead of passed as a separate parameter.`,
		why: 'An attacker can change the meaning of the query (read other rows, bypass login checks, or damage data).',
		diagram: {
			caption: 'Made-up data flow — not your project.',
			steps: [
				{ label: 'Input arrives as text', role: 'start' },
				{ label: 'Text is concatenated into SQL', role: 'weak' },
				{ label: 'Database runs attacker-shaped SQL', role: 'harm' },
			],
		},
		mistake: {
			caption: 'String concatenation builds the query.',
			code: [
				'String sql = "SELECT * FROM users WHERE name = \'" + userName + "\'";',
				'Statement stmt = connection.createStatement();',
				'ResultSet rs = stmt.executeQuery(sql);',
			].join('\n'),
			line: 1,
			detail: 'Any special characters in userName can alter the SQL structure.',
		},
		attack: 'A crafted name like `\' OR \'1\'=\'1` can make the WHERE clause always true.',
		safer: {
			caption: 'Parameters keep structure and data separate.',
			code: [
				'String sql = "SELECT * FROM users WHERE name = ?";',
				'PreparedStatement ps = connection.prepareStatement(sql);',
				'ps.setString(1, userName);',
				'ResultSet rs = ps.executeQuery();',
			].join('\n'),
			detail: 'The SQL shape is fixed; user input cannot become syntax.',
		},
		checks: [
			'Does any user or external string join into SQL text?',
			'Are queries executed with PreparedStatement (or equivalent) and bound parameters?',
			'Are ORM queries parameterized rather than built with string formatting?',
		],
	}),

	'CWE-78': () => ({
		summary: `${FALLBACK_PREFIX}OS command injection (${'CWE-78'}) runs shell commands built partly from untrusted input.`,
		why: 'Attackers can chain shell metacharacters to run arbitrary commands on the server.',
		mistake: {
			caption: 'Runtime.exec with concatenated input.',
			code: [
				'String cmd = "ping -c 1 " + host;',
				'Runtime.getRuntime().exec(cmd);',
			].join('\n'),
			line: 2,
			detail: 'host is not validated and is interpreted by the shell.',
		},
		attack: 'A host value like `127.0.0.1; rm -rf /` may execute extra commands.',
		safer: {
			caption: 'ProcessBuilder with a fixed argument list.',
			code: [
				'new ProcessBuilder("ping", "-c", "1", host).start();',
			].join('\n'),
			detail: 'Arguments are separate tokens; metacharacters in host are not shell syntax.',
		},
		checks: [
			'Is any external value passed into Runtime.exec, ProcessBuilder, or scripts?',
			'Can you use a library API instead of spawning a shell?',
			'If input must be used, is it strictly allow-listed?',
		],
	}),

	'CWE-79': () => ({
		summary: `${FALLBACK_PREFIX}Cross-site scripting (${'CWE-79'}) sends untrusted data to a browser without encoding, so the browser may run it as script.`,
		why: 'Victims can lose session cookies, trigger actions, or see forged content in your app.',
		mistake: {
			caption: 'Reflected value rendered raw in HTML.',
			code: [
				'@GetMapping("/greet")',
				'String greet(@RequestParam String name) {',
				'  return "<h1>Hello " + name + "</h1>";',
				'}',
			].join('\n'),
			line: 3,
			detail: 'name is embedded in HTML without escaping.',
		},
		attack: 'A name containing `<script>...</script>` can execute in the victim browser.',
		safer: {
			caption: 'Context-aware encoding or templating.',
			code: [
				'return "<h1>Hello " + HtmlUtils.htmlEscape(name) + "</h1>";',
			].join('\n'),
			detail: 'Encode for HTML context before concatenation (or use a template engine that escapes by default).',
		},
		checks: [
			'Does user input reach HTML, JavaScript, or URL locations?',
			'Are outputs encoded for the correct context?',
			'Does the framework auto-escape in views you use?',
		],
	}),

	'CWE-22': () => ({
		summary: `${FALLBACK_PREFIX}Path traversal (${'CWE-22'}) uses ../ sequences (or equivalent) to escape an intended directory.`,
		why: 'Attackers may read or overwrite sensitive files outside the allowed folder.',
		mistake: {
			caption: 'User input becomes part of a file path.',
			code: [
				'File f = new File(BASE_DIR, userSuppliedName);',
				'return Files.readAllBytes(f.toPath());',
			].join('\n'),
			line: 1,
			detail: 'userSuppliedName can contain parent-directory segments.',
		},
		attack: 'A name like `../../etc/passwd` may resolve outside BASE_DIR.',
		safer: {
			caption: 'Normalize and verify the resolved path stays under base.',
			code: [
				'Path base = Paths.get(BASE_DIR).toRealPath();',
				'Path resolved = base.resolve(userSuppliedName).normalize();',
				'if (!resolved.startsWith(base)) throw new SecurityException();',
			].join('\n'),
			detail: 'Reject paths that escape the intended root after normalization.',
		},
		checks: [
			'Is any filename or path segment taken from users or uploads?',
			'After resolve/normalize, does the path stay inside the allowed directory?',
		],
	}),

	'CWE-502': () => ({
		summary: `${FALLBACK_PREFIX}Unsafe deserialization (${'CWE-502'}) rebuilds objects from untrusted byte streams, which can trigger dangerous logic during construction.`,
		why: 'Gadget chains in common libraries have led to remote code execution in real systems.',
		mistake: {
			caption: 'ObjectInputStream on untrusted bytes.',
			code: [
				'ObjectInputStream in = new ObjectInputStream(untrustedStream);',
				'Object obj = in.readObject();',
			].join('\n'),
			line: 2,
			detail: 'readObject executes attacker-chosen object graphs.',
		},
		attack: 'Crafted serialized data can invoke unexpected methods during deserialization.',
		safer: {
			caption: 'Prefer JSON or DTOs; never deserialize anonymous types from users.',
			code: [
				'MyDto dto = objectMapper.readValue(untrustedJson, MyDto.class);',
			].join('\n'),
			detail: 'Use formats with explicit schemas and no arbitrary class loading.',
		},
		checks: [
			'Where does this byte stream originate — trusted internal storage only?',
			'Can you replace Java serialization with JSON/XML and a fixed DTO type?',
		],
	}),

	'CWE-798': () => ({
		summary: `${FALLBACK_PREFIX}Hard-coded credentials (${'CWE-798'}) embed passwords, API keys, or tokens directly in source.`,
		why: 'Anyone with repo access (or a leaked build) inherits secrets; rotation becomes painful.',
		mistake: {
			caption: 'Secret in source code.',
			code: [
				'private static final String API_KEY = "sk-live-0123456789abcdef";',
			].join('\n'),
			line: 1,
			detail: 'Secrets in VCS history are effectively public.',
		},
		attack: 'Cloned repos, screenshots, or CI logs may expose the embedded secret.',
		safer: {
			caption: 'Load from environment or secret store at runtime.',
			code: [
				'String apiKey = System.getenv("API_KEY");',
				'if (apiKey == null) throw new IllegalStateException("API_KEY not configured");',
			].join('\n'),
			detail: 'Keep secrets out of source; inject per environment.',
		},
		checks: [
			'Is this value a password, token, or private key?',
			'Can it move to environment variables or a secret manager?',
			'If it was ever committed, plan rotation.',
		],
	}),

	'CWE-862': () => ({
		summary: `${FALLBACK_PREFIX}Missing authorization (${'CWE-862'}) exposes an operation without checking whether the caller may perform it.`,
		why: 'Authenticated (or anonymous) users may read or change data belonging to others.',
		mistake: {
			caption: 'Endpoint without ownership check.',
			code: [
				'@DeleteMapping("/users/{id}")',
				'void deleteUser(@PathVariable long id) {',
				'  userRepository.deleteById(id);',
				'}',
			].join('\n'),
			line: 3,
			detail: 'Any caller who can reach the URL may delete any id.',
		},
		attack: 'Iterating ids deletes or reads other users records.',
		safer: {
			caption: 'Authorize before acting on the resource.',
			code: [
				'if (!authz.canDelete(currentUser, id)) throw new AccessDeniedException();',
				'userRepository.deleteById(id);',
			].join('\n'),
			detail: 'Bind the action to the authenticated principal and intended scope.',
		},
		checks: [
			'Does this endpoint verify role, ownership, or policy before the operation?',
			'Could a user substitute another id or object identifier?',
		],
	}),

	'CWE-327': () => ({
		summary: `${FALLBACK_PREFIX}Use of weak or broken cryptography (${'CWE-327'}) relies on algorithms or modes that are no longer safe.`,
		why: 'Confidentiality or integrity guarantees fail under modern attack budgets.',
		mistake: {
			caption: 'Legacy digest or cipher.',
			code: [
				'MessageDigest md = MessageDigest.getInstance("MD5");',
				'byte[] hash = md.digest(password.getBytes());',
			].join('\n'),
			line: 1,
			detail: 'MD5 is unsuitable for password protection or integrity.',
		},
		attack: 'Rainbow tables and collision attacks defeat MD5 for passwords and signatures.',
		safer: {
			caption: 'Modern password hashing or AEAD as appropriate.',
			code: [
				'String hash = BCrypt.hashpw(password, BCrypt.gensalt(12));',
			].join('\n'),
			detail: 'Match the algorithm to the job: Argon2/bcrypt for passwords, AES-GCM for encryption.',
		},
		checks: [
			'Which algorithm and key size are used?',
			'Is this protecting passwords, transport, or data at rest — and is the choice current?',
		],
	}),

	'CWE-330': () => ({
		summary: `${FALLBACK_PREFIX}Insufficient randomness (${'CWE-330'}) uses predictable values where unpredictability is required.`,
		why: 'Tokens, session ids, or nonces may be guessable.',
		mistake: {
			caption: 'java.util.Random for security-sensitive id.',
			code: [
				'Random r = new Random();',
				'String token = String.valueOf(r.nextInt());',
			].join('\n'),
			line: 2,
			detail: 'Random is not cryptographically secure.',
		},
		attack: 'An attacker who seeds or observes outputs can predict the next token.',
		safer: {
			caption: 'SecureRandom for secrets.',
			code: [
				'SecureRandom sr = new SecureRandom();',
				'byte[] bytes = new byte[32];',
				'sr.nextBytes(bytes);',
				'String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);',
			].join('\n'),
			detail: 'Use CSPRNG and enough entropy for the threat model.',
		},
		checks: [
			'Is this value used as a session id, reset token, or cryptographic nonce?',
			'Should java.security.SecureRandom (or platform equivalent) be used instead?',
		],
	}),

	'CWE-200': () => ({
		summary: `${FALLBACK_PREFIX}Exposure of sensitive information (${'CWE-200'}) leaks data that should stay restricted.`,
		why: 'Logs, responses, or errors may reveal credentials, tokens, or personal data.',
		mistake: {
			caption: 'Returning internal details to the client.',
			code: [
				'catch (SQLException e) {',
				'  return ResponseEntity.ok(e.getMessage());',
				'}',
			].join('\n'),
			line: 2,
			detail: 'Database errors may describe schema or queries.',
		},
		attack: 'Attackers probe inputs to harvest error text and map the system.',
		safer: {
			caption: 'Generic client message; log details server-side.',
			code: [
				'catch (SQLException e) {',
				'  log.warn("query failed", e);',
				'  return ResponseEntity.status(500).body("Request failed");',
				'}',
			].join('\n'),
			detail: 'Separate operator diagnostics from end-user responses.',
		},
		checks: [
			'What sensitive fields might this path print, log, or return?',
			'Can client-facing errors be generic while operators retain detail in logs?',
		],
	}),
};

function genericFallback(meta: VulnerabilityMetadata): LLMExplanation {
	const type = meta.type || 'Security issue';
	const cwe = normalizeCwe(meta.cwe_id);
	const line = meta.line_number;
	return {
		summary: `${FALLBACK_PREFIX}${type} (${cwe}). Review how untrusted data reaches the sensitive operation Ariadne flagged.`,
		why: 'When inputs cross trust boundaries without validation, encoding, or authorization, confidentiality, integrity, or availability can be compromised.',
		mistake: {
			caption: 'Pattern to look for near the highlighted line.',
			code: [
				'// Pseudocode — compare with your file around line ' + line,
				'sensitiveOperation(userOrExternalInput);',
			].join('\n'),
			line: 2,
			detail: 'Ask what role the highlighted expression plays: source, sink, or missing check.',
		},
		attack: 'Attackers typically supply unexpected types, sizes, encodings, or identities to see how the program behaves.',
		safer: {
			caption: 'General hardening directions.',
			code: [
				'validate(input);',
				'authorize(principal, resource);',
				'useSafeApi(bindingsInsteadOfConcatenation);',
			].join('\n'),
			detail: 'Pick validate / encode / parameterize / authorize to match the CWE family.',
		},
		checks: [
			`On line ${line}: what data enters this operation and where did it originate?`,
			'Is there a documented security control (validation, authz, crypto) that should apply here?',
			`Look up ${cwe} in the CWE catalog for common mitigations.`,
		],
	};
}

export function buildStaticExplanation(meta: VulnerabilityMetadata): LLMExplanation {
	const key = normalizeCwe(meta.cwe_id);
	const builder = CWE_FALLBACKS[key];
	return builder ? builder(meta) : genericFallback(meta);
}

export function staticExplanationPreamble(
	lineNumber: number,
	failureReason: LlmFailureReason,
): string {
	const why = llmFailureReasonLabel(failureReason);
	return `
		<p class="fallback-note" data-llm-failure-reason="${failureReason}">
			<strong>Built-in explanation:</strong> ${why}
			Ariadne is showing a built-in CWE guide instead of a live Copilot answer.
			<span class="fallback-reason-code">Reason code: <code>${failureReason}</code></span>
			Compare the questions below with line ${lineNumber} in your file.
		</p>`;
}
