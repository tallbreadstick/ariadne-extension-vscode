import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { AriadneMessage } from './messages';
import type { VulnerabilityMetadata } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
import { resolveAriadneExecutable } from '../../core/ariadneExecutable';

export type FindingsCallback = (findings: VulnerabilityMetadata[]) => void;

export interface AriadneSession {
	send(msg: AriadneMessage): void;
	kill(): void;
	/** Spawn the engine if it is not already running and notify restart listeners. */
	start(): void;
	/** Kill the engine and spawn a fresh session process. */
	restart(): void;
	/** Subscribe to findings emitted after each analysis. Returns disposable to unsubscribe. */
	onFindings(cb: FindingsCallback): { dispose: () => void };
	/** Fired after `start()` / `restart()` once the process is spawned. */
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

	const notifyRestarted = (): void => {
		for (const cb of restartedCallbacks) {
			cb();
		}
	};

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
		start(): void {
			if (proc) {
				return;
			}
			proc = spawnSession();
			console.log('[Ariadne TS] engine session started');
			notifyRestarted();
		},
		restart(): void {
			proc?.kill();
			proc = spawnSession();
			console.log('[Ariadne TS] engine session restarted');
			notifyRestarted();
		},
		onFindings(cb: FindingsCallback): { dispose: () => void } {
			findingsCallbacks.push(cb);
			return {
				dispose: () => {
					const idx = findingsCallbacks.indexOf(cb);
					if (idx !== -1) {
						findingsCallbacks.splice(idx, 1);
					}
				},
			};
		},
		onRestarted(cb: () => void): void {
			restartedCallbacks.push(cb);
		},
	};
}
