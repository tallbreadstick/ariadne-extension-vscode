import * as vscode from 'vscode';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	private readonly initialHtml: string;
	private webviewView?: vscode.WebviewView;
	private pendingBadgeCount?: number;

	constructor(initialHtml: string) {
		this.initialHtml = initialHtml;
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			// Scripts enabled so the panel can receive postMessage updates
			// from the extension host once the backend is wired up.
			enableScripts: true,
		};

		webviewView.webview.html = this.initialHtml;

		if (this.pendingBadgeCount !== undefined) {
			this.applyBadgeCount(this.pendingBadgeCount);
		}
	}

	setBadgeCount(count: number): void {
		if (this.webviewView) {
			this.applyBadgeCount(count);
			return;
		}
		this.pendingBadgeCount = count;
	}

	private applyBadgeCount(count: number): void {
		if (!this.webviewView) {
			return;
		}

		this.webviewView.badge = {
			value: count,
			tooltip: `Active vulnerabilities: ${count}`,
		};
	}
}

