import * as vscode from 'vscode';
import { AriadneSession } from './iostream';

/** Debounce interval per SRS: 300–500 ms. */
const DEBOUNCE_MS = 400;

/** Per-file debounce timers for UpdateFile messages. */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isJava(doc: vscode.TextDocument): boolean {
	return doc.languageId === 'java';
}

/**
 * Registers VS Code document lifecycle events and translates them
 * into IPC messages sent to the Ariadne SAST engine via the session bridge.
 *
 * Call once from `activate()` after the session is started.
 */
export function registerDocumentEvents(
	context: vscode.ExtensionContext,
	session: AriadneSession,
): void {
	// INIT — send workspace root as the very first message.
	const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '/';
	console.log(`[Ariadne TS] Init root=${root}`);
	session.send({ type: 'Init', root });

	// OPEN already-visible Java documents (open before the extension activated).
	vscode.workspace.textDocuments.filter(isJava).forEach((doc) => {
		console.log(`[Ariadne TS] OpenFile (pre-existing) path=${doc.uri.fsPath}`);
		session.send({
			type: 'OpenFile',
			path: doc.uri.fsPath,
			content: doc.getText(),
		});
	});

	// OPEN FILE — fires when a document is first loaded into VS Code.
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((doc) => {
			if (!isJava(doc)) {
				return;
			}
			console.log(`[Ariadne TS] OpenFile path=${doc.uri.fsPath}`);
			session.send({
				type: 'OpenFile',
				path: doc.uri.fsPath,
				content: doc.getText(),
			});
		}),
	);

	// UPDATE FILE — debounced at 400 ms.
	// VS Code provides rangeOffset (start byte) and rangeLength (replaced byte count),
	// which map directly to the TextEdit fields the Rust engine expects.
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (!isJava(event.document)) {
				return;
			}
			if (event.contentChanges.length === 0) {
				return;
			}

			const path = event.document.uri.fsPath;

			const existing = debounceTimers.get(path);
			if (existing) {
				clearTimeout(existing);
			}

			const edits = event.contentChanges.map((change) => ({
				start: change.rangeOffset,
				end: change.rangeOffset + change.rangeLength,
				new_text: change.text,
			}));

			const timer = setTimeout(() => {
				debounceTimers.delete(path);
				console.log(`[Ariadne TS] UpdateFile path=${path} edits=${edits.length}`);
				session.send({ type: 'UpdateFile', path, edits });
			}, DEBOUNCE_MS);

			debounceTimers.set(path, timer);
		}),
	);

	// CLOSE FILE — cancel any pending debounce for this file before notifying.
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((doc) => {
			if (!isJava(doc)) {
				return;
			}

			const path = doc.uri.fsPath;
			const existing = debounceTimers.get(path);
			if (existing) {
				clearTimeout(existing);
				debounceTimers.delete(path);
			}

			console.log(`[Ariadne TS] CloseFile path=${path}`);
			session.send({ type: 'CloseFile', path });
		}),
	);
}
