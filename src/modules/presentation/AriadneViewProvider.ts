import * as vscode from 'vscode';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	private currentHtml: string;
	private webviewView?: vscode.WebviewView;
	private pendingBadgeCount?: number;
	/** Optional hook to rebuild HTML when the panel becomes visible. */
	private resolveHtml?: () => string;
	private resolveHtmlApplied = false;
	private readonly messageHandler?: (msg: Record<string, unknown>) => void;

	constructor(initialHtml: string, onMessage?: (msg: Record<string, unknown>) => void) {
		this.currentHtml = initialHtml;
		this.messageHandler = onMessage;
	}

	/**
	 * When set, `resolveWebviewView` calls this to build fresh HTML each
	 * time the panel is opened (e.g. to expand the first vulnerability).
	 */
	setResolveHtml(getHtml: () => string): void {
		this.resolveHtml = getHtml;
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.webviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			enableCommandUris: true,
		};

		if (this.resolveHtml && !this.resolveHtmlApplied) {
			this.currentHtml = this.resolveHtml();
			this.resolveHtmlApplied = true;
		}

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

			// Delegate to the external message handler (if provided).
			this.messageHandler?.(msg);
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
		if (html === this.currentHtml) {
			return;
		}
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
