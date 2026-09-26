/**
 * Resolves and configures the GitHub Copilot SDK runtime for the extension host.
 *
 * VS Code's extension host runs under Electron. The SDK's default bundled CLI
 * path (`index.js`) is launched with `process.execPath`, which breaks CLI
 * argument parsing. We therefore point stdio transport at the native
 * `copilot` binary shipped in `@github/copilot-<platform>-<arch>`.
 */

import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, join } from 'node:path';

const ELECTRON_ENV_KEYS = [
	'ELECTRON_RUN_AS_NODE',
	'ELECTRON_NO_ASAR',
	'NODE_OPTIONS',
] as const;

/** Host ids this extension can launch, in the order they should be tried. */
export function copilotPlatformIds(platform: string, arch: string): string[] {
	if (arch !== 'x64' && arch !== 'arm64') {
		return [];
	}
	if (platform === 'linux') {
		return [`linux-${arch}`, `linuxmusl-${arch}`];
	}
	if (platform === 'win32') {
		return [`win32-${arch}`];
	}
	return [];
}

function binaryNames(platform: string): string[] {
	return platform === 'win32' ? ['copilot.exe', 'copilot'] : ['copilot', 'copilot.exe'];
}

function runtimeBinaryName(platform: string): string {
	return platform === 'win32' ? 'copilot-runtime.exe' : 'copilot-runtime';
}

/**
 * Absolute paths where the Copilot CLI may live for this host.
 * The native package binary comes first. `prebuilds/.../copilot-runtime`
 * covers newer CLI layouts.
 */
export function copilotCliCandidates(
	extensionRoot: string,
	platform: string = process.platform,
	arch: string = process.arch,
): string[] {
	const roots = moduleRoots(extensionRoot);
	const candidates: string[] = [];
	for (const root of roots) {
		for (const id of copilotPlatformIds(platform, arch)) {
			const packageDir = join(root, '@github', `copilot-${id}`);
			for (const name of binaryNames(platform)) {
				candidates.push(join(packageDir, name));
			}
			candidates.push(join(packageDir, 'prebuilds', id, runtimeBinaryName(platform)));
		}
	}
	return candidates;
}

function moduleRoots(extensionRoot: string): string[] {
	const roots = [
		join(extensionRoot, 'node_modules'),
		join(extensionRoot, 'node_modules', '@github', 'copilot', 'node_modules'),
	];
	try {
		const require = createRequire(join(extensionRoot, 'package.json'));
		for (const base of require.resolve.paths('@github/copilot') ?? []) {
			if (!roots.includes(base)) {
				roots.push(base);
			}
		}
	} catch {
		// A missing package.json still leaves the extension-local roots.
	}
	return roots;
}

function pathCandidates(platform: string): string[] {
	const pathEnv = process.env.PATH ?? process.env.Path ?? '';
	const names = platform === 'win32' ? ['copilot.exe'] : ['copilot'];
	const candidates: string[] = [];
	for (const dir of pathEnv.split(delimiter)) {
		if (!dir) {
			continue;
		}
		for (const name of names) {
			candidates.push(join(dir, name));
		}
	}
	return candidates;
}

function ensureExecutable(filePath: string): void {
	if (process.platform === 'win32') {
		return;
	}
	try {
		chmodSync(filePath, 0o755);
	} catch {
		// Read-only install directories still spawn when the mode is already executable.
	}
}

/**
 * Locates the native Copilot CLI for this host: the packaged platform
 * binary first, then `copilot` / `copilot.exe` on PATH.
 */
export function resolveCopilotCliBinary(
	extensionPath: string,
	platform: string = process.platform,
	arch: string = process.arch,
): string {
	const candidates = [
		...copilotCliCandidates(extensionPath, platform, arch),
		...pathCandidates(platform),
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			ensureExecutable(candidate);
			return candidate;
		}
	}

	const ids = copilotPlatformIds(platform, arch);
	const expected = ids.length > 0
		? ids.map((id) => `@github/copilot-${id}`).join(' or ')
		: `${platform}/${arch}`;
	throw new Error(
		`Copilot CLI binary not found for ${platform}/${arch}. Expected ${expected} under the extension's node_modules, or copilot on PATH.`,
	);
}

/**
 * Child environment for the CLI. Drops Electron host variables that make a
 * Windows (and Linux) Copilot binary exit immediately when spawned from the
 * extension host, and drops non-string values that make `spawn` throw EINVAL
 * on Windows.
 */
export function copilotChildEnv(
	source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
	const blocked = new Set<string>(ELECTRON_ENV_KEYS);
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(source)) {
		if (typeof value === 'string' && !blocked.has(key)) {
			env[key] = value;
		}
	}
	return env;
}

/**
 * Ensures a writable Copilot home directory (session state, cache, etc.).
 */
export function ensureCopilotHome(copilotHome: string): string {
	mkdirSync(copilotHome, { recursive: true });
	return copilotHome;
}

export interface CopilotRuntimeOptions {
	gitHubToken: string;
	copilotHome: string;
	extensionPath: string;
}

/**
 * Creates a Copilot SDK client configured for the VS Code extension host.
 */
export async function createCopilotClient(options: CopilotRuntimeOptions) {
	const { CopilotClient, RuntimeConnection } = await import('@github/copilot-sdk');
	const cliPath = resolveCopilotCliBinary(options.extensionPath);
	const copilotHome = ensureCopilotHome(options.copilotHome);

	return new CopilotClient({
		connection: RuntimeConnection.forStdio({
			path: cliPath,
			env: copilotChildEnv(),
		}),
		gitHubToken: options.gitHubToken,
		useLoggedInUser: false,
		baseDirectory: copilotHome,
	});
}
