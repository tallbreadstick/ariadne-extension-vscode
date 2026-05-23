import * as vscode from 'vscode';
import { AriadneSession } from './iostream';

/** Debounce interval for incremental AST updates + re-analysis (ms). */
const DEBOUNCE_MS = 400;

/** Per-file debounce timers. */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

/**
 * Sends an `Analyze` request on the shared session.
 * Called after every mutation event (update/create/delete/rename).
 */
function triggerAnalyze(session: AriadneSession): void {
	session.send({ type: 'Analyze', path: null });
}

/**
 * Registers VS Code filesystem + editor events and converts them
 * into structured IPC messages for the Rust SAST engine.
 *
 * File mutation events (create / update / delete / rename) automatically
 * trigger a follow-up `Analyze` message so the UI stays in sync without
 * requiring any manual refresh.
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

	// Kick off an initial analysis right after the engine has loaded
	// the workspace so the panel shows results without waiting for an edit.
	triggerAnalyze(session);

	// ============================================================
	// INITIAL OPEN FILES
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
			triggerAnalyze(session);
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
			triggerAnalyze(session);
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
			triggerAnalyze(session);
		}),
	);

	// ============================================================
	// UPDATE FILE (debounced) — re-analysis fires after the debounce
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (!isTrackedDocument(event.document)) { return; }
			if (event.contentChanges.length === 0) { return; }

			const filePath = event.document.uri.fsPath;
			const existing = debounceTimers.get(filePath);
			if (existing) { clearTimeout(existing); }

			const edits = event.contentChanges.map((change) => ({
				start: change.rangeOffset,
				end: change.rangeOffset + change.rangeLength,
				new_text: change.text,
			}));

		const timer = setTimeout(() => {
			debounceTimers.delete(filePath);
			const doc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === filePath);
			if (!doc) { return; }

			if (filePath.endsWith('.java')) {
				console.log(`[Ariadne TS] UpdateFile ${filePath} edits=${edits.length}`);
				session.send({ type: 'UpdateFile', path: filePath, edits });
			} else {
				const fullText = doc.getText();
				console.log(`[Ariadne TS] UpdateFile ${filePath} full-replace len=${fullText.length}`);
				session.send({
					type: 'UpdateFile',
					path: filePath,
					edits: [{ start: 0, end: fullText.length, new_text: fullText }],
				});
			}
			triggerAnalyze(session);
		}, DEBOUNCE_MS);

			debounceTimers.set(filePath, timer);
		}),
	);

	// ============================================================
	// CLOSE FILE
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((doc) => {
			if (!isTrackedDocument(doc)) { return; }
			const filePath = doc.uri.fsPath;

			const existing = debounceTimers.get(filePath);
			if (existing) {
				clearTimeout(existing);
				debounceTimers.delete(filePath);
			}

			console.log(`[Ariadne TS] CloseFile ${filePath}`);
			session.send({ type: 'CloseFile', path: filePath });
		}),
	);
}
