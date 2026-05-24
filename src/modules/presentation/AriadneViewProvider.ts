import * as vscode from 'vscode';

export class AriadneViewProvider implements vscode.WebviewViewProvider {
	private currentHtml: string;
	private webviewView?: vscode.WebviewView;
	private pendingBadgeCount?: number;
	/** Optional hook to rebuild HTML when the panel becomes visible. */
	private resolveHtml?: () => string;

	constructor(initialHtml: string) {
		this.currentHtml = initialHtml;
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

		if (this.resolveHtml) {
			this.currentHtml = this.resolveHtml();
		}

		webviewView.webview.html = this.currentHtml;

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
