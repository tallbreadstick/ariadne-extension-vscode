import * as assert from 'assert';
import {
	classifyLlmFailure,
	llmFailureReasonLabel,
} from '../modules/feedback/llm_request/llmFailureReason.js';

describe('llmFailureReason', () => {
	it('classifies timeout', () => {
		assert.strictEqual(
			classifyLlmFailure('Copilot request timed out after 30 seconds'),
			'timeout',
		);
	});

	it('classifies invalid JSON responses', () => {
		assert.strictEqual(
			classifyLlmFailure('LLM response is not valid JSON and does not contain a JSON code block'),
			'invalid_response',
		);
	});

	it('classifies missing Copilot runtime', () => {
		assert.strictEqual(
			classifyLlmFailure('Copilot CLI binary not found for linux/x64'),
			'runtime',
		);
	});

	it('provides a label for every reason code', () => {
		for (const reason of [
			'timeout',
			'invalid_response',
			'auth',
			'rate_limit',
			'network',
			'service_unavailable',
			'runtime',
			'unknown',
		] as const) {
			assert.ok(llmFailureReasonLabel(reason).length > 10);
		}
	});
});
