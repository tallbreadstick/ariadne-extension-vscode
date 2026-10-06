/**
 * Picks a scanner binary from the latest public ariadne-binaries release.
 * Asset names look like `x86_64-unknown-linux-gnu-0.0.1` or
 * `x86_64-pc-windows-msvc-0.0.1.exe`.
 */

export const LATEST_RELEASE_URL =
	'https://api.github.com/repos/tallbreadstick/ariadne-binaries/releases?per_page=1';

export const SCANNER_AUTO = 'auto';

/** Rust targets published as release assets. Keep in sync with package.json. */
export const SCANNER_TARGETS = [
	'x86_64-unknown-linux-gnu',
	'i686-unknown-linux-gnu',
	'aarch64-unknown-linux-gnu',
	'armv7-unknown-linux-gnueabihf',
	'x86_64-pc-windows-msvc',
	'i686-pc-windows-msvc',
	'aarch64-pc-windows-msvc',
	'x86_64-pc-windows-gnu',
	'i686-pc-windows-gnu',
	'universal2-apple-darwin',
	'aarch64-apple-darwin',
	'x86_64-apple-darwin',
] as const;

export type ScannerTarget = (typeof SCANNER_TARGETS)[number];

export type ScannerOs = 'windows' | 'linux' | 'macos';

export const SCANNER_OS_OPTIONS: readonly { id: ScannerOs; label: string }[] = [
	{ id: 'windows', label: 'Windows' },
	{ id: 'linux', label: 'Linux' },
	{ id: 'macos', label: 'macOS' },
];

const SCANNER_OS_TARGETS: Record<ScannerOs, readonly ScannerTarget[]> = {
	windows: [
		'x86_64-pc-windows-msvc',
		'i686-pc-windows-msvc',
		'aarch64-pc-windows-msvc',
		'x86_64-pc-windows-gnu',
		'i686-pc-windows-gnu',
	],
	linux: [
		'x86_64-unknown-linux-gnu',
		'i686-unknown-linux-gnu',
		'aarch64-unknown-linux-gnu',
		'armv7-unknown-linux-gnueabihf',
	],
	macos: [
		'universal2-apple-darwin',
		'aarch64-apple-darwin',
		'x86_64-apple-darwin',
	],
};

export const SCANNER_TARGET_LABELS: Record<ScannerTarget, string> = {
	'x86_64-unknown-linux-gnu': 'Linux 64-bit x86',
	'i686-unknown-linux-gnu': 'Linux 32-bit x86',
	'aarch64-unknown-linux-gnu': 'Linux 64-bit ARM',
	'armv7-unknown-linux-gnueabihf': 'Linux 32-bit ARM',
	'x86_64-pc-windows-msvc': 'Windows 64-bit x86 (MSVC)',
	'i686-pc-windows-msvc': 'Windows 32-bit x86 (MSVC)',
	'aarch64-pc-windows-msvc': 'Windows 64-bit ARM',
	'x86_64-pc-windows-gnu': 'Windows 64-bit x86 (MinGW)',
	'i686-pc-windows-gnu': 'Windows 32-bit x86 (MinGW)',
	'universal2-apple-darwin': 'macOS universal',
	'aarch64-apple-darwin': 'macOS Apple Silicon',
	'x86_64-apple-darwin': 'macOS Intel',
};

export interface ScannerPreferences {
	auto: boolean;
	os: ScannerOs;
	target: ScannerTarget;
}

export interface ScannerPreferenceInput {
	auto: boolean | undefined;
	os: string | undefined;
	target: string | undefined;
	legacy: string | undefined;
	platform: string;
	arch: string;
}

export interface ReleaseAsset {
	name: string;
	browser_download_url: string;
	size?: number;
}

const TARGET_SET = new Set<string>(SCANNER_TARGETS);
const OS_SET = new Set<string>(SCANNER_OS_OPTIONS.map((option) => option.id));

export function isScannerTarget(value: string): value is ScannerTarget {
	return TARGET_SET.has(value);
}

export function isScannerOs(value: string): value is ScannerOs {
	return OS_SET.has(value);
}

export function hostScannerOs(platform: string): ScannerOs {
	if (platform === 'win32') {
		return 'windows';
	}
	if (platform === 'darwin') {
		return 'macos';
	}
	return 'linux';
}

export function targetsForOs(os: ScannerOs): readonly ScannerTarget[] {
	return SCANNER_OS_TARGETS[os];
}

export function scannerOsForTarget(target: string): ScannerOs | undefined {
	if (!isScannerTarget(target)) {
		return undefined;
	}
	return SCANNER_OS_OPTIONS.find((option) => SCANNER_OS_TARGETS[option.id].includes(target))?.id;
}

/**
 * Fills missing Auto / OS / binary choices.
 * Auto defaults on. A previously saved concrete `ariadne.scanner` value turns Auto off.
 */
export function normalizeScannerPreferences(input: ScannerPreferenceInput): ScannerPreferences {
	const legacyTarget = input.legacy && input.legacy !== SCANNER_AUTO && isScannerTarget(input.legacy)
		? input.legacy
		: undefined;
	const auto = input.auto ?? !legacyTarget;
	const storedTarget = input.target && isScannerTarget(input.target) ? input.target : legacyTarget;
	const os = input.os && isScannerOs(input.os)
		? input.os
		: (storedTarget ? scannerOsForTarget(storedTarget) : undefined) ?? hostScannerOs(input.platform);
	const options = targetsForOs(os);
	const host = hostScannerTarget(input.platform, input.arch);
	const target = storedTarget && options.includes(storedTarget)
		? storedTarget
		: (host && options.includes(host) ? host : options[0]);
	return { auto, os, target };
}

/** Asset file names look like `<target>-<semver>` or `<target>-<semver>.exe`. */
export function targetFromAssetName(name: string): ScannerTarget | undefined {
	const match = /^(.+)-\d+\.\d+\.\d+(?:\.exe)?$/.exec(name);
	if (!match || !isScannerTarget(match[1])) {
		return undefined;
	}
	return match[1];
}

/** Maps a Node host to the release target Auto should download. */
export function hostScannerTarget(platform: string, arch: string): ScannerTarget | undefined {
	if (platform === 'linux' && arch === 'x64') {
		return 'x86_64-unknown-linux-gnu';
	}
	if (platform === 'linux' && arch === 'arm64') {
		return 'aarch64-unknown-linux-gnu';
	}
	if (platform === 'linux' && arch === 'ia32') {
		return 'i686-unknown-linux-gnu';
	}
	if (platform === 'linux' && arch === 'arm') {
		return 'armv7-unknown-linux-gnueabihf';
	}
	if (platform === 'win32' && arch === 'x64') {
		return 'x86_64-pc-windows-msvc';
	}
	if (platform === 'win32' && arch === 'ia32') {
		return 'i686-pc-windows-msvc';
	}
	if (platform === 'win32' && arch === 'arm64') {
		return 'aarch64-pc-windows-msvc';
	}
	if (platform === 'darwin' && arch === 'arm64') {
		return 'aarch64-apple-darwin';
	}
	if (platform === 'darwin' && arch === 'x64') {
		return 'x86_64-apple-darwin';
	}
	return undefined;
}

/**
 * Resolves the settings value to a concrete release target.
 * `auto` follows the host. Any other value must be a published target.
 */
export function selectedScannerTarget(
	configured: string,
	platform: string,
	arch: string,
): ScannerTarget {
	const value = configured.trim() || SCANNER_AUTO;
	if (value === SCANNER_AUTO) {
		const host = hostScannerTarget(platform, arch);
		if (!host) {
			throw new Error(
				`No Ariadne scanner build for ${platform}/${arch}. Choose a binary in the Ariadne: Scanner setting.`,
			);
		}
		return host;
	}
	if (!TARGET_SET.has(value)) {
		throw new Error(`Unknown Ariadne scanner binary "${value}".`);
	}
	return value as ScannerTarget;
}

/** Finds the asset whose name is `<target>-<version>` or `<target>-<version>.exe`. */
export function selectReleaseAsset(
	assets: readonly ReleaseAsset[],
	target: string,
): ReleaseAsset | undefined {
	const prefix = `${target}-`;
	return assets.find((asset) => {
		if (!asset.name.startsWith(prefix) || !asset.browser_download_url) {
			return false;
		}
		const rest = asset.name.slice(prefix.length);
		return /^\d+\.\d+\.\d+(\.exe)?$/.test(rest);
	});
}

export function parseLatestRelease(body: unknown): ReleaseAsset[] {
	// /releases/latest skips pre-releases. The binaries repo publishes pre-releases,
	// so the caller passes the newest item from /releases.
	const release = Array.isArray(body) ? body[0] : body;
	if (!release || typeof release !== 'object' || !('assets' in release)) {
		throw new Error('Latest Ariadne release did not include a list of binaries.');
	}
	const assets = (release as { assets?: unknown }).assets;
	if (!Array.isArray(assets)) {
		throw new Error('Latest Ariadne release did not include a list of binaries.');
	}
	return assets.flatMap((asset) => {
		if (!asset || typeof asset !== 'object') {
			return [];
		}
		const name = (asset as { name?: unknown }).name;
		const url = (asset as { browser_download_url?: unknown }).browser_download_url;
		if (typeof name !== 'string' || typeof url !== 'string') {
			return [];
		}
		return [{ name, browser_download_url: url }];
	});
}
