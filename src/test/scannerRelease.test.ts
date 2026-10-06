import * as assert from 'assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	LATEST_RELEASE_URL,
	hostScannerTarget,
	normalizeScannerPreferences,
	parseLatestRelease,
	selectReleaseAsset,
	selectedScannerTarget,
	targetFromAssetName,
	targetsForOs,
} from '../modules/core/scannerRelease.js';

const sampleAssets = [
	{ name: 'x86_64-unknown-linux-gnu-0.0.1', browser_download_url: 'https://github.com/tallbreadstick/ariadne-binaries/releases/download/v/x86_64-unknown-linux-gnu-0.0.1' },
	{ name: 'x86_64-pc-windows-msvc-0.0.1.exe', browser_download_url: 'https://github.com/tallbreadstick/ariadne-binaries/releases/download/v/x86_64-pc-windows-msvc-0.0.1.exe' },
	{ name: 'aarch64-pc-windows-msvc-1.2.3.exe', browser_download_url: 'https://github.com/tallbreadstick/ariadne-binaries/releases/download/v/aarch64-pc-windows-msvc-1.2.3.exe' },
	{ name: 'x86_64-unknown-linux-gnu-0.0.1.sha256', browser_download_url: 'https://github.com/tallbreadstick/ariadne-binaries/releases/download/v/checksum' },
];

describe('scanner release selection', () => {
	it('maps Auto to the host target', () => {
		assert.strictEqual(hostScannerTarget('linux', 'x64'), 'x86_64-unknown-linux-gnu');
		assert.strictEqual(hostScannerTarget('linux', 'arm64'), 'aarch64-unknown-linux-gnu');
		assert.strictEqual(hostScannerTarget('win32', 'x64'), 'x86_64-pc-windows-msvc');
		assert.strictEqual(hostScannerTarget('win32', 'arm64'), 'aarch64-pc-windows-msvc');
		assert.strictEqual(hostScannerTarget('darwin', 'arm64'), 'aarch64-apple-darwin');
		assert.strictEqual(hostScannerTarget('darwin', 'x64'), 'x86_64-apple-darwin');
		assert.strictEqual(
			selectedScannerTarget('auto', 'win32', 'arm64'),
			'aarch64-pc-windows-msvc',
		);
	});

	it('keeps an explicit target instead of the host', () => {
		assert.strictEqual(
			selectedScannerTarget('x86_64-pc-windows-gnu', 'linux', 'x64'),
			'x86_64-pc-windows-gnu',
		);
	});

	it('rejects an unknown target', () => {
		assert.throws(() => selectedScannerTarget('not-a-target', 'linux', 'x64'), /Unknown/);
	});

	it('picks the versioned asset for a target and ignores checksums', () => {
		assert.strictEqual(
			selectReleaseAsset(sampleAssets, 'x86_64-unknown-linux-gnu')?.name,
			'x86_64-unknown-linux-gnu-0.0.1',
		);
		assert.strictEqual(
			selectReleaseAsset(sampleAssets, 'aarch64-pc-windows-msvc')?.name,
			'aarch64-pc-windows-msvc-1.2.3.exe',
		);
		assert.strictEqual(selectReleaseAsset(sampleAssets, 'universal2-apple-darwin'), undefined);
	});

	it('reads assets from a latest-release payload', () => {
		const assets = parseLatestRelease({ assets: sampleAssets, tag_name: 'Ariadne-0.0.1' });
		assert.strictEqual(assets.length, sampleAssets.length);
		assert.strictEqual(parseLatestRelease([{ assets: sampleAssets }]).length, sampleAssets.length);
		assert.throws(() => parseLatestRelease({ tag_name: 'x' }), /binaries/);
		assert.throws(() => parseLatestRelease([]), /binaries/);
		assert.ok(LATEST_RELEASE_URL.includes('ariadne-binaries/releases'));
	});

	it('keeps binary choice in the sidebar and scan settings in Preferences', () => {
		const manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
			contributes: {
				configuration: { properties: Record<string, unknown> };
				viewsContainers?: { activitybar?: { id: string }[] };
				views?: {
					'ariadne-sidebar'?: { id: string }[];
					'ariadne-panel'?: { id: string }[];
				};
			};
		};
		const properties = manifest.contributes.configuration.properties;
		assert.ok(properties['ariadne.executable']);
		assert.ok(properties['ariadne.notifications.level']);
		assert.ok(properties['ariadne.autoScan.intervalMinutes']);
		assert.strictEqual(properties['ariadne.scanner.auto'], undefined);
		assert.strictEqual(properties['ariadne.account.github'], undefined);
		assert.strictEqual(manifest.contributes.viewsContainers?.activitybar?.[0]?.id, 'ariadne-sidebar');
		assert.strictEqual(manifest.contributes.views?.['ariadne-sidebar']?.[0]?.id, 'ariadne.sidebar.signIn');
		assert.ok(!manifest.contributes.views?.['ariadne-panel']?.some((view) => view.id === 'ariadne.panel.settings'));
	});

	it('groups binaries by operating system', () => {
		assert.deepStrictEqual(targetsForOs('windows').includes('x86_64-pc-windows-msvc'), true);
		assert.deepStrictEqual(targetsForOs('linux').includes('x86_64-unknown-linux-gnu'), true);
		assert.deepStrictEqual(targetsForOs('macos').includes('aarch64-apple-darwin'), true);
		assert.strictEqual(targetFromAssetName('x86_64-pc-windows-msvc-0.0.1.exe'), 'x86_64-pc-windows-msvc');
		assert.strictEqual(targetFromAssetName('x86_64-unknown-linux-gnu-0.0.1.sha256'), undefined);
	});

	it('defaults Auto on and keeps a saved manual binary', () => {
		assert.deepStrictEqual(normalizeScannerPreferences({
			auto: undefined,
			os: undefined,
			target: undefined,
			legacy: undefined,
			platform: 'linux',
			arch: 'x64',
		}), {
			auto: true,
			os: 'linux',
			target: 'x86_64-unknown-linux-gnu',
		});
		assert.deepStrictEqual(normalizeScannerPreferences({
			auto: false,
			os: 'windows',
			target: 'aarch64-pc-windows-msvc',
			legacy: 'auto',
			platform: 'linux',
			arch: 'x64',
		}), {
			auto: false,
			os: 'windows',
			target: 'aarch64-pc-windows-msvc',
		});
		assert.strictEqual(normalizeScannerPreferences({
			auto: undefined,
			os: undefined,
			target: undefined,
			legacy: 'x86_64-pc-windows-gnu',
			platform: 'linux',
			arch: 'x64',
		}).auto, false);
	});
});
