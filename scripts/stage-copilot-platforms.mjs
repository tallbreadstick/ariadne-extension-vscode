/**
 * npm skips optional @github/copilot-* packages that don't match the
 * machine building the VSIX. Ask Ariadne needs the native CLI for every
 * host we ship, so fetch the missing ones before packaging.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const platforms = ['linux-x64', 'win32-x64', 'win32-arm64'];

function binaryName(platform) {
	return platform.startsWith('win32') ? 'copilot.exe' : 'copilot';
}

function packageVersion() {
	const manifest = JSON.parse(readFileSync(
		join(root, 'node_modules', '@github', 'copilot', 'package.json'),
		'utf8',
	));
	return manifest.version;
}

async function download(url, destination) {
	const response = await fetch(url);
	if (!response.ok || !response.body) {
		throw new Error(`GET ${url} failed (${response.status})`);
	}
	await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

async function stage(platform, version) {
	const name = `copilot-${platform}`;
	const destination = join(root, 'node_modules', '@github', name);
	const binary = join(destination, binaryName(platform));
	if (existsSync(binary)) {
		console.log(`[stage-copilot] ${name} already present`);
		return;
	}

	const url = `https://registry.npmjs.org/@github/${name}/-/${name}-${version}.tgz`;
	const temp = join(tmpdir(), `${name}-${version}`);
	rmSync(temp, { recursive: true, force: true });
	mkdirSync(temp, { recursive: true });
	const tarball = join(temp, 'package.tgz');
	console.log(`[stage-copilot] downloading ${url}`);
	await download(url, tarball);
	execFileSync('tar', ['-xzf', tarball, '-C', temp]);
	rmSync(destination, { recursive: true, force: true });
	mkdirSync(dirname(destination), { recursive: true });
	cpSync(join(temp, 'package'), destination, { recursive: true });
	rmSync(temp, { recursive: true, force: true });
	if (!existsSync(binary)) {
		throw new Error(`${name} extracted without ${binaryName(platform)}`);
	}
	console.log(`[stage-copilot] installed ${binary}`);
}

const version = packageVersion();
for (const platform of platforms) {
	await stage(platform, version);
}
