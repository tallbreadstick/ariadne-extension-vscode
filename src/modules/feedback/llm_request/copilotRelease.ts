/**
 * Copilot native CLI packages (@github/copilot-<platform>). Versions match the
 * extension's pinned `@github/copilot` optionalDependencies.
 */

export const COPILOT_AUTO = 'auto';

export const COPILOT_PLATFORM_IDS = [
	'linux-x64',
	'linuxmusl-x64',
	'linux-arm64',
	'linuxmusl-arm64',
	'win32-x64',
	'win32-arm64',
	'darwin-x64',
	'darwin-arm64',
] as const;

export type CopilotPlatformId = (typeof COPILOT_PLATFORM_IDS)[number];

export type CopilotOs = 'windows' | 'linux' | 'macos';

export const COPILOT_OS_OPTIONS: readonly { id: CopilotOs; label: string }[] = [
	{ id: 'windows', label: 'Windows' },
	{ id: 'linux', label: 'Linux' },
	{ id: 'macos', label: 'macOS' },
];

const COPILOT_OS_PLATFORMS: Record<CopilotOs, readonly CopilotPlatformId[]> = {
	windows: ['win32-x64', 'win32-arm64'],
	linux: ['linux-x64', 'linuxmusl-x64', 'linux-arm64', 'linuxmusl-arm64'],
	macos: ['darwin-x64', 'darwin-arm64'],
};

export const COPILOT_PLATFORM_LABELS: Record<CopilotPlatformId, string> = {
	'linux-x64': 'Linux glibc x64',
	'linuxmusl-x64': 'Linux musl x64 (Nix/Alpine)',
	'linux-arm64': 'Linux ARM64 glibc',
	'linuxmusl-arm64': 'Linux ARM64 musl',
	'win32-x64': 'Windows x64',
	'win32-arm64': 'Windows ARM64',
	'darwin-x64': 'macOS Intel',
	'darwin-arm64': 'macOS Apple Silicon',
};

export interface CopilotPreferences {
	auto: boolean;
	os: CopilotOs;
	platform: CopilotPlatformId;
	version: string;
}

export interface CopilotPreferenceInput {
	auto: boolean | undefined;
	os: string | undefined;
	platform: string | undefined;
	version: string | undefined;
	platformHost: string;
	archHost: string;
	defaultVersion: string;
}

const PLATFORM_SET = new Set<string>(COPILOT_PLATFORM_IDS);
const OS_SET = new Set<string>(COPILOT_OS_OPTIONS.map((o) => o.id));

export function isCopilotPlatformId(value: string): value is CopilotPlatformId {
	return PLATFORM_SET.has(value);
}

export function isCopilotOs(value: string): value is CopilotOs {
	return OS_SET.has(value);
}

export function hostCopilotOs(platform: string): CopilotOs {
	if (platform === 'win32') {
		return 'windows';
	}
	if (platform === 'darwin') {
		return 'macos';
	}
	return 'linux';
}

export function platformsForOs(os: CopilotOs): readonly CopilotPlatformId[] {
	return COPILOT_OS_PLATFORMS[os];
}

export function copilotOsForPlatform(platform: string): CopilotOs | undefined {
	if (!isCopilotPlatformId(platform)) {
		return undefined;
	}
	return COPILOT_OS_OPTIONS.find((o) => COPILOT_OS_PLATFORMS[o.id].includes(platform))?.id;
}

/** Platform ids to try on this host (same order as runtime resolution). */
export function hostCopilotPlatformIds(platform: string, arch: string): CopilotPlatformId[] {
	if (arch !== 'x64' && arch !== 'arm64') {
		return [];
	}
	if (platform === 'linux') {
		return [`linux-${arch}` as CopilotPlatformId, `linuxmusl-${arch}` as CopilotPlatformId];
	}
	if (platform === 'win32') {
		return [`win32-${arch}` as CopilotPlatformId];
	}
	if (platform === 'darwin') {
		return [`darwin-${arch}` as CopilotPlatformId];
	}
	return [];
}

export function hostCopilotPlatformId(platform: string, arch: string): CopilotPlatformId | undefined {
	return hostCopilotPlatformIds(platform, arch)[0];
}

export function normalizeCopilotPreferences(input: CopilotPreferenceInput): CopilotPreferences {
	const auto = input.auto ?? true;
	const storedPlatform = input.platform && isCopilotPlatformId(input.platform)
		? input.platform
		: undefined;
	const os = input.os && isCopilotOs(input.os)
		? input.os
		: (storedPlatform ? copilotOsForPlatform(storedPlatform) : undefined)
			?? hostCopilotOs(input.platformHost);
	const options = platformsForOs(os);
	const host = hostCopilotPlatformId(input.platformHost, input.archHost);
	const platform = storedPlatform && options.includes(storedPlatform)
		? storedPlatform
		: (host && options.includes(host) ? host : options[0]);
	const version = (input.version?.trim() || input.defaultVersion).trim() || input.defaultVersion;
	return { auto, os, platform, version };
}

export function selectedCopilotPlatform(
	prefs: CopilotPreferences,
	platform: string,
	arch: string,
): CopilotPlatformId {
	if (prefs.auto) {
		const host = hostCopilotPlatformId(platform, arch);
		if (!host) {
			throw new Error(
				`No Copilot CLI build for ${platform}/${arch}. Choose a build in Copilot settings.`,
			);
		}
		return host;
	}
	return prefs.platform;
}

export function npmPackageName(platformId: CopilotPlatformId): string {
	return `copilot-${platformId}`;
}
