import * as vscode from 'vscode';
import { AriadneSession } from './iostream';

/**
 * Debounced scan interval (ms) for live edits.
 *
 * Two timers cooperate so rapid typing never skips the latest buffer:
 * - **Trailing debounce** — fires once `DEBOUNCE_MS` after the last edit (final scan).
 * - **Max-wait interval** — while edits keep arriving, forces a scan at least every
 *   `DEBOUNCE_MS` so long bursts still produce periodic results.
 *
 * After each flush, if the document version changed in the meantime, one more
 * trailing scan is scheduled so the absolute latest content is always sent.
 */
const DEBOUNCE_MS = 300;

interface FileUpdateState {
	/** Fires `DEBOUNCE_MS` after the last edit (trailing debounce). */
	trailingTimer: ReturnType<typeof setTimeout> | null;
	/** Forces a scan at least every `DEBOUNCE_MS` during continuous typing. */
	maxWaitTimer: ReturnType<typeof setTimeout> | null;
	/** Edits arrived since the last successful flush. */
	pending: boolean;
}

/** Per-file debounce / max-wait state. */
const fileUpdateState = new Map<string, FileUpdateState>();

function basename(fsPath: string): string {
	const normalized = fsPath.replace(/\\/g, '/');
	return normalized.slice(normalized.lastIndexOf('/') + 1);
}

/** Files the Rust engine tracks for live config / hygiene checks. */
function isTrackedFilePath(fsPath: string): boolean {
	if (fsPath.endsWith('.java')) {
		return true;
	}

	const base = basename(fsPath);
	return base === 'application.properties' || base === '.gitignore' || base === '.env';
}

function isTrackedDocument(doc: vscode.TextDocument): boolean {
	return isTrackedFilePath(doc.uri.fsPath);
}

function resolveDocument(filePath: string): vscode.TextDocument | undefined {
	return vscode.workspace.textDocuments.find((d) => d.uri.fsPath === filePath);
}

function getOrCreateState(filePath: string): FileUpdateState {
	let state = fileUpdateState.get(filePath);
	if (!state) {
		state = { trailingTimer: null, maxWaitTimer: null, pending: false };
		fileUpdateState.set(filePath, state);
	}
	return state;
}

function clearTimers(state: FileUpdateState): void {
	if (state.trailingTimer) {
		clearTimeout(state.trailingTimer);
		state.trailingTimer = null;
	}
	if (state.maxWaitTimer) {
		clearTimeout(state.maxWaitTimer);
		state.maxWaitTimer = null;
	}
}

/**
 * Push the current in-memory buffer to the engine. The session re-analyses
 * automatically after every UpdateFile — no separate Analyze IPC needed.
 */
function sendFullDocumentUpdate(session: AriadneSession, doc: vscode.TextDocument): void {
	const fullText = doc.getText();
	session.send({
		type: 'UpdateFile',
		path: doc.uri.fsPath,
		edits: [{ start: 0, end: fullText.length, new_text: fullText }],
	});
}

/**
 * Send the latest buffer to the engine. If the document changed during the
 * send, mark pending again and schedule one more trailing scan.
 */
function flushDocumentUpdate(session: AriadneSession, filePath: string): void {
	const doc = resolveDocument(filePath);
	if (!doc) {
		return;
	}

	const versionAtFlush = doc.version;
	console.log(`[Ariadne TS] UpdateFile ${filePath} len=${doc.getText().length}`);
	sendFullDocumentUpdate(session, doc);

	const state = fileUpdateState.get(filePath);
	if (!state) {
		return;
	}

	const latest = resolveDocument(filePath);
	if (latest && latest.version !== versionAtFlush) {
		// New edits landed while we flushed — ensure one more trailing scan.
		state.pending = true;
		scheduleTrailingScan(session, filePath);
	} else {
		state.pending = false;
		if (!state.trailingTimer) {
			state.maxWaitTimer = null;
		}
	}
}

function scheduleTrailingScan(session: AriadneSession, filePath: string): void {
	const state = getOrCreateState(filePath);

	if (state.trailingTimer) {
		clearTimeout(state.trailingTimer);
	}

	state.trailingTimer = setTimeout(() => {
		state.trailingTimer = null;
		if (!state.pending) {
			return;
		}
		flushDocumentUpdate(session, filePath);
		if (!state.pending) {
			if (state.maxWaitTimer) {
				clearTimeout(state.maxWaitTimer);
				state.maxWaitTimer = null;
			}
		}
	}, DEBOUNCE_MS);
}

function scheduleMaxWaitScan(session: AriadneSession, filePath: string): void {
	const state = getOrCreateState(filePath);

	if (state.maxWaitTimer) {
		return;
	}

	state.maxWaitTimer = setTimeout(() => {
		state.maxWaitTimer = null;
		if (state.pending) {
			flushDocumentUpdate(session, filePath);
		}
		if (state.pending) {
			scheduleMaxWaitScan(session, filePath);
		}
	}, DEBOUNCE_MS);
}

function scheduleDocumentUpdate(session: AriadneSession, doc: vscode.TextDocument): void {
	const filePath = doc.uri.fsPath;
	const state = getOrCreateState(filePath);
	state.pending = true;

	scheduleTrailingScan(session, filePath);
	scheduleMaxWaitScan(session, filePath);
}

function cancelPendingUpdate(filePath: string): void {
	const state = fileUpdateState.get(filePath);
	if (!state) {
		return;
	}
	clearTimers(state);
	fileUpdateState.delete(filePath);
}

/**
 * Registers VS Code filesystem + editor events and converts them
 * into structured IPC messages for the Rust SAST engine.
 *
 * File mutation events automatically trigger re-analysis in the
 * session after each UpdateFile / Create / Delete / Rename.
 */
export function registerDocumentEvents(
	context: vscode.ExtensionContext,
	session: AriadneSession,
): void {

	// ============================================================
	// INIT — seed the engine with the workspace root
	// ============================================================
	const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '/';
	console.log(`[Ariadne TS] Init root=${root}`);
	session.send({ type: 'Init', root });

	// ============================================================
	// INITIAL OPEN FILES — sync buffer for files already open
	// ============================================================
	vscode.workspace.textDocuments
		.filter(isTrackedDocument)
		.forEach((doc) => {
			console.log(`[Ariadne TS] OpenFile (preloaded) ${doc.uri.fsPath}`);
			session.send({
				type: 'OpenFile',
				path: doc.uri.fsPath,
				content: doc.getText(),
			});
		});

	// ============================================================
	// FILE OPEN
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((doc) => {
			if (!isTrackedDocument(doc)) { return; }
			console.log(`[Ariadne TS] OpenFile ${doc.uri.fsPath}`);
			session.send({
				type: 'OpenFile',
				path: doc.uri.fsPath,
				content: doc.getText(),
			});
		}),
	);

	// ============================================================
	// FILE CREATE
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidCreateFiles((event) => {
			event.files.forEach((file) => {
				if (!isTrackedFilePath(file.fsPath)) { return; }
				console.log(`[Ariadne TS] CreateFile ${file.fsPath}`);
				session.send({ type: 'CreateFile', path: file.fsPath, content: '' });
			});
		}),
	);

	// ============================================================
	// FILE DELETE
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidDeleteFiles((event) => {
			event.files.forEach((file) => {
				if (!isTrackedFilePath(file.fsPath)) { return; }
				console.log(`[Ariadne TS] DeleteFile ${file.fsPath}`);
				session.send({ type: 'DeleteFile', path: file.fsPath });
			});
		}),
	);

	// ============================================================
	// FILE RENAME
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidRenameFiles((event) => {
			event.files.forEach((file) => {
				if (!isTrackedFilePath(file.oldUri.fsPath) && !isTrackedFilePath(file.newUri.fsPath)) {
					return;
				}
				console.log(
					`[Ariadne TS] RenameFile ${file.oldUri.fsPath} → ${file.newUri.fsPath}`,
				);
				session.send({
					type: 'RenameFile',
					old_path: file.oldUri.fsPath,
					new_path: file.newUri.fsPath,
				});
			});
		}),
	);

	// ============================================================
	// UPDATE FILE (debounced full-buffer sync)
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (!isTrackedDocument(event.document)) { return; }
			if (event.contentChanges.length === 0) { return; }
			scheduleDocumentUpdate(session, event.document);
		}),
	);

	// ============================================================
	// CLOSE FILE — flush any pending debounced update first
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((doc) => {
			if (!isTrackedDocument(doc)) { return; }
			const filePath = doc.uri.fsPath;

			const state = fileUpdateState.get(filePath);
			if (state?.pending) {
				flushDocumentUpdate(session, filePath);
			}
			cancelPendingUpdate(filePath);

			console.log(`[Ariadne TS] CloseFile ${filePath}`);
			session.send({ type: 'CloseFile', path: filePath });
		}),
	);
}
