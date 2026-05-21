// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';

// ── Presentation layer ────────────────────────────────────────────────
import { buildActiveVulnerabilitiesHtml } from './modules/presentation/views/activeVulnerabilities';
import { buildSessionMetricsHtml } from './modules/presentation/views/sessionMetrics';

// ── Feedback panel (LLM-powered) ─────────────────────────────────────
import { buildFeedbackPanelHtml } from './modules/feedback/views/feedbackPanel.js';
import { serializePayload } from './modules/feedback/llm/serializePayload.js';
import { callLLM } from './modules/feedback/llm/llmClient.js';
import { parseThreeSectionResponse } from './modules/feedback/llm/parseResponse.js';
import type { VulnerabilityMetadata, FeedbackFinding } from './modules/feedback/types.js';

// ── Data layer (mock) ─────────────────────────────────────────────────
// The view builders above are decoupled from the data source — only this
// section needs to change when the backend is ready.
import {
	mockVulnerabilities,
	mockSessionMetrics,
} from './modules/presentation/mock/mockData';
import type { Vulnerability } from './modules/presentation/mock/types';

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Maps a presentation-layer Vulnerability (mock data) to the
 * VulnerabilityMetadata shape expected by the LLM pipeline.
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
 * Reads OPENAI_API_KEY from a .env file at the project root.
 * Returns the key string or '' if not found.
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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand(
		'ariadne-extension-vscode.helloWorld',
		() => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage('Hello World from ariadne!');
		},
	);

	const activeVulnsProvider = new AriadneViewProvider(
		buildActiveVulnerabilitiesHtml(mockVulnerabilities),
	);
	const sessionMetricsProvider = new AriadneViewProvider(
		buildSessionMetricsHtml(mockSessionMetrics),
	);

	const activeVulnsDisposable = vscode.window.registerWebviewViewProvider(
		'ariadne.panel.activeVulnerabilities',
		activeVulnsProvider,
	);
	const sessionMetricsDisposable = vscode.window.registerWebviewViewProvider(
		'ariadne.panel.sessionMetrics',
		sessionMetricsProvider,
	);

	// ── Feedback panel command (LLM-powered) ─────────────────────────
	// Uses mock Vulnerability data from presentation/mock/mockData.ts as
	// the source, maps it to VulnerabilityMetadata, then calls the OpenAI
	// LLM pipeline for the 3-section educational explanation.
	const openFeedbackPanel = vscode.commands.registerCommand(
		'ariadne-extension-vscode.openFeedbackPanel',
		async (cwe?: string, title?: string) => {
			// 1. Look up the mock vulnerability by CWE or title
			const vuln =
				mockVulnerabilities.find(
					(item) => item.cwe === cwe || item.title === title,
				) ?? mockVulnerabilities[0];

			// 2. Map to VulnerabilityMetadata for the LLM pipeline
			const vulnMetadata = toVulnerabilityMetadata(vuln);

			// 3. Read API key from settings
			const config = vscode.workspace.getConfiguration('ariadne');
			const apiKey = config.get<string>('openai.apiKey', '')
				|| readApiKeyFromDotEnv(context.extensionPath);
			const model = config.get<string>('openai.model', 'gpt-4.1-mini');

			if (!apiKey) {
				vscode.window.showErrorMessage(
					'Ariadne: No OpenAI API key configured. Set it in Settings → Ariadne.',
				);
				return;
			}

			// 4. Open the panel immediately with loading state
			const panel = vscode.window.createWebviewPanel(
				'ariadne.feedback',
				'Ariadne: Explanation',
				vscode.ViewColumn.Beside,
				{ enableScripts: true },
			);
			panel.webview.html = buildFeedbackPanelHtml(vulnMetadata);

			// 5. Read the active Java file content
			const activeEditor = vscode.window.activeTextEditor;
			const activeFileContent = activeEditor?.document.getText() ?? '';
			const activeFilePath = activeEditor?.document.uri.fsPath ?? '';

			try {
				// 6. Serialize → Call LLM → Parse response
				const requestBody = serializePayload(vulnMetadata, activeFileContent, activeFilePath, model);
				const rawResponse = await callLLM(requestBody, apiKey);
				const sections = parseThreeSectionResponse(rawResponse);

				// 7. Build FeedbackFinding — combines input metadata with LLM text
				const finding: FeedbackFinding = {
					type: vuln.title,
					cwe: vuln.cwe,
					owasp: vuln.owaspRef ?? '',
					severity: vuln.severity,
					path: vuln.filePath,
					line: vuln.line,
					...sections,
				};

				// 8. Send result to WebView
				panel.webview.postMessage({ type: 'llm-result', finding });
			} catch (error: unknown) {
				// 9. Send fallback message on error (UC-3.4)
				const message = error instanceof Error ? error.message : 'Unknown error';
				console.error('[Ariadne] LLM pipeline error:', message);
				panel.webview.postMessage({
					type: 'llm-error',
					message: `Ariadne could not retrieve an explanation: ${message}`,
				});
			}
		},
	);

	context.subscriptions.push(
		disposable,
		activeVulnsDisposable,
		sessionMetricsDisposable,
		openFeedbackPanel,
	);

	runSession();
}

// This method is called when your extension is deactivated
export function deactivate(): void {
	return undefined;
}