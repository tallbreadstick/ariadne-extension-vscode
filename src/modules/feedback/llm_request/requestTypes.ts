/**
 * LLM request types for the Ariadne Feedback module.
 *
 * These types define the data contract for the OpenAI API request
 * and response format used by the LLM pipeline (UC-3.1 / UC-3.2).
 */

import type { VulnerabilityMetadata, ActiveJavaFile } from '../vulnerability_results/vulnerabilityTypes.js';

/**
 * The complete prompt payload that gets JSON.stringify()'d into the
 * OpenAI user message content.
 */
export interface LLMPromptPayload {
	vulnerability: VulnerabilityMetadata;
	active_file: ActiveJavaFile;
}

/**
 * A single message in the OpenAI Chat Completions format.
 */
export interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * The request body sent to POST /v1/chat/completions.
 */
export interface AriadneLLMRequestBody {
	model: string;
	messages: OpenAIMessage[];
}

/**
 * The parsed 3-field educational response from the LLM.
 * The system prompt instructs the LLM to return a JSON object
 * with exactly these three fields.
 */
export interface LLMThreeSectionResponse {
	/** What this vulnerability is (plain-language explanation) */
	vulnerability: string;
	/** Why this vulnerability is dangerous (real-world impact) */
	impact: string;
	/** Where the student should look in their code */
	suggestion: string;
}
