import { execFile } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { logAriadneError } from '../../core/debugLog.js';
import {
	hostCopilotPlatformIds,
	normalizeCopilotPreferences,
	npmPackageName,
	selectedCopilotPlatform,
	type CopilotPlatformId,
	type CopilotPreferences,
} from './copilotRelease.js';

const execFileAsync = promisify(execFile);
const NPM_REGISTRY = 'https://registry.npmjs.org';
const ALLOWED_REGISTRY_HOSTS = ['https://registry.npmjs.org/', 'https://registry.npmmirror.com/'];

let cacheDir: string | undefined;
let extensionPath: string | undefined;
let readPrefs: () => CopilotPreferences = () => normalizeCopilotPreferences({
	auto: true,
	os: undefined,
	platform: undefined,
	version: undefined,
	platformHost: process.platform,
	archHost: process.arch,
	defaultVersion: '0.0.0',
});

export class CopilotDownloadCancelled extends Error {
	constructor() {
		super('Copilot download cancelled.');
		this.name = 'CopilotDownloadCancelled';
	}
}

export function configureCopilotExecutable(
	storageDir: string,
	extensionRoot: string,
	readPreferences: () => CopilotPreferences,
): void {
	cacheDir = join(storageDir, 'copilot-cli');
	extensionPath = extensionRoot;
	readPrefs = readPreferences;
}

export function readCopilotPreferencesFromConfig(): CopilotPreferences {
	return readPrefs();
}

/** Version pinned in the extension's `@github/copilot` package. */
export function bundledCopilotCliVersion(root: string): string {
	try {
		const manifest = JSON.parse(
			readFileSync(join(root, 'node_modules', '@github', 'copilot', 'package.json'), 'utf8'),
		) as { version?: string };
		return manifest.version?.trim() || '0.0.0';
	} catch {
		return '0.0.0';
	}
}

export function bundledCopilotCliVersions(root: string): string[] {
	try {
		const manifest = JSON.parse(
			readFileSync(join(root, 'node_modules', '@github', 'copilot', 'package.json'), 'utf8'),
		) as { version?: string; optionalDependencies?: Record<string, string> };
		const versions = new Set<string>();
		if (manifest.version) {
			versions.add(manifest.version.trim());
		}
		for (const value of Object.values(manifest.optionalDependencies ?? {})) {
			if (typeof value === 'string' && value.trim()) {
				versions.add(value.trim());
			}
		}
		return [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
	} catch {
		return ['0.0.0'];
	}
}

function binaryFileName(platformId: CopilotPlatformId): string {
	return platformId.startsWith('win32') ? 'copilot.exe' : 'copilot';
}

function installDir(platformId: CopilotPlatformId, version: string): string {
	return join(cacheDir!, `${platformId}-${version}`);
}

/** Cached CLI paths for this host (all compatible platform ids). */
export function cachedCopilotCliCandidates(platform: string, arch: string): string[] {
	const prefs = readPrefs();
	const ids = new Set<CopilotPlatformId>([
		...hostCopilotPlatformIds(platform, arch),
		...(prefs.auto ? [] : [prefs.platform]),
	]);
	const paths: string[] = [];
	for (const id of ids) {
		const path = cachedCopilotCliPath(id, prefs.version);
		if (path) {
			paths.push(path);
		}
	}
	return paths;
}

export function cachedCopilotCliPath(
	platformId: CopilotPlatformId,
	version: string,
): string | undefined {
	if (!cacheDir) {
		return undefined;
	}
	const binary = join(installDir(platformId, version), binaryFileName(platformId));
	return existsSync(binary) ? binary : undefined;
}

export async function listDownloadedCopilotPlatforms(): Promise<
	Array<{ platform: CopilotPlatformId; version: string }>
> {
	if (!cacheDir || !existsSync(cacheDir)) {
		return [];
	}
	const entries = await readdir(cacheDir);
	const found: Array<{ platform: CopilotPlatformId; version: string }> = [];
	for (const name of entries) {
		const match = /^(linuxmusl-x64|linuxmusl-arm64|linux-x64|linux-arm64|win32-x64|win32-arm64|darwin-x64|darwin-arm64)-(\d+\.\d+\.\d+)$/.exec(name);
		if (!match) {
			continue;
		}
		const platform = match[1] as CopilotPlatformId;
		const version = match[2]!;
		if (cachedCopilotCliPath(platform, version)) {
			found.push({ platform, version });
		}
	}
	return found;
}

function selectionKey(): string {
	const prefs = readPrefs();
	return `${prefs.auto}\n${prefs.os}\n${prefs.platform}\n${prefs.version}`;
}

let inflightKey: string | undefined;
let inflight: Promise<string> | undefined;

/**
 * Resolves a Copilot CLI path, downloading when Auto is on or when a manual
 * build is missing (after the user clicks Download).
 */
export function ensureCopilotExecutable(): Promise<string> {
	const key = selectionKey();
	if (!inflight || inflightKey !== key) {
		inflightKey = key;
		inflight = resolveExecutable().finally(() => {
			if (inflightKey === key) {
				inflight = undefined;
				inflightKey = undefined;
			}
		});
	}
	return inflight;
}

async function resolveExecutable(): Promise<string> {
	if (!cacheDir || !extensionPath) {
		throw new Error('Copilot CLI cache is not configured.');
	}
	const prefs = readPrefs();
	const platformId = selectedCopilotPlatform(prefs, process.platform, process.arch);
	const version = prefs.version;
	const cached = cachedCopilotCliPath(platformId, version);
	if (!prefs.auto && !cached) {
		throw new Error('Download the selected Copilot CLI build from the Copilot section.');
	}
	if (cached) {
		await markExecutable(cached);
		return cached;
	}
	try {
		const outcome = await downloadCopilotPlatform(platformId, version);
		if (outcome === 'cancelled') {
			if (cached) {
				return cached;
			}
			throw new CopilotDownloadCancelled();
		}
		if (outcome === 'failed') {
			if (cached) {
				console.warn('[Ariadne] Copilot download failed; using cached CLI.');
				return cached;
			}
			throw new Error('Ariadne: Copilot download failed.');
		}
	} catch (error: unknown) {
		if (cached && !(error instanceof CopilotDownloadCancelled)) {
			console.warn('[Ariadne] Copilot download error; using cached CLI.', error);
			return cached;
		}
		throw error;
	}
	const ready = cachedCopilotCliPath(platformId, version);
	if (!ready) {
		throw new Error('Copilot download finished without a CLI binary.');
	}
	return ready;
}

export async function downloadCopilotPlatform(
	platformId: CopilotPlatformId,
	version: string,
): Promise<'finished' | 'cancelled' | 'failed'> {
	if (!cacheDir) {
		throw new Error('Copilot CLI cache is not configured.');
	}
	const existing = cachedCopilotCliPath(platformId, version);
	if (existing) {
		await markExecutable(existing);
		return 'finished';
	}
	try {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Ariadne: downloading Copilot CLI (${platformId}, ${version})`,
				cancellable: true,
			},
			(progress, token) => fetchAndExtract(platformId, version, progress, token),
		);
		void vscode.window.showInformationMessage('Ariadne: Copilot CLI download finished.');
		return 'finished';
	} catch (error: unknown) {
		if (error instanceof CopilotDownloadCancelled) {
			void vscode.window.showInformationMessage('Ariadne: Copilot download cancelled.');
			return 'cancelled';
		}
		console.error('[Ariadne] Copilot download failed:', error);
		logAriadneError('copilot-download', error);
		void vscode.window.showErrorMessage('Ariadne: Copilot download failed.');
		return 'failed';
	}
}

export async function deleteDownloadedCopilot(
	platformId: CopilotPlatformId,
	version: string,
): Promise<void> {
	if (!cacheDir) {
		return;
	}
	await rm(installDir(platformId, version), { recursive: true, force: true });
}

async function fetchAndExtract(
	platformId: CopilotPlatformId,
	version: string,
	progress: vscode.Progress<{ message?: string; increment?: number }>,
	token: vscode.CancellationToken,
): Promise<void> {
	if (token.isCancellationRequested) {
		throw new CopilotDownloadCancelled();
	}
	const pkg = npmPackageName(platformId);
	const url = `${NPM_REGISTRY}/@github/${pkg}/-/${pkg}-${version}.tgz`;
	assertRegistryUrl(url);
	const destination = installDir(platformId, version);
	const tempTar = `${destination}.tgz`;
	const tempExtract = `${destination}.partial`;
	await mkdir(cacheDir!, { recursive: true });
	await rm(tempExtract, { recursive: true, force: true });
	await rm(tempTar, { force: true }).catch(() => undefined);

	const controller = new AbortController();
	token.onCancellationRequested(() => controller.abort());

	progress.report({ message: 'Fetching…' });
	let response: Response;
	try {
		response = await fetch(url, {
			headers: { 'User-Agent': 'ariadne-extension-vscode' },
			signal: controller.signal,
		});
	} catch (error: unknown) {
		if (controller.signal.aborted) {
			throw new CopilotDownloadCancelled();
		}
		throw error;
	}
	if (!response.ok || !response.body) {
		throw new Error(`Could not download @github/${pkg} (HTTP ${response.status}).`);
	}

	const total = Number(response.headers.get('content-length') || 0);
	const reader = response.body.getReader();
	const file = createWriteStream(tempTar);
	let received = 0;
	let reported = 0;
	try {
		while (true) {
			if (token.isCancellationRequested) {
				throw new CopilotDownloadCancelled();
			}
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (!value) {
				continue;
			}
			await writeChunk(file, value);
			received += value.byteLength;
			if (total > 0) {
				const pct = Math.min(99, Math.floor((received / total) * 100));
				progress.report({ message: `${pct}%`, increment: pct - reported });
				reported = pct;
			} else {
				progress.report({ message: `${Math.max(1, Math.floor(received / (1024 * 1024)))} MB` });
			}
		}
		await endFile(file);
	} catch (error: unknown) {
		file.destroy();
		await rm(tempTar, { force: true }).catch(() => undefined);
		if (error instanceof CopilotDownloadCancelled) {
			throw error;
		}
		throw error;
	}

	progress.report({ message: 'Extracting…', increment: Math.max(0, 100 - reported) });
	await mkdir(tempExtract, { recursive: true });
	await execFileAsync('tar', ['-xzf', tempTar, '-C', tempExtract]);
	await rm(tempTar, { force: true });

	const binaryName = binaryFileName(platformId);
	const extractedBinary = join(tempExtract, 'package', binaryName);
	if (!existsSync(extractedBinary)) {
		throw new Error(`@github/${pkg} archive did not contain ${binaryName}.`);
	}
	await rm(destination, { recursive: true, force: true });
	await rename(join(tempExtract, 'package'), destination);
	await rm(tempExtract, { recursive: true, force: true });
	await markExecutable(join(destination, binaryName));
}

function assertRegistryUrl(url: string): void {
	if (!ALLOWED_REGISTRY_HOSTS.some((host) => url.startsWith(host))) {
		throw new Error('Refusing to download Copilot from an unexpected registry URL.');
	}
}

function writeChunk(file: ReturnType<typeof createWriteStream>, chunk: Uint8Array): Promise<void> {
	return new Promise((resolve, reject) => {
		file.write(chunk, (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

function endFile(file: ReturnType<typeof createWriteStream>): Promise<void> {
	return new Promise((resolve, reject) => {
		file.end((error?: Error | null) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

async function markExecutable(filePath: string): Promise<void> {
	if (process.platform === 'win32') {
		return;
	}
	try {
		await chmod(filePath, 0o755);
	} catch {
		// ignore
	}
}

/** Best-effort CLI smoke check (runs `copilot --version`). */
export async function probeCopilotExecutable(cliPath: string): Promise<boolean> {
	if (!existsSync(cliPath)) {
		return false;
	}
	try {
		const st = await stat(cliPath);
		if (!st.isFile()) {
			return false;
		}
	} catch {
		return false;
	}
	try {
		await execFileAsync(cliPath, ['--version'], { timeout: 8_000 });
		return true;
	} catch {
		return false;
	}
}
