import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { AriadneMessage } from './messages';

export interface AriadneSession {
	send(msg: AriadneMessage): void;
	kill(): void;
}

export function runSession(): AriadneSession {
	const proc: ChildProcessWithoutNullStreams = spawn('ariadne', ['session'], {
		stdio: ['pipe', 'pipe', 'pipe'],
	});

	proc.stdout.on('data', (data) => {
		console.log(`[Ariadne Core] ${data.toString()}`);
	});

	proc.stderr.on('data', (data) => {
		console.error(`[Ariadne Core Error] ${data.toString()}`);
	});

	proc.on('close', (code) => {
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
	};
}
