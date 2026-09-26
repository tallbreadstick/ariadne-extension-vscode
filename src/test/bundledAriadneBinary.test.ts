import * as assert from 'assert';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import {
	bundledAriadneAbsolutePath,
	bundledAriadneRelativePath,
} from '../modules/core/bundledAriadneBinary.js';

describe('bundled scanner binary selection', () => {
	it('selects the Linux x64 binary', () => {
		assert.strictEqual(
			bundledAriadneRelativePath('linux', 'x64'),
			posix.join('bin', 'linux-x64', 'ariadne'),
		);
	});

	it('selects the Windows x64 binary', () => {
		assert.strictEqual(
			bundledAriadneRelativePath('win32', 'x64'),
			posix.join('bin', 'win32-x64', 'ariadne.exe'),
		);
	});

	it('selects the Windows ARM64 binary', () => {
		assert.strictEqual(
			bundledAriadneRelativePath('win32', 'arm64'),
			posix.join('bin', 'win32-arm64', 'ariadne.exe'),
		);
	});

	it('has no bundled binary for macOS', () => {
		assert.strictEqual(bundledAriadneRelativePath('darwin', 'x64'), undefined);
	});

	it('has no bundled binary for Linux arm64', () => {
		assert.strictEqual(bundledAriadneRelativePath('linux', 'arm64'), undefined);
	});

	it('joins the selected binary to the extension root', () => {
		const root = '/ext/ariadne';
		assert.strictEqual(
			bundledAriadneAbsolutePath(root, 'linux', 'x64'),
			join(root, 'bin', 'linux-x64', 'ariadne'),
		);
		assert.strictEqual(
			bundledAriadneAbsolutePath(root, 'darwin', 'x64'),
			undefined,
		);
	});

	it('ships Linux x64 and Windows x64 and ARM64 binaries in bin/', () => {
		const binRoot = join(__dirname, '..', '..', 'bin');
		assert.ok(existsSync(join(binRoot, 'linux-x64', 'ariadne')));
		assert.ok(existsSync(join(binRoot, 'win32-x64', 'ariadne.exe')));
		assert.ok(existsSync(join(binRoot, 'win32-arm64', 'ariadne.exe')));
	});
});
