import * as vscode from 'vscode';
import { join, relative } from 'node:path';
import { AriadneSession } from './iostream';
import { incrementRevision } from './revisionTracker.js';

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
const DEBOUNCE_MS = 400;

interface FileUpdateState {
	/** Fires `DEBOUNCE_MS` after the last edit (trailing debounce). */
	trailingTimer: ReturnType<typeof setTimeout> | null;
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

export function isTrackedDocument(doc: vscode.TextDocument): boolean {
	return isTrackedFilePath(doc.uri.fsPath);
}

function isAriadnePath(fsPath: string): boolean {
	return fsPath.endsWith('.ariadne');
}

function collectRuleOverlays(): Record<string, string> {
	const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!root) {
		return {};
	}
	const rulesDir = join(root, 'rules');
	const overlays: Record<string, string> = {};
	for (const doc of vscode.workspace.textDocuments) {
		if (!isAriadnePath(doc.uri.fsPath)) {
			continue;
		}
		const rel = relative(rulesDir, doc.uri.fsPath).replace(/\\/g, '/');
		if (!rel || rel.startsWith('..')) {
			continue;
		}
		overlays[rel] = doc.getText();
	}
	return overlays;
}

let rulesReloadTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRulesReload(session: AriadneSession): void {
	if (rulesReloadTimer) {
		clearTimeout(rulesReloadTimer);
	}
	rulesReloadTimer = setTimeout(() => {
		rulesReloadTimer = null;
		const overlays = collectRuleOverlays();
		console.log(`[Ariadne TS] ReloadRules overlays=${Object.keys(overlays).join(',') || '(disk)'}`);
		session.send({ type: 'ReloadRules', overlays });
	}, DEBOUNCE_MS);
}

function resolveDocument(filePath: string): vscode.TextDocument | undefined {
	return vscode.workspace.textDocuments.find((d) => d.uri.fsPath === filePath);
}

function getOrCreateState(filePath: string): FileUpdateState {
	let state = fileUpdateState.get(filePath);
	if (!state) {
		state = { trailingTimer: null, pending: false };
		fileUpdateState.set(filePath, state);
	}
	return state;
}

function clearTimers(state: FileUpdateState): void {
	if (state.trailingTimer) {
		clearTimeout(state.trailingTimer);
		state.trailingTimer = null;
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
	}, DEBOUNCE_MS);
}

function scheduleDocumentUpdate(session: AriadneSession, doc: vscode.TextDocument): void {
	const filePath = doc.uri.fsPath;
	const state = getOrCreateState(filePath);
	if (!state.pending) {
		console.log(`[Ariadne TS] Debounced update scheduled for ${filePath} (${DEBOUNCE_MS}ms)`);
	}
	state.pending = true;

	scheduleTrailingScan(session, filePath);
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
 * Flushes all pending in-memory buffer edits to the engine immediately.
 * Called during deactivation so the engine's forest is fully synced before
 * a final scan or shutdown.
 */
export function flushAllPendingUpdates(session: AriadneSession): void {
	for (const [filePath, state] of fileUpdateState.entries()) {
		if (state.pending) {
			const doc = resolveDocument(filePath);
			if (doc) {
				console.log(`[Ariadne TS] Shutdown flush: syncing ${filePath}`);
				sendFullDocumentUpdate(session, doc);
			}
			state.pending = false;
		}
		clearTimers(state);
	}
	fileUpdateState.clear();
}

/**
 * Cancels all pending debounce and max-wait timers across all files.
 */
export function cancelAllPendingUpdates(): void {
	for (const state of fileUpdateState.values()) {
		clearTimers(state);
	}
	fileUpdateState.clear();
}

/**
 * Registers VS Code filesystem + editor events and converts them
 * into structured IPC messages for the Rust SAST engine.
 *
 * File mutation events automatically trigger re-analysis in the
 * session after each UpdateFile / Create / Delete / Rename.
 *
 * @param onSaveTrigger - Optional callback fired immediately before
 *   the Analyze IPC message is sent on a tracked-file save. Receives
 *   the workspace revision at the moment of the save so the caller
 *   can record it for settlement validation.
 *
 * @param onRevisionChange - Optional callback fired whenever a
 *   tracked-file mutation increments the workspace revision. The new
 *   revision number is passed as the argument. Use this to cancel any
 *   active settlement timer.
 */
export function registerDocumentEvents(
	context: vscode.ExtensionContext,
	session: AriadneSession,
	onSaveTrigger?: (revision: number) => void,
	onRevisionChange?: (revision: number) => void,
): void {

	// ============================================================
	// INIT — seed the engine with the workspace root
	// ============================================================
	const bootstrap = (): void => {
		const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '/';
		console.log(`[Ariadne TS] Init root=${root}`);
		session.send({ type: 'Init', root });

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
	};

	bootstrap();
	session.onRestarted(bootstrap);
	scheduleRulesReload(session);

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((doc) => {
			if (isAriadnePath(doc.uri.fsPath)) {
				scheduleRulesReload(session);
			}
		}),

		vscode.workspace.onDidSaveTextDocument((doc) => {
			if (isAriadnePath(doc.uri.fsPath)) {
				scheduleRulesReload(session);
			}
			if (isTrackedDocument(doc)) {
				// Flush any pending in-flight debounced edits first so the engine's
				// forest is guaranteed to hold the latest buffer when Analyze runs.
				const state = fileUpdateState.get(doc.uri.fsPath);
				if (state?.pending) {
					console.log(`[Ariadne TS] Save flush: syncing in-flight edits for ${doc.uri.fsPath}`);
					sendFullDocumentUpdate(session, doc);
				}
				cancelPendingUpdate(doc.uri.fsPath);

				// Record current revision before sending so the caller can
				// validate the result when it arrives.
				const revision = incrementRevision();
				console.log(`[Ariadne TS] Save-triggered scan revision=${revision}: ${doc.uri.fsPath}`);
				onSaveTrigger?.(revision);
				session.send({ type: 'Analyze', path: null });
			}
		}),

		vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.contentChanges.length === 0) {
				return;
			}
			const fsPath = event.document.uri.fsPath;
			if (isAriadnePath(fsPath)) {
				scheduleRulesReload(session);
			}
			if (isTrackedFilePath(fsPath)) {
				// Increment revision: any tracked edit cancels active settlement.
				const rev = incrementRevision();
				onRevisionChange?.(rev);
			}
		}),
	);

	const rulesWatcher = vscode.workspace.createFileSystemWatcher('**/*.ariadne');
	rulesWatcher.onDidCreate(() => scheduleRulesReload(session));
	rulesWatcher.onDidChange(() => scheduleRulesReload(session));
	rulesWatcher.onDidDelete(() => scheduleRulesReload(session));
	context.subscriptions.push(rulesWatcher);

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
				const rev = incrementRevision();
				onRevisionChange?.(rev);
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
				const rev = incrementRevision();
				onRevisionChange?.(rev);
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
				const rev = incrementRevision();
				onRevisionChange?.(rev);
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
