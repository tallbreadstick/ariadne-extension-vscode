/**
 * npm skips optional @github/copilot-* and @koromix/koffi-* packages that do
 * not match the machine building the VSIX. Ask Ariadne ships native runtimes
 * for the platforms listed in .vscodeignore, so fetch any missing slices here
 * before packaging.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Must stay aligned with .vscodeignore Copilot allowlist. */
const COPILOT_PLATFORMS = [
	'linux-x64',
	'win32-x64',
	'win32-arm64',
	'darwin-arm64',
	'darwin-x64',
];

/** Must stay aligned with .vscodeignore @koromix/koffi allowlist. */
const KOFFI_PLATFORMS = [
	'linux-x64',
	'win32-x64',
	'win32-arm64',
	'darwin-arm64',
	'darwin-x64',
];

function binaryName(platform) {
	return platform.startsWith('win32') ? 'copilot.exe' : 'copilot';
}

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function copilotVersion() {
	return readJson(join(root, 'node_modules', '@github', 'copilot', 'package.json')).version;
}

function koffiVersion() {
	return readJson(join(root, 'node_modules', 'koffi', 'package.json')).version;
}

async function download(url, destination) {
	const response = await fetch(url);
	if (!response.ok || !response.body) {
		throw new Error(`GET ${url} failed (${response.status})`);
	}
	await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

async function extractNpmTarball(scope, packageName, version, destination) {
	const scoped = scope ? `${scope}/` : '';
	const url = `https://registry.npmjs.org/${scoped}${packageName}/-/${packageName}-${version}.tgz`;
	const temp = join(tmpdir(), `${packageName}-${version}-${process.pid}`);
	rmSync(temp, { recursive: true, force: true });
	mkdirSync(temp, { recursive: true });
	const tarball = join(temp, 'package.tgz');
	console.log(`[stage-native] downloading ${url}`);
	await download(url, tarball);
	execFileSync('tar', ['-xzf', tarball, '-C', temp]);
	rmSync(destination, { recursive: true, force: true });
	mkdirSync(dirname(destination), { recursive: true });
	cpSync(join(temp, 'package'), destination, { recursive: true });
	rmSync(temp, { recursive: true, force: true });
}

async function stageCopilot(platform, version) {
	const name = `copilot-${platform}`;
	const destination = join(root, 'node_modules', '@github', name);
	const binary = join(destination, binaryName(platform));
	if (existsSync(binary)) {
		console.log(`[stage-native] ${name} already present`);
		return;
	}
	await extractNpmTarball('@github', name, version, destination);
	if (!existsSync(binary)) {
		throw new Error(`${name} extracted without ${binaryName(platform)}`);
	}
	console.log(`[stage-native] installed ${binary}`);
}

async function stageKoffi(platform, version) {
	const name = `koffi-${platform}`;
	const destination = join(root, 'node_modules', '@koromix', name);
	const marker = join(destination, 'index.js');
	if (existsSync(marker)) {
		console.log(`[stage-native] @koromix/${name} already present`);
		return;
	}
	await extractNpmTarball('@koromix', name, version, destination);
	if (!existsSync(marker)) {
		throw new Error(`@koromix/${name} extracted without index.js`);
	}
	console.log(`[stage-native] installed @koromix/${name}`);
}

const copilotVer = copilotVersion();
for (const platform of COPILOT_PLATFORMS) {
	await stageCopilot(platform, copilotVer);
}

const koffiVer = koffiVersion();
for (const platform of KOFFI_PLATFORMS) {
	await stageKoffi(platform, koffiVer);
}
