/**
 * UC-3.3 — OpenAI LLM Client.
 *
 * Sends the assembled request body to the OpenAI Chat Completions API
 * over HTTPS with a 15-second hard timeout (SRS Section 3.1.3).
 *
 * ─────────────────────────────────────────────────────────────────────
 * STATUS: DORMANT — Exported but not called in the active code path.
 * Will be called from extension.ts when the SAST core is ready.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { AriadneLLMRequestBody } from '../types.js';

/** Timeout duration in milliseconds — per SRS Section 3.1.3 */
const LLM_TIMEOUT_MS = 15_000;

/** OpenAI Chat Completions endpoint (HTTPS / TLS 1.2+) */
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Calls the OpenAI Chat Completions API and returns the raw response text.
 *
 * @param requestBody - The fully assembled request body from serializePayload().
 * @param apiKey - The user's OpenAI API key.
 * @returns The raw content string from `choices[0].message.content`.
 * @throws {Error} On network errors, non-2xx status, timeout, or missing content.
 */
export async function callLLM(
	requestBody: AriadneLLMRequestBody,
	apiKey: string,
): Promise<string> {
	// 15-second hard timeout via AbortController
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

	try {
		const response = await fetch(OPENAI_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		if (!response.ok) {
			const errorBody = await response.text().catch(() => '(no body)');
			throw new Error(
				`OpenAI API returned ${response.status}: ${errorBody}`,
			);
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};

		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error(
				'OpenAI response missing choices[0].message.content',
			);
		}

		return content;
	} catch (error: unknown) {
		// Distinguish timeout from other errors
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error(
				`OpenAI request timed out after ${LLM_TIMEOUT_MS / 1000} seconds`,
			);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}
