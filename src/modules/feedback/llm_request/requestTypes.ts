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
	/** 1-based line that shows the mistake. */
	line?: number;
	/** Plain-language note about that example. No code. */
	detail?: string;
}

/** One box in the supplementary picture. */
export interface FlowStep {
	label: string;
	role: 'start' | 'weak' | 'harm' | 'safe';
}

/** A short picture of the idea. Labels are words, not code. */
export interface ExplanationDiagram {
	caption: string;
	steps: FlowStep[];
}

/**
 * Educational explanation returned by the model.
 * Examples illustrate the pattern. They are not a patch for the finding.
 */
export interface LLMExplanation {
	/** Two or three sentences: the name of the bug, then what that kind of bug is. */
	summary: string;
	/** At most two sentences on the concrete harm. */
	why: string;
	/** Optional picture of how a value moves through a made-up example. */
	diagram?: ExplanationDiagram;
	/** A made-up method with the same mistake. */
	mistake: ExplanationSnippet;
	/** Plain words for how someone could take advantage of that made-up line. */
	attack: string;
	/** A safeguarded shape of that same made-up method. */
	safer: ExplanationSnippet;
	/** Questions about the student's own file, then the concept to study. */
	checks: string[];
}
