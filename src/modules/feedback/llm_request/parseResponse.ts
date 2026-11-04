/**
 * Parses the explanation JSON from the model.
 *
 * Accepts a raw object or a JSON object wrapped in a markdown fence.
 * Code fields may arrive fenced; those fences are stripped so the
 * panel can highlight the Java itself.
 */

import type { ExplanationSnippet, LLMExplanation } from './requestTypes.js';

const TEXT_FIELDS = ['summary', 'why'] as const;

/**
 * Parses the raw model response into the explanation shown in the panel.
 *
 * @param rawContent - The raw text from `choices[0].message.content`.
 * @throws {Error} If the response is not the expected JSON object.
 */
export function parseExplanation(rawContent: string): LLMExplanation {
	const parsed = parseJsonObject(rawContent);

	const text: Record<string, string> = {};
	for (const field of TEXT_FIELDS) {
		text[field] = requiredText(parsed[field], field);
	}

	return {
		summary: text['summary'],
		why: text['why'],
		mistake: requiredSnippet(parsed['mistake'], 'mistake'),
		attack: requiredSnippet(parsed['attack'], 'attack'),
		safer: requiredSnippet(parsed['safer'], 'safer'),
		checks: requiredChecks(parsed['checks']),
	};
}

function parseJsonObject(rawContent: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawContent.trim());
	} catch {
		const jsonMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
		if (!jsonMatch?.[1]) {
			throw new Error('LLM response is not valid JSON and does not contain a JSON code block');
		}
		try {
			parsed = JSON.parse(jsonMatch[1].trim());
		} catch {
			throw new Error('LLM response contains a code block but it is not valid JSON');
		}
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('LLM response is not a JSON object');
	}
	return parsed as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`LLM response has missing or empty "${field}" field`);
	}
	return value.trim();
}

function requiredSnippet(value: unknown, field: string): ExplanationSnippet {
	if (typeof value === 'string') {
		const code = stripFences(value);
		if (!code) {
			throw new Error(`LLM response has missing or empty "${field}" field`);
		}
		return { caption: '', code };
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`LLM response has missing or empty "${field}" field`);
	}
	const record = value as Record<string, unknown>;
	const code = typeof record.code === 'string' ? stripFences(record.code) : '';
	if (!code) {
		throw new Error(`LLM response has missing or empty "${field}" field`);
	}
	const caption = typeof record.caption === 'string' ? record.caption.trim() : '';
	const lineCount = code.split(/\r?\n/).length;
	return { caption, code, line: snippetLine(record.line, lineCount) };
}

function snippetLine(value: unknown, lineCount: number): number | undefined {
	const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > lineCount) {
		return undefined;
	}
	return parsed;
}

function requiredChecks(value: unknown): string[] {
	const items = Array.isArray(value)
		? value
		: typeof value === 'string'
			? value.split(/\n+/)
			: [];
	const checks = items
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.replace(/^[-*\d.)\s]+/, '').trim())
		.filter((item) => item.length > 0)
		.slice(0, 4);
	if (checks.length === 0) {
		throw new Error('LLM response has missing or empty "checks" field');
	}
	return checks;
}

function stripFences(code: string): string {
	const trimmed = code.trim();
	const fenced = trimmed.match(/^```(?:java|bash|sh|shell|http|json|text)?\s*\n?([\s\S]*?)\n?```$/);
	return (fenced?.[1] ?? trimmed).trim();
}
