import * as assert from 'assert';
import { debugCoreEnabled } from '../modules/core/ariadneExecutable.js';
import { formatAriadneErrorLine, loggableUrl } from '../modules/core/debugLog.js';

describe('debugLog', () => {
	it('formats Error messages with scope', () => {
		const line = formatAriadneErrorLine('llm', new Error('timeout'), 'CWE-89');
		assert.ok(line.includes('[llm]'));
		assert.ok(line.includes('timeout'));
		assert.ok(line.includes('CWE-89'));
		assert.ok(/^\[[0-9]{4}-/.test(line));
	});

	it('redacts tokens and signed query values', () => {
		const line = formatAriadneErrorLine(
			'scanner-download',
			new Error('HTTP 403 https://example.com/file?token=ghp_secretvalue Authorization: Bearer super-secret'),
			'status=403',
		);
		assert.ok(line.includes('HTTP 403'));
		assert.ok(line.includes('status=403'));
		assert.ok(!line.includes('ghp_secretvalue'));
		assert.ok(!line.includes('super-secret'));
		assert.ok(line.includes('[redacted]'));
	});

	it('strips the query string from logged URLs', () => {
		assert.strictEqual(
			loggableUrl('https://api.github.com/repos/example/releases?per_page=1&token=abc'),
			'https://api.github.com/repos/example/releases',
		);
	});

	it('turns debug core on only for the env flag', () => {
		assert.strictEqual(debugCoreEnabled({ ARIADNE_DEBUG_CORE: '1' } as NodeJS.ProcessEnv), true);
		assert.strictEqual(debugCoreEnabled({ ARIADNE_DEBUG_CORE: 'true' } as NodeJS.ProcessEnv), true);
		assert.strictEqual(debugCoreEnabled({ ARIADNE_DEBUG_CORE: '' } as NodeJS.ProcessEnv), false);
	});
});
