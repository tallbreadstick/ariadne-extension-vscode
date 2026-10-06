import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
	const asset = selectReleaseAsset(await fetchLatestAssets(), target);
	if (!asset) {
		throw new Error(
			`The latest Ariadne release has no binary for ${target}. Check https://github.com/tallbreadstick/ariadne-binaries/releases`,
		);
	}
	assertDownloadUrl(asset.browser_download_url);

	const destination = join(cacheDir, asset.name);
	if (existsSync(destination)) {
		await markExecutable(destination);
		console.log(`[Ariadne] Scanner setting "${configured}" -> ${destination}`);
		return destination;
	}

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Ariadne: downloading ${asset.name}`,
		},
		() => downloadAsset(asset, destination),
	);
	console.log(`[Ariadne] Scanner setting "${configured}" -> ${destination}`);
	return destination;
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

async function downloadAsset(asset: ReleaseAsset, destination: string): Promise<void> {
	const response = await fetch(asset.browser_download_url, {
		headers: { 'User-Agent': 'ariadne-extension-vscode' },
		redirect: 'follow',
	});
	if (!response.ok || !response.body) {
		throw new Error(`Could not download ${asset.name} (HTTP ${response.status}).`);
	}
	await mkdir(cacheDir!, { recursive: true });
	const partial = `${destination}.partial`;
	await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
	await rename(partial, destination);
	await markExecutable(destination);
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

export async function deleteAllDownloadedScanners(): Promise<void> {
	if (!cacheDir) {
		return;
	}
	const names = await cacheFileNames();
	await Promise.all(names.map((name) => unlink(join(cacheDir!, name))));
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
