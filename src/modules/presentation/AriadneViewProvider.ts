import * as vscode from 'vscode';
import { resolveWorkspaceFsPath } from '../detection/bridge/convert.js';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	private currentHtml: string;
	private webviewView?: vscode.WebviewView;
	private pendingBadgeCount?: number;
	private pendingMessages: unknown[] = [];
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

	/**
	 * Sends a message to the active webview, or queues it if the webview
	 * has not yet been resolved.
	 */
	postMessage(message: unknown): void {
		if (this.webviewView) {
			try {
				this.webviewView.webview.postMessage(message);
			} catch {
				this.webviewView = undefined;
				this.pendingMessages.push(message);
			}
		} else {
			this.pendingMessages.push(message);
		}
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.webviewView = webviewView;

		webviewView.onDidDispose(() => {
			if (this.webviewView === webviewView) {
				this.webviewView = undefined;
			}
		});

		webviewView.webview.options = {
			enableScripts: true,
			enableCommandUris: true,
		};

		if (this.resolveHtml && !this.resolveHtmlApplied) {
			this.currentHtml = this.resolveHtml();
			this.resolveHtmlApplied = true;
		}

		try {
			webviewView.webview.html = this.currentHtml;
		} catch {
			this.webviewView = undefined;
			return;
		}

		// Handle messages posted from the webview (e.g. click-to-navigate).
		webviewView.webview.onDidReceiveMessage(async (msg) => {
			if (msg.type === 'goto-line' && msg.filePath && msg.line) {
				const uri = vscode.Uri.file(resolveWorkspaceFsPath(msg.filePath));
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

		if (this.pendingMessages.length > 0) {
			const queued = [...this.pendingMessages];
			this.pendingMessages = [];
			setTimeout(() => {
				for (const msg of queued) {
					try {
						this.webviewView?.webview.postMessage(msg);
					} catch {
						this.webviewView = undefined;
						break;
					}
				}
			}, 100);
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
			try {
				this.webviewView.webview.html = html;
			} catch {
				this.webviewView = undefined;
			}
		}
	}

	setBadgeCount(count: number): void {
		if (this.webviewView) {
			try {
				this.applyBadgeCount(count);
				return;
			} catch {
				this.webviewView = undefined;
			}
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
