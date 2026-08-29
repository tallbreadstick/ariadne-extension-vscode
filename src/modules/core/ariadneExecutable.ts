import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';

const DEFAULT_NAME = 'ariadne';

/**
 * Resolve the `ariadne` binary: configured path, a cargo build in the
 * open workspace, then PATH.
 */
export function resolveAriadneExecutable(): string {
	const configured = vscode.workspace
		.getConfiguration('ariadne')
		.get<string>('executable', DEFAULT_NAME)
		.trim() || DEFAULT_NAME;

	if (configured !== DEFAULT_NAME && existsSync(configured)) {
		return configured;
	}

	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		for (const candidate of [
			join(folder.uri.fsPath, 'target', 'debug', 'ariadne'),
			join(folder.uri.fsPath, 'target', 'release', 'ariadne'),
		]) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
	}

	if (existsSync(configured)) {
		return configured;
	}

	return configured;
}
