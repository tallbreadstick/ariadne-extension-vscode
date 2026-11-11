import * as assert from 'assert';
import { formatAriadneErrorLine } from '../modules/core/debugLog.js';

describe('debugLog', () => {
	it('formats Error messages with scope', () => {
		const line = formatAriadneErrorLine('llm', new Error('timeout'), 'CWE-89');
		assert.ok(line.includes('[llm]'));
		assert.ok(line.includes('timeout'));
		assert.ok(line.includes('CWE-89'));
	});
});
