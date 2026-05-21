/**
 * UC-3.2 — LLM Response Parser / Validator.
 *
 * Parses the raw LLM JSON response and validates that it contains
 * exactly the three required fields: vulnerability, impact, suggestion.
 * Falls back to extracting JSON from markdown code fences if the LLM
 * wraps its response (common with some models).
 */

import type { LLMThreeSectionResponse } from '../types.js';

/** Required field names in the LLM JSON response. */
const REQUIRED_FIELDS = ['vulnerability', 'impact', 'suggestion'] as const;

/**
 * Parses the raw LLM response into the 3-field structure.
 *
 * @param rawContent - The raw text from `choices[0].message.content`.
 * @returns The parsed response with vulnerability, impact, suggestion fields.
 * @throws {Error} If the response is not valid JSON or is missing
 *   required fields (triggers UC-3.4 fallback).
 */
export function parseThreeSectionResponse(
	rawContent: string,
): LLMThreeSectionResponse {
	let parsed: unknown;

	// Attempt 1: Parse the raw content directly as JSON
	try {
		parsed = JSON.parse(rawContent.trim());
	} catch {
		// Attempt 2: Extract JSON from markdown code fences (```json ... ```)
		const jsonMatch = rawContent.match(
			/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/,
		);
		if (jsonMatch?.[1]) {
			try {
				parsed = JSON.parse(jsonMatch[1].trim());
			} catch {
				throw new Error(
					'LLM response contains a code block but it is not valid JSON',
				);
			}
		} else {
			throw new Error(
				'LLM response is not valid JSON and does not contain a JSON code block',
			);
		}
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('LLM response is not a JSON object');
	}

	const obj = parsed as Record<string, unknown>;

	// Validate all three required fields are present and non-empty strings
	const result: Record<string, string> = {};
	for (const field of REQUIRED_FIELDS) {
		const value = obj[field];
		if (typeof value !== 'string' || value.trim().length === 0) {
			throw new Error(
				`LLM response has missing or empty "${field}" field`,
			);
		}
		result[field] = value.trim();
	}

	return {
		vulnerability: result['vulnerability'],
		impact: result['impact'],
		suggestion: result['suggestion'],
	};
}
