// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';
import { registerDocumentEvents } from './modules/detection/bridge/documentEvents';

// ── UC-2.2: Hover Popup Vulnerability Summary Display ─────────────────
import { DiagnosticManager } from './modules/presentation/diagnostics/DiagnosticManager';
import { registerHoverProvider } from './modules/presentation/diagnostics/HoverProvider';
import { getMockFindings } from './modules/presentation/mock/mockFindings';

// ── Presentation layer ────────────────────────────────────────────────
import { buildActiveVulnerabilitiesHtml } from './modules/presentation/views/activeVulnerabilities';
import { buildSessionMetricsHtml } from './modules/presentation/views/sessionMetrics';

// ── Data layer (mock) ─────────────────────────────────────────────────
// TODO: Replace these imports with real API calls when the backend is ready.
import {
	mockVulnerabilities,
	mockSessionMetrics,
} from './modules/presentation/mock/mockData';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "ariadne-extension-vscode" is now active!',
	);

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
	activeVulnsProvider.setBadgeCount(mockVulnerabilities.length);
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

	context.subscriptions.push(
		disposable,
		activeVulnsDisposable,
		sessionMetricsDisposable,
	);

	const session = runSession();
	registerDocumentEvents(context, session);
	context.subscriptions.push({ dispose: () => session.kill() });

	// ── UC-2.2: Hover Popup wiring ──────────────────────────────────────
	const diagnosticManager = new DiagnosticManager(context);
	registerHoverProvider(context, diagnosticManager);

	/** Analyses a document if it is a Java file. */
	function analyseIfJava(document: vscode.TextDocument): void {
		if (document.languageId === 'java') {
			const findings = getMockFindings(document);
			diagnosticManager.refresh(document, findings);
		}
	}

	// Run immediately for any Java file already open on startup.
	if (vscode.window.activeTextEditor) {
		analyseIfJava(vscode.window.activeTextEditor.document);
	}

	// Re-run whenever a new document is opened or the active tab changes.
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(analyseIfJava),
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				analyseIfJava(editor.document);
			}
		}),
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
