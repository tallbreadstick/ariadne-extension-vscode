/**
 * Assembles the vulnerability metadata and active file content into
 * a complete LLM request body for the Copilot SDK pipeline.
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
 * @param model - Copilot model identifier (e.g. "gpt-5-mini").
 * @returns A fully assembled request body for the Copilot SDK session.
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

	// Step 4-5: Assemble the LLM request body
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
