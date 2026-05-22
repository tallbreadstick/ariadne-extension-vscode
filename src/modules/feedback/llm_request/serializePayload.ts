/**
 * UC-3.1 — LLM Prompt Payload Serialization.
 *
 * Assembles the vulnerability metadata and active file content into
 * a complete OpenAI Chat Completions request body, ready to POST.
 *
 * ─────────────────────────────────────────────────────────────────────
 * STATUS: DORMANT — Exported but not called in the active code path.
 * Will be called from extension.ts when the SAST core is ready.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { VulnerabilityMetadata } from '../vulnerability_results/vulnerabilityTypes.js';
import type {
	LLMPromptPayload,
	AriadneLLMRequestBody,
} from './requestTypes.js';
import { ARIADNE_SYSTEM_PROMPT } from './systemPrompt.js';

/**
 * Builds the complete OpenAI request body from vulnerability metadata
 * and the active file's content.
 *
 * @param vulnerability - Metadata from the SAST engine finding.
 * @param activeFileContent - Full text of the Java file (or "" on read failure).
 * @param activeFilePath - Path to the active Java file.
 * @param model - OpenAI model identifier (e.g. "gpt-4o-mini").
 * @returns A fully assembled request body for POST /v1/chat/completions.
 */
export function serializePayload(
	vulnerability: VulnerabilityMetadata,
	activeFileContent: string,
	activeFilePath: string,
	model: string,
): AriadneLLMRequestBody {
	// Step 1-2: Build the prompt payload with vulnerability + active file
	const payload: LLMPromptPayload = {
		vulnerability,
		active_file: {
			file_path: activeFilePath,
			content: activeFileContent,
		},
	};

	// Step 3: JSON.stringify() the payload into the user message content
	const userContent = JSON.stringify(payload);

	// Step 4-5: Assemble the OpenAI request body
	return {
		model,
		messages: [
			{
				role: 'system',
				content: ARIADNE_SYSTEM_PROMPT,
			},
			{
				role: 'user',
				content: userContent,
			},
		],
	};
}
