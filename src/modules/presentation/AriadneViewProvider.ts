import * as vscode from 'vscode';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	private readonly initialHtml: string;

	constructor(initialHtml: string) {
		this.initialHtml = initialHtml;
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		webviewView.webview.options = {
			// Scripts enabled so the panel can receive postMessage updates
			// from the extension host once the backend is wired up.
			enableScripts: true,
			enableCommandUris: true,
		};

		webviewView.webview.html = this.initialHtml;
	}
}

