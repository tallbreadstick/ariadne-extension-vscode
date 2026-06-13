/**
 * UC-3.4 — LLM Error Sanitizer.
 *
 * Maps raw exception messages from the LLM pipeline (network errors,
 * API failures, parse failures) to user-friendly messages suitable
 * for display in the Feedback Panel webview.
 *
 * Raw error details are intentionally stripped to avoid exposing
 * internal implementation details (API keys, HTTP status codes,
 * response bodies, JSON structure) to students.
 */

/**
 * Converts a raw LLM pipeline error message into a safe,
 * student-facing string.
 *
 * @param raw - The raw `Error.message` from callLLM / parseThreeSectionResponse.
 * @returns A sanitized, user-friendly error message.
 */
export function sanitizeLlmError(raw: string): string {
	// ── Timeout ──────────────────────────────────────────────────────
	if (raw.includes('timed out') || raw.includes('AbortError')) {
		return 'The request timed out. Please try again.';
	}

	// ── Authentication / authorization failures ─────────────────────
	if (raw.includes('API returned 401') || raw.includes('API returned 403')) {
		return 'API authentication failed. Please check your API key in Settings \u2192 Ariadne.';
	}

	// ── Rate limiting ───────────────────────────────────────────────
	if (raw.includes('API returned 429')) {
		return 'Rate limit exceeded. Please wait a moment and try again.';
	}

	// ── Other API HTTP errors (4xx / 5xx) ───────────────────────────
	if (/API returned [45]\d\d/.test(raw)) {
		return 'The explanation service is temporarily unavailable. Please try again later.';
	}

	// ── LLM response parse / validation failures ────────────────────
	if (
		raw.includes('not valid JSON') ||
		raw.includes('missing or empty') ||
		raw.includes('not a JSON object') ||
		raw.includes('missing choices')
	) {
		return 'Ariadne received an unexpected response. Please try again.';
	}

	// ── Network-level errors ────────────────────────────────────────
	if (
		raw.includes('fetch failed') ||
		raw.includes('ECONNREFUSED') ||
		raw.includes('ENOTFOUND') ||
		raw.includes('NetworkError')
	) {
		return 'Could not connect to the explanation service. Please check your network connection.';
	}

	// ── Catch-all: never forward the raw message ────────────────────
	return 'Ariadne could not retrieve an explanation. Please try again later.';
}
