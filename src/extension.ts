// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';

// ── Presentation layer ────────────────────────────────────────────────
import { buildActiveVulnerabilitiesHtml } from './modules/presentation/views/activeVulnerabilities';
import { buildSessionMetricsHtml } from './modules/presentation/views/sessionMetrics';

// ── Feedback panel ────────────────────────────────────────────────────
import { buildFeedbackPanelHtml } from './modules/feedback/views/feedbackPanel.js';

// ── Data layer (mock) ─────────────────────────────────────────────────
// The view builders above are decoupled from the data source — only this
// section needs to change when the backend is ready.
import {
	mockVulnerabilities,
	mockSessionMetrics,
} from './modules/presentation/mock/mockData';
import { mockFeedbackFindings } from './modules/feedback/mock/mockData.js';

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

	const openFeedbackPanel = vscode.commands.registerCommand(
		'ariadne-extension-vscode.openFeedbackPanel',
		(cwe?: string, title?: string) => {
			const finding =
				mockFeedbackFindings.find(
					(item) => item.cwe === cwe || item.type === title,
				) ?? mockFeedbackFindings[0];

			const panel = vscode.window.createWebviewPanel(
				'ariadne.feedback',
				'Ariadne: Explanation',
				vscode.ViewColumn.Beside,
				{ enableScripts: false },
			);

			panel.webview.html = buildFeedbackPanelHtml(finding);
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