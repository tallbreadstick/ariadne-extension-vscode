import { spawn } from 'node:child_process';
import { ensureAriadneExecutable } from './ariadneExecutable.js';
import { logAriadneError } from './debugLog.js';
import {
	INIT_RULE_SCRIPT_ARGS,
	RESET_RULE_SCRIPT_ARGS,
} from '../rules/ruleScriptCommands.js';

/**
 * Runs the `ariadne` CLI in a workspace and resolves with combined output
 * when the process exits 0.
 */
export async function runAriadneCli(
	args: readonly string[],
	cwd: string,
): Promise<string> {
	const exe = await ensureAriadneExecutable();
	return new Promise((resolve, reject) => {
		const proc = spawn(exe, [...args], { cwd });
		let stdout = '';
		let stderr = '';
		proc.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		proc.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		proc.on('error', (err) => {
			const error = new Error(`Could not run \`${exe}\`: ${err.message}.`);
			logAriadneError('scanner-spawn', error);
			reject(error);
		});
		proc.on('close', (code) => {
			const output = (stdout || stderr).trim();
			if (code === 0) {
				resolve(output);
				return;
			}
			const error = new Error(output || `\`${exe} ${args.join(' ')}\` failed (exit ${code})`);
			logAriadneError('scanner-spawn', error, `exit=${code ?? 'null'}`);
			reject(error);
		});
	});
}

export function initRuleScripts(cwd: string): Promise<string> {
	return runAriadneCli(INIT_RULE_SCRIPT_ARGS, cwd);
}

export function resetRuleScripts(cwd: string): Promise<string> {
	return runAriadneCli(RESET_RULE_SCRIPT_ARGS, cwd);
}
