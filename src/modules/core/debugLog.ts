/**
 * Append-only debug error logs under the extension's global storage
 * (`globalStorageUri/debug-logs/`). For study troubleshooting — not user-facing.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const LOG_DIR_NAME = 'debug-logs';

let storageRoot: string | undefined;

export function configureDebugLog(globalStoragePath: string): void {
	storageRoot = globalStoragePath;
}

export function debugLogDirectory(): string {
	if (!storageRoot) {
		throw new Error('Ariadne debug log is not configured.');
	}
	return join(storageRoot, LOG_DIR_NAME);
}

function todayStamp(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function isoTimestamp(): string {
	return new Date().toISOString();
}

/** Drops tokens, bearer headers, and query secrets before a line is written. */
export function redactSecrets(text: string): string {
	return text
		.replace(/([?&])(token|access_token|api_key|apikey|key|sig|signature)=[^&\s]*/gi, '$1$2=[redacted]')
		.replace(/\b(bearer\s+)\S+/gi, '$1[redacted]')
		.replace(/\b(ghp_|github_pat_|gho_|ghu_|ghs_|sk-)[A-Za-z0-9_]+/g, '[redacted]');
}

/** Logs an origin and path, never a signed query string. */
export function loggableUrl(raw: string): string {
	try {
		const url = new URL(raw);
		return `${url.origin}${url.pathname}`;
	} catch {
		return redactSecrets(raw.split('?')[0] ?? raw);
	}
}

function clip(text: string, max = 500): string {
	const clean = redactSecrets(text).replace(/\s+/g, ' ').trim();
	return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** Formats one log line (tested). Never include tokens or raw LLM bodies. */
export function formatAriadneErrorLine(
	scope: string,
	error: unknown,
	detail?: string,
): string {
	const parts: string[] = [`[${isoTimestamp()}]`, 'ERROR', `[${scope}]`];
	if (detail?.trim()) {
		parts.push(clip(detail));
	}
	if (error instanceof Error) {
		parts.push(clip(error.message));
		if (error.stack) {
			parts.push(clip(error.stack.replace(/\r\n/g, '\n').split('\n').slice(0, 8).join(' | '), 800));
		}
	} else if (error !== undefined && error !== null) {
		parts.push(clip(String(error)));
	}
	return parts.join(' ');
}

/**
 * Writes an error line to today's log file. Failures are swallowed so logging
 * never breaks the extension.
 */
export function logAriadneError(scope: string, error: unknown, detail?: string): void {
	void writeErrorLine(scope, error, detail).catch(() => undefined);
}

async function writeErrorLine(
	scope: string,
	error: unknown,
	detail?: string,
): Promise<void> {
	if (!storageRoot) {
		return;
	}
	const dir = join(storageRoot, LOG_DIR_NAME);
	await mkdir(dir, { recursive: true });
	const file = join(dir, `ariadne-${todayStamp()}.log`);
	const line = formatAriadneErrorLine(scope, error, detail);
	await appendFile(file, `${line}\n`, 'utf8');
}
