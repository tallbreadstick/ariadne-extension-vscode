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
		};

		// Preserve panel state (scroll position, open cards) when the user
		// switches between tabs in the Ariadne panel container.
		webviewView.retainContextWhenHidden = true;

		webviewView.webview.html = this.initialHtml;
	}
}

