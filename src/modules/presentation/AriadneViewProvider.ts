import * as vscode from 'vscode';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	private readonly initialHtml: string;

	constructor(initialHtml: string) {
		this.initialHtml = initialHtml;
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		webviewView.webview.options = { enableScripts: false };
		webviewView.webview.html = this.initialHtml;
	}
}
