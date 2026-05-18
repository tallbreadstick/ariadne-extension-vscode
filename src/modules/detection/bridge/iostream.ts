import { spawn } from 'node:child_process';

export function runSession() {
	const proc = spawn('ariadne', ['session'], {
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
}
