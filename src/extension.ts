// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

class AriadneViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'ariadne.panel';

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		webviewView.webview.options = { enableScripts: false };
		webviewView.webview.html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "ariadne-extension-vscode" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('ariadne-extension-vscode.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from ariadne!');
	});

	const provider = new AriadneViewProvider();
	const viewDisposable = vscode.window.registerWebviewViewProvider(AriadneViewProvider.viewType, provider);

	context.subscriptions.push(disposable, viewDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
