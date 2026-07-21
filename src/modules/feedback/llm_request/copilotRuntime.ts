/**
 * Resolves and configures the GitHub Copilot SDK runtime for the extension host.
 *
 * VS Code's extension host runs under Electron. The SDK's default bundled CLI
 * path (`index.js`) is launched with `process.execPath`, which breaks CLI
 * argument parsing. We therefore point stdio transport at the native
 * `copilot` binary shipped in `@github/copilot-<platform>-<arch>`.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function getPlatformPackageNames(): string[] {
	const arch = process.arch;
	const variants =
		process.platform === 'linux' ? ['linux', 'linuxmusl'] : [process.platform];
	return variants.map((variant) => `copilot-${variant}-${arch}`);
}

/**
 * Locates the native Copilot CLI binary installed alongside @github/copilot.
 */
export function resolveCopilotCliBinary(extensionPath: string): string {
	const require = createRequire(join(extensionPath, 'package.json'));
	const searchPaths = require.resolve.paths('@github/copilot') ?? [];

	for (const base of searchPaths) {
		for (const packageName of getPlatformPackageNames()) {
			const candidate = join(base, '@github', packageName, 'copilot');
			if (existsSync(candidate)) {
				return candidate;
			}
		}
	}

	throw new Error(
		'Copilot CLI binary not found. Reinstall extension dependencies with npm install.',
	);
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
		connection: RuntimeConnection.forStdio({ path: cliPath }),
		gitHubToken: options.gitHubToken,
		useLoggedInUser: false,
		baseDirectory: copilotHome,
	});
}
