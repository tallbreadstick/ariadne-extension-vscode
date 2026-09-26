import { join, posix } from 'node:path';

/**
 * Relative path (posix) from the extension root to the packaged scanner
 * binary for this host. Undefined when this OS/arch is not shipped.
 */
export function bundledAriadneRelativePath(
	platform: string = process.platform,
	arch: string = process.arch,
): string | undefined {
	if (platform === 'linux' && arch === 'x64') {
		return posix.join('bin', 'linux-x64', 'ariadne');
	}
	if (platform === 'win32' && arch === 'x64') {
		return posix.join('bin', 'win32-x64', 'ariadne.exe');
	}
	if (platform === 'win32' && arch === 'arm64') {
		return posix.join('bin', 'win32-arm64', 'ariadne.exe');
	}
	return undefined;
}

/** Absolute path to the packaged scanner binary, or undefined if unsupported. */
export function bundledAriadneAbsolutePath(
	extensionRoot: string,
	platform: string = process.platform,
	arch: string = process.arch,
): string | undefined {
	const relative = bundledAriadneRelativePath(platform, arch);
	return relative ? join(extensionRoot, relative) : undefined;
}
