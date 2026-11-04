/**
 * LLM request types for the Ariadne Feedback module.
 *
 * These types define the data contract for the Copilot SDK request
 * and response format used by the LLM pipeline (UC-3.1 / UC-3.2).
 */

import type { VulnerabilityMetadata, ActiveJavaFile } from '../vulnerability_results/vulnerabilityTypes.js';

/**
 * The complete prompt payload that gets JSON.stringify()'d into the
 * user message content.
 */
export interface LLMPromptPayload {
	vulnerability: VulnerabilityMetadata;
	active_file: ActiveJavaFile;
}

/**
 * A single message in the chat prompt format consumed by callLLM().
 */
export interface LLMMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * The request body passed to the Copilot SDK via callLLM().
 */
export interface AriadneLLMRequestBody {
	model: string;
	messages: LLMMessage[];
}

/** A made-up example. Not the student's file or server. */
export interface ExplanationSnippet {
	caption: string;
	code: string;
	/** 1-based line that shows the mistake or the injected value. */
	line?: number;
}

/**
 * Educational explanation returned by the model.
 * Examples illustrate the pattern. They are not a patch for the finding.
 */
export interface LLMExplanation {
	/** One sentence naming the bug. */
	summary: string;
	/** At most two sentences on the concrete harm. */
	why: string;
	/** A made-up method with the same mistake. */
	mistake: ExplanationSnippet;
	/** A made-up request or payload that would reach that mistake. */
	attack: ExplanationSnippet;
	/** A safer shape of that same made-up method. */
	safer: ExplanationSnippet;
	/** Questions about the student's own file, then the concept to study. */
	checks: string[];
}
