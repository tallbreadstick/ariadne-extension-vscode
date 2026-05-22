import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';
import { registerDocumentEvents } from './modules/detection/bridge/documentEvents';
import {
	metadataToVulnerability,
	metadataToScanSnapshot,
	groupFindingsByFile,
} from './modules/detection/bridge/convert';

// ── Presentation layer ────────────────────────────────────────────────
import { DiagnosticManager } from './modules/presentation/diagnostics/DiagnosticManager';
import { registerHoverProvider } from './modules/presentation/diagnostics/HoverProvider';
import { buildActiveVulnerabilitiesHtml } from './modules/presentation/views/activeVulnerabilities';
import { buildSessionMetricsHtml } from './modules/tracker/views/sessionMetrics';

// ── Feedback panel (LLM-powered) ──────────────────────────────────────
import { buildFeedbackPanelHtml } from './modules/feedback/views/feedbackPanel.js';
import { serializePayload } from './modules/feedback/llm_request/serializePayload.js';
import { callLLM } from './modules/feedback/llm_request/llmClient.js';
import { parseThreeSectionResponse } from './modules/feedback/llm_request/parseResponse.js';
import type { VulnerabilityMetadata } from './modules/feedback/vulnerability_results/vulnerabilityTypes.js';
import type { FeedbackFinding } from './modules/feedback/llm_feedback/feedbackTypes.js';

// ── Tracker (status bar + analysis engine) ────────────────────────────
import { createAriadneStatusBarItem } from './modules/tracker/views/statusBar';
import { analyzeSession, toSessionMetrics } from './modules/tracker/analysis/snapshotAnalyzer.js';
import type { ScanSnapshot } from './modules/feedback/vulnerability_results/vulnerabilityTypes.js';
import type { Vulnerability } from './modules/presentation/mock/types';

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Maps a presentation-layer Vulnerability to the VulnerabilityMetadata
 * shape expected by the LLM pipeline.
 */
function toVulnerabilityMetadata(vuln: Vulnerability): VulnerabilityMetadata {
	return {
		type: vuln.title,
		cwe_id: vuln.cwe,
		owasp_category: vuln.owaspRef ?? '',
		severity: vuln.severity,
		file_path: vuln.filePath,
		line_number: vuln.line,
	};
}

/**
 * Reads OPENAI_API_KEY from a .env file at the extension root.
 */
function readApiKeyFromDotEnv(extensionPath: string): string {
	try {
		const envPath = path.join(extensionPath, '.env');
		const content = fs.readFileSync(envPath, 'utf-8');
		const match = content.match(/^OPENAI_API_KEY=(.+)$/m);
		return match?.[1]?.trim() ?? '';
	} catch {
		return '';
	}
}

// ─────────────────────────────────────────────────────────────────────
// ACTIVATE
// ─────────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {

	// ── Panel providers — start empty; filled on first engine response ──
	const activeVulnsProvider = new AriadneViewProvider(
		buildActiveVulnerabilitiesHtml([]),
	);
	const sessionMetricsProvider = new AriadneViewProvider(
		buildSessionMetricsHtml({ critical: 0, high: 0, medium: 0, low: 0, trends: { persistingPatterns: 0, improvingTrends: 0, resolvedThisSession: 0 } }),
	);

	const activeVulnsDisposable = vscode.window.registerWebviewViewProvider(
		'ariadne.panel.activeVulnerabilities',
		activeVulnsProvider,
	);
	const sessionMetricsDisposable = vscode.window.registerWebviewViewProvider(
		'ariadne.panel.sessionMetrics',
		sessionMetricsProvider,
	);

	// ── Diagnostic / inline highlight manager ───────────────────────────
	const diagnosticManager = new DiagnosticManager(context);
	registerHoverProvider(context, diagnosticManager);

	// ── Latest known findings (needed for feedback panel lookup) ────────
	let latestVulnerabilities: Vulnerability[] = [];

	// ── Scan-snapshot accumulator for the session tracker ───────────────
	const scanHistory: ScanSnapshot[] = [];
	let scanCounter = 0;

	// ── Ariadne engine session ───────────────────────────────────────────
	const session = runSession();
	registerDocumentEvents(context, session);

	// ── Wire findings from the engine to every UI surface ───────────────
	session.onFindings((findings: VulnerabilityMetadata[]) => {
		// ── 1. Active Vulnerabilities panel ─────────────────────────────
		const vulns = findings.map(metadataToVulnerability);
		latestVulnerabilities = vulns;
		activeVulnsProvider.updateHtml(buildActiveVulnerabilitiesHtml(vulns));
		activeVulnsProvider.setBadgeCount(vulns.length);

		// ── 2. Session Metrics panel ─────────────────────────────────────
		scanCounter += 1;
		const snapshot = metadataToScanSnapshot(findings, `scan-${scanCounter}`);
		scanHistory.push(snapshot);
		// Keep a rolling window of 20 scans so the tracker doesn't grow unbounded
		if (scanHistory.length > 20) { scanHistory.shift(); }

		try {
			const sessionAnalysis = analyzeSession(scanHistory);
			const sessionMetrics = toSessionMetrics(sessionAnalysis);
			sessionMetricsProvider.updateHtml(buildSessionMetricsHtml(sessionMetrics));
		} catch {
			// analyzeSession throws on empty array (guarded above, but be safe)
		}

		// ── 3. Inline squiggles + diagnostics ────────────────────────────
		const byFile = groupFindingsByFile(findings);

		// Refresh every currently visible editor
		for (const editor of vscode.window.visibleTextEditors) {
			const filePath = editor.document.uri.fsPath;
			const fileFindings = byFile.get(filePath) ?? [];
			diagnosticManager.refresh(editor.document, fileFindings);
		}

		// Clear decorations from files that no longer have any findings
		// (handles the case where a fix removes all issues from a file)
		for (const editor of vscode.window.visibleTextEditors) {
			const filePath = editor.document.uri.fsPath;
			if (!byFile.has(filePath)) {
				diagnosticManager.clear(editor.document);
			}
		}
	});

	context.subscriptions.push({ dispose: () => session.kill() });

	// Re-apply decorations whenever the user switches to a different tab
	// (decorations are editor-bound, not document-bound, in VS Code).
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (!editor) { return; }
			// DiagnosticManager already handles this via its own onDidChangeActiveTextEditor
			// subscription set up in its constructor — nothing extra needed here.
		}),
	);

	// ── Hello World command (kept for development) ───────────────────────
	const helloWorld = vscode.commands.registerCommand(
		'ariadne-extension-vscode.helloWorld',
		() => { vscode.window.showInformationMessage('Hello World from ariadne!'); },
	);

	// ── Feedback panel command (LLM-powered) ─────────────────────────────
	const openFeedbackPanel = vscode.commands.registerCommand(
		'ariadne-extension-vscode.openFeedbackPanel',
		async (cwe?: string, title?: string) => {
			// Look up the vulnerability in the latest engine results first;
			// fall back to the first item if no match.
			const vuln =
				latestVulnerabilities.find(
					(item) => item.cwe === cwe || item.title === title,
				) ?? latestVulnerabilities[0];

			if (!vuln) {
				vscode.window.showWarningMessage(
					'Ariadne: No vulnerability data available yet. Wait for the engine to finish its first analysis.',
				);
				return;
			}

			const vulnMetadata = toVulnerabilityMetadata(vuln);

			const config = vscode.workspace.getConfiguration('ariadne');
			const apiKey =
				config.get<string>('openai.apiKey', '') ||
				readApiKeyFromDotEnv(context.extensionPath);
			const model = config.get<string>('openai.model', 'gpt-4.1-mini');

			if (!apiKey) {
				vscode.window.showErrorMessage(
					'Ariadne: No OpenAI API key configured. Set it in Settings → Ariadne.',
				);
				return;
			}

			const panel = vscode.window.createWebviewPanel(
				'ariadne.feedback',
				'Ariadne: Explanation',
				vscode.ViewColumn.Beside,
				{ enableScripts: true },
			);
			panel.webview.html = buildFeedbackPanelHtml(vulnMetadata);

			const activeEditor = vscode.window.activeTextEditor;
			const activeFileContent = activeEditor?.document.getText() ?? '';
			const activeFilePath = activeEditor?.document.uri.fsPath ?? '';

			try {
				const requestBody = serializePayload(
					vulnMetadata,
					activeFileContent,
					activeFilePath,
					model,
				);
				const rawResponse = await callLLM(requestBody, apiKey);
				const sections = parseThreeSectionResponse(rawResponse);

				const finding: FeedbackFinding = {
					type: vuln.title,
					cwe: vuln.cwe,
					owasp: vuln.owaspRef ?? '',
					severity: vuln.severity,
					path: vuln.filePath,
					line: vuln.line,
					...sections,
				};

				panel.webview.postMessage({ type: 'llm-result', finding });
			} catch (error: unknown) {
				const message =
					error instanceof Error ? error.message : 'Unknown error';
				console.error('[Ariadne] LLM pipeline error:', message);
				panel.webview.postMessage({
					type: 'llm-error',
					message: `Ariadne could not retrieve an explanation: ${message}`,
				});
			}
		},
	);

	// ── Status bar (updated alongside session metrics) ───────────────────
	// Start with an empty analysis; real data flows in via onFindings above.
	// `createAriadneStatusBarItem` accepts a SessionAnalysis, so we lazily
	// create one the first time real findings arrive.  For now wire the
	// initial empty state so the bar appears immediately.
	let statusBarDisposable: vscode.Disposable | undefined;
	session.onFindings((findings: VulnerabilityMetadata[]) => {
		if (scanHistory.length === 0) { return; }
		try {
			const analysis = analyzeSession(scanHistory);
			statusBarDisposable?.dispose();
			statusBarDisposable = createAriadneStatusBarItem(analysis);
			context.subscriptions.push(statusBarDisposable);
		} catch { /* guard */ }
	});

	context.subscriptions.push(
		helloWorld,
		activeVulnsDisposable,
		sessionMetricsDisposable,
		openFeedbackPanel,
	);
}

export function deactivate(): void {
	return undefined;
}
