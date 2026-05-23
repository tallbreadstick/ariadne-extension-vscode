import * as vscode from 'vscode';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	private currentHtml: string;
	private webviewView?: vscode.WebviewView;
	private pendingBadgeCount?: number;

	constructor(initialHtml: string) {
		this.currentHtml = initialHtml;
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			enableCommandUris: true,
		};

		webviewView.webview.html = this.currentHtml;

		// Handle messages posted from the webview (e.g. click-to-navigate).
		webviewView.webview.onDidReceiveMessage(async (msg) => {
			if (msg.type === 'goto-line' && msg.filePath && msg.line) {
				const uri = vscode.Uri.file(msg.filePath);
				// VS Code lines are 0-indexed; engine lines are 1-indexed.
				const line = Math.max(0, msg.line - 1);
				const range = new vscode.Range(line, 0, line, 0);

				const editor = await vscode.window.showTextDocument(uri, {
					preserveFocus: false,
					selection: range,
				});
				editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
			}
		});

		if (this.pendingBadgeCount !== undefined) {
			this.applyBadgeCount(this.pendingBadgeCount);
		}
	}

	/**
	 * Replaces the panel's HTML with new content built from fresh findings.
	 * Safe to call before the webview is resolved — the next call to
	 * `resolveWebviewView` will pick up `currentHtml` automatically.
	 */
	updateHtml(html: string): void {
		this.currentHtml = html;
		if (this.webviewView) {
			this.webviewView.webview.html = html;
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
