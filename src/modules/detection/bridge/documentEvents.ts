import * as vscode from 'vscode';
import { AriadneSession } from './iostream';

/** Debounce interval for incremental AST updates */
const DEBOUNCE_MS = 400;

/** Per-file debounce timers */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isJava(doc: vscode.TextDocument): boolean {
	return doc.languageId === 'java';
}

/**
 * Registers VS Code filesystem + editor events and converts them
 * into structured IPC messages for the Rust SAST engine.
 *
 * This layer acts as:
 * VS Code API → normalized semantic events → Ariadne protocol
 */
export function registerDocumentEvents(
	context: vscode.ExtensionContext,
	session: AriadneSession,
): void {

	// ============================================================
	// INIT
	// ============================================================
	const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '/';
	console.log(`[Ariadne TS] Init root=${root}`);
	session.send({ type: 'Init', root });

	// ============================================================
	// INITIAL OPEN FILES
	// ============================================================
	vscode.workspace.textDocuments
		.filter(isJava)
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
			if (!isJava(doc)) return;

			console.log(`[Ariadne TS] OpenFile ${doc.uri.fsPath}`);

			session.send({
				type: 'OpenFile',
				path: doc.uri.fsPath,
				content: doc.getText(),
			});
		}),
	);

	// ============================================================
	// FILE CREATE (NEW FILE)
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidCreateFiles((event) => {
			event.files.forEach((file) => {
				if (file.fsPath.endsWith('.java')) {
					console.log(`[Ariadne TS] CreateFile ${file.fsPath}`);

					session.send({
						type: 'CreateFile',
						path: file.fsPath,
						content: '',
					});
				}
			});
		}),
	);

	// ============================================================
	// FILE DELETE
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidDeleteFiles((event) => {
			event.files.forEach((file) => {
				console.log(`[Ariadne TS] DeleteFile ${file.fsPath}`);

				session.send({
					type: 'DeleteFile',
					path: file.fsPath,
				});
			});
		}),
	);

	// ============================================================
	// FILE RENAME
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidRenameFiles((event) => {
			event.files.forEach((file) => {
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
	// UPDATE FILE (DEBOUNCED)
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (!isJava(event.document)) return;
			if (event.contentChanges.length === 0) return;

			const path = event.document.uri.fsPath;

			const existing = debounceTimers.get(path);
			if (existing) clearTimeout(existing);

			const edits = event.contentChanges.map((change) => ({
				start: change.rangeOffset,
				end: change.rangeOffset + change.rangeLength,
				new_text: change.text,
			}));

			const timer = setTimeout(() => {
				debounceTimers.delete(path);

				console.log(
					`[Ariadne TS] UpdateFile ${path} edits=${edits.length}`,
				);

				session.send({
					type: 'UpdateFile',
					path,
					edits,
				});
			}, DEBOUNCE_MS);

			debounceTimers.set(path, timer);
		}),
	);

	// ============================================================
	// CLOSE FILE
	// ============================================================
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((doc) => {
			if (!isJava(doc)) return;

			const path = doc.uri.fsPath;

			const existing = debounceTimers.get(path);
			if (existing) {
				clearTimeout(existing);
				debounceTimers.delete(path);
			}

			console.log(`[Ariadne TS] CloseFile ${path}`);

			session.send({
				type: 'CloseFile',
				path,
			});
		}),
	);
}