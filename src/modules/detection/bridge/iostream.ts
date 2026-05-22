import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { AriadneMessage } from './messages';
import type { VulnerabilityMetadata } from '../../feedback/vulnerability_results/vulnerabilityTypes.js';

export type FindingsCallback = (findings: VulnerabilityMetadata[]) => void;

export interface AriadneSession {
	send(msg: AriadneMessage): void;
	kill(): void;
	/** Subscribe to findings emitted after each Analyze message. */
	onFindings(cb: FindingsCallback): void;
}

export function runSession(): AriadneSession {
	const proc: ChildProcessWithoutNullStreams = spawn('ariadne', ['session'], {
		stdio: ['pipe', 'pipe', 'pipe'],
	});

	// ── stdout: line-delimited JSON ─────────────────────────────────────
	// The engine emits exactly one JSON line per Analyze response.
	// Buffer partial chunks across `data` events before parsing.
	let stdoutBuffer = '';
	const findingsCallbacks: FindingsCallback[] = [];

	proc.stdout.on('data', (chunk: Buffer) => {
		stdoutBuffer += chunk.toString();

		// Process every complete newline-terminated line
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
				// Non-JSON lines from the engine (shouldn't happen but guard anyway)
				console.warn('[Ariadne] Unexpected engine stdout:', line);
			}
		}
	});

	proc.stderr.on('data', (data: Buffer) => {
		console.error(`[Ariadne Core] ${data.toString().trimEnd()}`);
	});

	proc.on('close', (code: number | null) => {
		console.log(`[Ariadne Core] process exited with code ${code}`);
	});

	return {
		send(msg: AriadneMessage): void {
			const line = JSON.stringify(msg) + '\n';
			proc.stdin.write(line);
		},
		kill(): void {
			proc.kill();
		},
		onFindings(cb: FindingsCallback): void {
			findingsCallbacks.push(cb);
		},
	};
}
