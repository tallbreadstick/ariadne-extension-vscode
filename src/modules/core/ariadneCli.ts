import { spawn } from 'node:child_process';
import { resolveAriadneExecutable } from './ariadneExecutable.js';
import {
	INIT_RULE_SCRIPT_ARGS,
	RESET_RULE_SCRIPT_ARGS,
} from '../rules/ruleScriptCommands.js';

/**
 * Runs the `ariadne` CLI in a workspace and resolves with combined output
 * when the process exits 0.
 */
export function runAriadneCli(
	args: readonly string[],
	cwd: string,
): Promise<string> {
	const exe = resolveAriadneExecutable();
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
			reject(new Error(
				`Could not run \`${exe}\`: ${err.message}. Set ariadne.executable.`,
			));
		});
		proc.on('close', (code) => {
			const output = (stdout || stderr).trim();
			if (code === 0) {
				resolve(output);
				return;
			}
			reject(new Error(
				output || `\`${exe} ${args.join(' ')}\` failed (exit ${code})`,
			));
		});
	});
}

export function initRuleScripts(cwd: string): Promise<string> {
	return runAriadneCli(INIT_RULE_SCRIPT_ARGS, cwd);
}

export function resetRuleScripts(cwd: string): Promise<string> {
	return runAriadneCli(RESET_RULE_SCRIPT_ARGS, cwd);
}
