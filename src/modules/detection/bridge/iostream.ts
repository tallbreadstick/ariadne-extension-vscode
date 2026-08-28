import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { AriadneMessage } from './messages';
import type { VulnerabilityMetadata } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
import { resolveAriadneExecutable } from '../../core/ariadneExecutable';

export type FindingsCallback = (findings: VulnerabilityMetadata[]) => void;

export interface AriadneSession {
	send(msg: AriadneMessage): void;
	kill(): void;
	/** Kill the engine and spawn a fresh session process. */
	restart(): void;
	/** Subscribe to findings emitted after each analysis. */
	onFindings(cb: FindingsCallback): void;
	/** Fired after `restart()` once the new process is spawned. */
	onRestarted(cb: () => void): void;
}

export function runSession(): AriadneSession {
	let proc: ChildProcessWithoutNullStreams | null = null;
	let stdoutBuffer = '';
	const findingsCallbacks: FindingsCallback[] = [];
	const restartedCallbacks: Array<() => void> = [];

	const attach = (child: ChildProcessWithoutNullStreams): void => {
		stdoutBuffer = '';

		child.stdout.on('data', (chunk: Buffer) => {
			stdoutBuffer += chunk.toString();

			let nlPos: number;
			while ((nlPos = stdoutBuffer.indexOf('\n')) !== -1) {
				const line = stdoutBuffer.slice(0, nlPos).trim();
				stdoutBuffer = stdoutBuffer.slice(nlPos + 1);

				if (!line) { continue; }

				try {
					const parsed: unknown = JSON.parse(line);
					if (Array.isArray(parsed)) {
						const findings = parsed as VulnerabilityMetadata[];
						for (const cb of findingsCallbacks) {
							cb(findings);
						}
					}
				} catch {
					console.warn('[Ariadne] Unexpected engine stdout:', line);
				}
			}
		});

		child.stderr.on('data', (data: Buffer) => {
			console.error(`[Ariadne Core] ${data.toString().trimEnd()}`);
		});

		child.on('close', (code: number | null) => {
			console.log(`[Ariadne Core] process exited with code ${code}`);
		});
	};

	const spawnSession = (): ChildProcessWithoutNullStreams => {
		const child = spawn(resolveAriadneExecutable(), ['session'], {
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		attach(child);
		return child;
	};

	proc = spawnSession();

	return {
		send(msg: AriadneMessage): void {
			if (!proc) {
				return;
			}
			const line = JSON.stringify(msg) + '\n';
			proc.stdin.write(line);
		},
		kill(): void {
			proc?.kill();
			proc = null;
		},
		restart(): void {
			proc?.kill();
			proc = spawnSession();
			console.log('[Ariadne TS] engine session restarted');
			for (const cb of restartedCallbacks) {
				cb();
			}
		},
		onFindings(cb: FindingsCallback): void {
			findingsCallbacks.push(cb);
		},
		onRestarted(cb: () => void): void {
			restartedCallbacks.push(cb);
		},
	};
}
