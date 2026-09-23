import { chmodSync, existsSync } from 'node:fs';
import * as vscode from 'vscode';
import { bundledAriadneAbsolutePath } from './bundledAriadneBinary.js';

const DEFAULT_NAME = 'ariadne';

let extensionRoot: string | undefined;

/**
 * Records the extension install path so later spawns can find the
 * packaged scanner binary. Call once from `activate`.
 */
export function configureAriadneExecutable(extensionPath: string): void {
	extensionRoot = extensionPath;
	const bundled = bundledAriadneAbsolutePath(extensionPath);
	if (bundled && existsSync(bundled)) {
		ensureExecutable(bundled);
		console.log(`[Ariadne] Using bundled scanner: ${bundled}`);
		return;
	}
	console.warn(
		bundled
			? `[Ariadne] Bundled scanner missing at ${bundled}`
			: `[Ariadne] No bundled scanner for ${process.platform}/${process.arch}`,
	);
}

/**
 * Resolve the `ariadne` binary: an explicit `ariadne.executable` path
 * if it exists, otherwise the packaged binary for this OS.
 */
export function resolveAriadneExecutable(): string {
	const configured = vscode.workspace
		.getConfiguration('ariadne')
		.get<string>('executable', DEFAULT_NAME)
		.trim() || DEFAULT_NAME;

	if (configured !== DEFAULT_NAME && existsSync(configured)) {
		return configured;
	}
	if (configured !== DEFAULT_NAME) {
		console.warn(`[Ariadne] ariadne.executable not found at ${configured}; using bundled scanner.`);
	}

	if (extensionRoot) {
		const bundled = bundledAriadneAbsolutePath(extensionRoot);
		if (bundled && existsSync(bundled)) {
			ensureExecutable(bundled);
			return bundled;
		}
	}

	return configured;
}

function ensureExecutable(filePath: string): void {
	if (process.platform === 'win32') {
		return;
	}
	try {
		chmodSync(filePath, 0o755);
	} catch {
		// Install directories may be read-only; spawn will surface EACCES.
	}
}
