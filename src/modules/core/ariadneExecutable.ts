import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import * as vscode from 'vscode';
import {
	LATEST_RELEASE_URL,
	normalizeScannerPreferences,
	parseLatestRelease,
	SCANNER_AUTO,
	selectReleaseAsset,
	selectedScannerTarget,
	targetFromAssetName,
	type ReleaseAsset,
	type ScannerPreferences,
	type ScannerTarget,
} from './scannerRelease.js';

const DEFAULT_EXECUTABLE = 'ariadne';
const RELEASE_HOSTS = [
	'https://github.com/tallbreadstick/ariadne-binaries/',
	'https://release-assets.github.com/',
	'https://objects.githubusercontent.com/',
];

let cacheDir: string | undefined;
let inflightKey: string | undefined;
let inflight: Promise<string> | undefined;
let readPrefs: () => ScannerPreferences = () => normalizeScannerPreferences({
	auto: undefined,
	os: undefined,
	target: undefined,
	legacy: undefined,
	platform: process.platform,
	arch: process.arch,
});

/** Call once from `activate` with global storage and the saved scanner choice. */
export function configureAriadneExecutable(
	storageDir: string,
	readPreferences: () => ScannerPreferences,
): void {
	cacheDir = join(storageDir, 'scanner');
	readPrefs = readPreferences;
}

/**
 * Returns a local scanner path. An existing `ariadne.executable` file wins.
 * Otherwise the binary named by `ariadne.scanner` is downloaded from the
 * latest ariadne-binaries release and cached under global storage.
 */
export function ensureAriadneExecutable(): Promise<string> {
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

function selectionKey(): string {
	const prefs = readPrefs();
	const executable = vscode.workspace.getConfiguration('ariadne').get<string>('executable', DEFAULT_EXECUTABLE) ?? DEFAULT_EXECUTABLE;
	return `${prefs.auto}\n${prefs.os}\n${prefs.target}\n${executable}`;
}

/** Saved Auto / OS / binary choice. Auto is on until the user turns it off. */
export function readScannerPreferencesFromConfig(): ScannerPreferences {
	return readPrefs();
}

async function resolveExecutable(): Promise<string> {
	const override = localExecutableOverride();
	if (override) {
		console.log(`[Ariadne] Scanner setting ignored; using ariadne.executable: ${override}`);
		return override;
	}
	if (!cacheDir) {
		throw new Error('Ariadne scanner cache is not configured.');
	}

	const prefs = readPrefs();
	const configured = prefs.auto ? SCANNER_AUTO : prefs.target;
	const target = selectedScannerTarget(configured, process.platform, process.arch);
	const cached = await cachedScannerPath(target);
	if (cached) {
		await markExecutable(cached);
		console.log(`[Ariadne] Scanner setting "${configured}" -> ${cached}`);
		return cached;
	}
	if (!prefs.auto) {
		throw new Error('Download the selected scanner binary from the Core section.');
	}
	const outcome = await downloadReleaseAsset(target);
	if (outcome === 'cancelled') {
		throw new DownloadCancelled();
	}
	if (outcome === 'failed') {
		throw new Error('Ariadne: download failed.');
	}
	const ready = await cachedScannerPath(target);
	if (!ready) {
		throw new Error('Download finished without a scanner file.');
	}
	console.log(`[Ariadne] Scanner setting "${configured}" -> ${ready}`);
	return ready;
}

/** Local path for a target that is already on disk. */
export async function cachedScannerPath(target: ScannerTarget): Promise<string | undefined> {
	if (!cacheDir) {
		return undefined;
	}
	const names = await cacheFileNames();
	const match = names.find((name) => targetFromAssetName(name) === target);
	return match ? join(cacheDir, match) : undefined;
}

export class DownloadCancelled extends Error {
	constructor() {
		super('Download cancelled.');
		this.name = 'DownloadCancelled';
	}
}

/**
 * Downloads one release binary. Auto is the only caller that starts this
 * without a Download click. The notification can be cancelled and reports
 * percent complete, then finished, failed, or cancelled.
 */
export async function downloadReleaseAsset(
	target: ScannerTarget,
): Promise<'finished' | 'cancelled' | 'failed'> {
	if (!cacheDir) {
		throw new Error('Ariadne scanner cache is not configured.');
	}
	const existing = await cachedScannerPath(target);
	if (existing) {
		await markExecutable(existing);
		return 'finished';
	}
	const asset = selectReleaseAsset(await fetchLatestAssets(), target);
	if (!asset) {
		throw new Error(
			`The latest Ariadne release has no binary for ${target}. Check https://github.com/tallbreadstick/ariadne-binaries/releases`,
		);
	}
	assertDownloadUrl(asset.browser_download_url);
	const destination = join(cacheDir, asset.name);
	try {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Ariadne: downloading ${asset.name}`,
				cancellable: true,
			},
			(progress, token) => downloadAsset(asset, destination, progress, token),
		);
		void vscode.window.showInformationMessage('Ariadne: download finished.');
		return 'finished';
	} catch (error: unknown) {
		if (error instanceof DownloadCancelled) {
			void vscode.window.showInformationMessage('Ariadne: download cancelled.');
			return 'cancelled';
		}
		console.error('[Ariadne] Scanner download failed:', error);
		void vscode.window.showErrorMessage('Ariadne: download failed.');
		return 'failed';
	}
}

export function localExecutableOverride(): string | undefined {
	const configured = vscode.workspace
		.getConfiguration('ariadne')
		.get<string>('executable', DEFAULT_EXECUTABLE)
		.trim() || DEFAULT_EXECUTABLE;
	if (configured === DEFAULT_EXECUTABLE) {
		return undefined;
	}
	if (existsSync(configured)) {
		return configured;
	}
	console.warn(`[Ariadne] ariadne.executable not found at ${configured}; downloading the selected scanner.`);
	return undefined;
}

async function fetchLatestAssets(): Promise<ReleaseAsset[]> {
	const response = await fetch(LATEST_RELEASE_URL, {
		headers: {
			Accept: 'application/vnd.github+json',
			'User-Agent': 'ariadne-extension-vscode',
		},
	});
	if (!response.ok) {
		throw new Error(`Could not read the latest Ariadne release (HTTP ${response.status}).`);
	}
	return parseLatestRelease(await response.json());
}

function assertDownloadUrl(url: string): void {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error('The Ariadne release asset URL is not valid.');
	}
	if (parsed.protocol !== 'https:' || !RELEASE_HOSTS.some((host) => url.startsWith(host))) {
		throw new Error('Refusing to download the Ariadne scanner from an unexpected host.');
	}
}

async function downloadAsset(
	asset: ReleaseAsset,
	destination: string,
	progress: vscode.Progress<{ message?: string; increment?: number }>,
	token: vscode.CancellationToken,
): Promise<void> {
	if (token.isCancellationRequested) {
		throw new DownloadCancelled();
	}
	const controller = new AbortController();
	token.onCancellationRequested(() => controller.abort());
	let response: Response;
	try {
		response = await fetch(asset.browser_download_url, {
			headers: { 'User-Agent': 'ariadne-extension-vscode' },
			redirect: 'follow',
			signal: controller.signal,
		});
	} catch (error: unknown) {
		if (controller.signal.aborted) {
			throw new DownloadCancelled();
		}
		throw error;
	}
	if (!response.ok || !response.body) {
		throw new Error(`Could not download ${asset.name} (HTTP ${response.status}).`);
	}
	await mkdir(cacheDir!, { recursive: true });
	const partial = `${destination}.partial`;
	const total = Number(response.headers.get('content-length') || 0);
	const reader = response.body.getReader();
	const file = createWriteStream(partial);
	let received = 0;
	let reported = 0;
	try {
		while (true) {
			if (token.isCancellationRequested) {
				throw new DownloadCancelled();
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
				progress.report({ message: `${Math.max(1, Math.floor(received / 1024))} KB` });
			}
		}
		await endFile(file);
		progress.report({ message: '100%', increment: Math.max(0, 100 - reported) });
	} catch (error: unknown) {
		file.destroy();
		await unlink(partial).catch(() => undefined);
		if (controller.signal.aborted || error instanceof DownloadCancelled) {
			throw new DownloadCancelled();
		}
		throw error;
	}
	await rename(partial, destination);
	await markExecutable(destination);
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

export async function listDownloadedScannerTargets(): Promise<ScannerTarget[]> {
	if (!cacheDir || !existsSync(cacheDir)) {
		return [];
	}
	const names = await readdir(cacheDir);
	const found = new Set<ScannerTarget>();
	for (const name of names) {
		const target = targetFromAssetName(name);
		if (target) {
			found.add(target);
		}
	}
	return [...found];
}

async function cacheFileNames(): Promise<string[]> {
	if (!cacheDir || !existsSync(cacheDir)) {
		return [];
	}
	return readdir(cacheDir);
}

export async function deleteDownloadedScanner(target: ScannerTarget): Promise<void> {
	if (!cacheDir) {
		return;
	}
	const names = await cacheFileNames();
	await Promise.all(names.filter((name) => {
		return targetFromAssetName(name) === target || name.startsWith(`${target}-`);
	}).map((name) => unlink(join(cacheDir!, name))));
}

/**
 * Spawns `session` and treats an immediate exit as a broken binary.
 * ponytail: 800ms is the crash window; a later exit is reported by the live session.
 */
export function probeAriadneExecutable(exe: string): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn(exe, ['session'], { stdio: 'ignore' });
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (ok: boolean): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			if (child.exitCode === null) {
				child.kill();
			}
			resolve(ok);
		};
		timer = setTimeout(() => finish(true), 800);
		child.once('error', () => finish(false));
		child.once('exit', () => finish(false));
	});
}

async function markExecutable(filePath: string): Promise<void> {
	if (process.platform === 'win32') {
		return;
	}
	try {
		await chmod(filePath, 0o755);
	} catch {
		// A read-only cache still works when the file is already executable.
	}
}
