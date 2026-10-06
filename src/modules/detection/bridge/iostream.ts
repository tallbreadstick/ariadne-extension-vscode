import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { AriadneMessage } from './messages';
import type { VulnerabilityMetadata } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';
import { ensureAriadneExecutable } from '../../core/ariadneExecutable';

export type FindingsCallback = (findings: VulnerabilityMetadata[]) => void;

export interface AriadneSession {
	send(msg: AriadneMessage): void;
	kill(): void;
	/** Spawn the engine if it is not already running and notify restart listeners. */
	start(): Promise<void>;
	/** Kill the engine and spawn a fresh session process. */
	restart(): Promise<void>;
	/** Subscribe to findings emitted after each analysis. Returns disposable to unsubscribe. */
	onFindings(cb: FindingsCallback): { dispose: () => void };
	/** Fired after `start()` / `restart()` once the process is spawned. */
	onRestarted(cb: () => void): void;
	/** True while the session process is still running. */
	isRunning(): boolean;
	/** Fired when the session process exits on its own. */
	onSessionEnded(cb: () => void): void;
}

export function runSession(): AriadneSession {
	let proc: ChildProcessWithoutNullStreams | null = null;
	let stdoutBuffer = '';
	const findingsCallbacks: FindingsCallback[] = [];
	const restartedCallbacks: Array<() => void> = [];
	const endedCallbacks: Array<() => void> = [];
	let generation = 0;

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

		const noteExit = (code: number | null): void => {
			console.log(`[Ariadne Core] process exited with code ${code}`);
			if (proc !== child) {
				return;
			}
			proc = null;
			for (const cb of endedCallbacks) {
				cb();
			}
		};

		child.on('error', () => {
			noteExit(null);
		});

		child.on('close', (code: number | null) => {
			noteExit(code);
		});
	};

	const spawnSession = async (): Promise<ChildProcessWithoutNullStreams> => {
		const exe = await ensureAriadneExecutable();
		const child = spawn(exe, ['session'], {
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
			generation += 1;
			proc?.kill();
			proc = null;
		},
		start(): Promise<void> {
			if (proc) {
				return Promise.resolve();
			}
			const ticket = ++generation;
			return (async () => {
				const child = await spawnSession();
				if (ticket !== generation) {
					child.kill();
					return;
				}
				proc = child;
				console.log('[Ariadne TS] engine session started');
				notifyRestarted();
			})();
		},
		restart(): Promise<void> {
			generation += 1;
			proc?.kill();
			proc = null;
			return this.start();
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
		isRunning(): boolean {
			return proc !== null && proc.exitCode === null && !proc.killed;
		},
		onSessionEnded(cb: () => void): void {
			endedCallbacks.push(cb);
		},
	};
}
