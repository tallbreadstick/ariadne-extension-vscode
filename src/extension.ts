// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';
import { registerDocumentEvents } from './modules/detection/bridge/documentEvents';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "ariadne-extension-vscode" is now active!',
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand(
		'ariadne-extension-vscode.helloWorld',
		() => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage('Hello World from ariadne!');
		},
	);

	const provider = new AriadneViewProvider();
	const viewDisposable = vscode.window.registerWebviewViewProvider(
		AriadneViewProvider.viewType,
		provider,
	);

	const session = runSession();
	registerDocumentEvents(context, session);

	// Quick command to trigger analysis from the Command Palette
	const analyzeDisposable = vscode.commands.registerCommand(
		'ariadne-extension-vscode.analyze',
		(path?: string | null) => {
			let target: string | null = null;

			if (typeof path === 'string' && path.length > 0) {
				target = path;
			} else {
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					const doc = editor.document;
					console.log(
						`[Ariadne] analyze invoked. activeEditor.scheme=${doc.uri.scheme} isUntitled=${doc.isUntitled}`,
					);

					if (doc.uri.scheme === 'file') {
						target = doc.uri.fsPath;
					} else if (doc.isUntitled) {
						const saveNow = 'Save';
						vscode.window
							.showInformationMessage(
								'Please save the file before analyzing.',
								saveNow,
							)
							.then((sel) => {
								if (sel === saveNow) {
									doc
										.save()
										.then((saved) => {
											if (saved) {
												const newPath = doc.uri.fsPath;
												console.log(
													`[Ariadne] file saved, analyzing ${newPath}`,
												);
												session.send({
													type: 'Analyze',
													path: newPath,
												});
												vscode.window.showInformationMessage(
													`Ariadne: Analyze triggered for ${newPath}`,
												);
											} else {
												console.log(
													'[Ariadne] file not saved; sending Analyze with null path',
												);
												session.send({
													type: 'Analyze',
													path: null,
												});
												vscode.window.showInformationMessage(
													'Ariadne: Analyze triggered (workspace)',
												);
											}
										});
								} else {
									// User declined to save — fallback to null path
									console.log(
										'[Ariadne] user declined to save; sending Analyze with null path',
									);
									session.send({ type: 'Analyze', path: null });
									vscode.window.showInformationMessage(
										'Ariadne: Analyze triggered (workspace)',
									);
								}
							});

						return; // async path handled above
					} else {
						// non-file URI (e.g., git, remote) — fall back to null
						target = null;
					}
				}
			}

			console.log(`[Ariadne] sending Analyze path=${target}`);
			session.send({ type: 'Analyze', path: target });
			const msg = target
				? `Ariadne: Analyze triggered for ${target}`
				: 'Ariadne: Analyze triggered (workspace)';
			vscode.window.showInformationMessage(msg);
		},
	);

	context.subscriptions.push(analyzeDisposable);

	context.subscriptions.push(disposable, viewDisposable, {
		dispose: () => session.kill(),
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
