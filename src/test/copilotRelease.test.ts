import * as assert from 'assert';
import {
	hostCopilotPlatformId,
	normalizeCopilotPreferences,
} from '../modules/feedback/llm_request/copilotRelease.js';

describe('copilotRelease', () => {
	it('defaults Auto on for new preferences', () => {
		const prefs = normalizeCopilotPreferences({
			auto: undefined,
			os: undefined,
			platform: undefined,
			version: undefined,
			platformHost: 'linux',
			archHost: 'x64',
			defaultVersion: '1.0.71',
		});
		assert.strictEqual(prefs.auto, true);
		assert.strictEqual(prefs.platform, 'linux-x64');
		assert.strictEqual(prefs.version, '1.0.71');
	});

	it('maps linux x64 host to linux-x64', () => {
		assert.strictEqual(hostCopilotPlatformId('linux', 'x64'), 'linux-x64');
	});
});
