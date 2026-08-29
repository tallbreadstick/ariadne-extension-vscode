/**
 * UC-3.3 — GitHub Copilot SDK LLM Client.
 *
 * Sends the assembled prompt to GitHub Copilot via the Copilot SDK,
 * authenticated with the user's GitHub token from VS Code sign-in.
 * Uses a 15-second hard timeout (SRS Section 3.1.3).
 */

import { createCopilotClient, type CopilotRuntimeOptions } from './copilotRuntime.js';
import type { AriadneLLMRequestBody } from './requestTypes.js';

/** Timeout duration in milliseconds — per SRS Section 3.1.3 */
const LLM_TIMEOUT_MS = 15_000;

function extractMessageContent(
	requestBody: AriadneLLMRequestBody,
	role: 'system' | 'user',
): string {
	const message = requestBody.messages.find((entry) => entry.role === role);
	if (!message?.content) {
		throw new Error(`LLM request missing ${role} message content`);
	}
	return message.content;
}

export interface CallLLMOptions extends CopilotRuntimeOptions {}

/**
 * Calls GitHub Copilot through the Copilot SDK and returns the raw response text.
 *
 * @param requestBody - The fully assembled request body from serializePayload().
 * @param options - GitHub token plus runtime paths for the Copilot CLI.
 * @returns The assistant message content from Copilot.
 * @throws {Error} On auth failures, timeouts, or missing response content.
 */
export async function callLLM(
	requestBody: AriadneLLMRequestBody,
	options: CallLLMOptions,
): Promise<string> {
	const { approveAll } = await import('@github/copilot-sdk');

	const systemContent = extractMessageContent(requestBody, 'system');
	const userContent = extractMessageContent(requestBody, 'user');

	const client = await createCopilotClient(options);

	let session;
	try {
		await client.start();

		session = await client.createSession({
			model: requestBody.model,
			clientName: 'ariadne-vscode',
			onPermissionRequest: approveAll,
			availableTools: [],
			infiniteSessions: { enabled: false },
			systemMessage: {
				mode: 'replace',
				content: systemContent,
			},
		});

		const response = await session.sendAndWait(
			{ prompt: userContent },
			LLM_TIMEOUT_MS,
		);

		const content = response?.data.content?.trim();
		if (!content) {
			throw new Error('Copilot response missing assistant message content');
		}

		return content;
	} catch (error: unknown) {
		if (error instanceof Error && /timed?\s*out/i.test(error.message)) {
			throw new Error(
				`Copilot request timed out after ${LLM_TIMEOUT_MS / 1000} seconds`,
			);
		}
		throw error;
	} finally {
		if (session) {
			await session.disconnect().catch(() => undefined);
		}
		await client.stop().catch(() => undefined);
	}
}
