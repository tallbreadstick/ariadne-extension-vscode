/**
 * Taxonomy for Explain Vulnerability LLM pipeline failures.
 * Used in the fallback banner (testers) and metrics ingest (aggregates).
 */

export const LLM_FAILURE_REASONS = [
	'timeout',
	'invalid_response',
	'auth',
	'rate_limit',
	'network',
	'service_unavailable',
	'runtime',
	'unknown',
] as const;

export type LlmFailureReason = (typeof LLM_FAILURE_REASONS)[number];

/**
 * Maps a raw `Error.message` to a stable reason code (never includes secrets or HTTP bodies).
 */
export function classifyLlmFailure(raw: string): LlmFailureReason {
	const msg = raw.trim();
	if (!msg) {
		return 'unknown';
	}

	if (/timed?\s*out/i.test(msg) || msg.includes('AbortError')) {
		return 'timeout';
	}

	if (
		msg.includes('not valid JSON')
		|| msg.includes('not a JSON object')
		|| msg.includes('missing or empty')
		|| msg.includes('missing choices')
		|| msg.includes('missing assistant message content')
		|| msg.includes('unexpected response')
	) {
		return 'invalid_response';
	}

	if (
		msg.includes('API returned 401')
		|| msg.includes('API returned 403')
		|| /auth(entication|orization)/i.test(msg)
		|| msg.includes('401')
		|| msg.includes('403')
	) {
		return 'auth';
	}

	if (msg.includes('API returned 429') || /rate\s*limit/i.test(msg)) {
		return 'rate_limit';
	}

	if (
		msg.includes('fetch failed')
		|| msg.includes('ECONNREFUSED')
		|| msg.includes('ENOTFOUND')
		|| msg.includes('NetworkError')
		|| msg.includes('ECONNRESET')
	) {
		return 'network';
	}

	if (/API returned [45]\d\d/.test(msg) || /temporarily unavailable/i.test(msg)) {
		return 'service_unavailable';
	}

	if (
		msg.includes('Copilot CLI binary not found')
		|| msg.includes('copilot-')
		|| msg.includes('Copilot SDK')
		|| msg.includes('EINVAL')
		|| msg.includes('spawn')
	) {
		return 'runtime';
	}

	return 'unknown';
}

/** Student- and tester-visible one-line explanation for the fallback banner. */
export function llmFailureReasonLabel(reason: LlmFailureReason): string {
	switch (reason) {
		case 'timeout':
			return 'Copilot did not answer in time (request timed out).';
		case 'invalid_response':
			return 'Copilot returned a response Ariadne could not parse or validate.';
		case 'auth':
			return 'Copilot or GitHub authentication failed for this request.';
		case 'rate_limit':
			return 'Copilot rate limit was hit for this request.';
		case 'network':
			return 'Ariadne could not reach the Copilot service (network error).';
		case 'service_unavailable':
			return 'The explanation service was temporarily unavailable.';
		case 'runtime':
			return 'The local Copilot runtime failed to start or run.';
		case 'unknown':
			return 'Copilot did not return a usable explanation (unclassified error).';
	}
}

/**
 * @deprecated Prefer {@link classifyLlmFailure} + {@link llmFailureReasonLabel}.
 */
export function sanitizeLlmError(raw: string): string {
	return llmFailureReasonLabel(classifyLlmFailure(raw));
}
