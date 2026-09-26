import * as assert from 'assert';
import { join } from 'node:path';
import {
	copilotChildEnv,
	copilotCliCandidates,
	copilotPlatformIds,
} from '../modules/feedback/llm_request/copilotRuntime.js';

describe('copilot CLI platform selection', () => {
	const root = '/ext/ariadne';

	it('selects the Linux x64 binary before the musl fallback', () => {
		const candidates = copilotCliCandidates(root, 'linux', 'x64');
		assert.strictEqual(
			candidates[0],
			join(root, 'node_modules', '@github', 'copilot-linux-x64', 'copilot'),
		);
		assert.ok(candidates.some((path) => path.includes('copilot-linuxmusl-x64')));
	});

	it('selects copilot.exe for Windows x64 and ARM64', () => {
		assert.deepStrictEqual(copilotPlatformIds('win32', 'x64'), ['win32-x64']);
		assert.deepStrictEqual(copilotPlatformIds('win32', 'arm64'), ['win32-arm64']);
		assert.strictEqual(
			copilotCliCandidates(root, 'win32', 'x64')[0],
			join(root, 'node_modules', '@github', 'copilot-win32-x64', 'copilot.exe'),
		);
		assert.strictEqual(
			copilotCliCandidates(root, 'win32', 'arm64')[0],
			join(root, 'node_modules', '@github', 'copilot-win32-arm64', 'copilot.exe'),
		);
	});

	it('has no Copilot CLI for unsupported architectures', () => {
		assert.deepStrictEqual(copilotPlatformIds('linux', 'ia32'), []);
		assert.deepStrictEqual(copilotCliCandidates(root, 'darwin', 'arm64'), []);
	});

	it('strips Electron host variables from the CLI environment', () => {
		const env = copilotChildEnv({
			PATH: '/usr/bin',
			SystemRoot: 'C:\\Windows',
			ELECTRON_RUN_AS_NODE: '1',
			NODE_OPTIONS: '--require something',
			EMPTY: undefined,
		});
		assert.strictEqual(env.PATH, '/usr/bin');
		assert.strictEqual(env.SystemRoot, 'C:\\Windows');
		assert.strictEqual(env.ELECTRON_RUN_AS_NODE, undefined);
		assert.strictEqual(env.NODE_OPTIONS, undefined);
		assert.strictEqual('EMPTY' in env, false);
	});
});
