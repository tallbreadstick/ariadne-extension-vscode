import * as vscode from 'vscode';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'ariadne.panel';

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		webviewView.webview.options = { enableScripts: false };
		webviewView.webview.html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
	}
}
