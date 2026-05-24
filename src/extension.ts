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
import { createAriadneStatusBarItem, updateStatusBar } from './modules/tracker/views/statusBar';
import { showSessionToasts } from './modules/tracker/views/notificationToast.js';
import { analyzeSession, toSessionMetrics } from './modules/tracker/analysis/snapshotAnalyzer.js';
import { SessionStore } from './modules/tracker/storage/sessionStore.js';
import type { Vulnerability } from './modules/presentation/panelTypes.js';

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

	// ── Session persistence layer ──────────────────────────────────────
	const store = new SessionStore(context);

	// ── Restore UI from stored snapshots (survives VS Code restarts) ────
	const storedSnapshots = store.loadSnapshots();

	let latestVulnerabilities: Vulnerability[] = [];

	let initialVulnsHtml = buildActiveVulnerabilitiesHtml([]);
	let initialMetricsHtml = buildSessionMetricsHtml({
		critical: 0, high: 0, medium: 0, low: 0,
		trends: { persistingPatterns: 0, improvingTrends: 0, resolvedThisSession: 0 },
	});

	if (storedSnapshots.length > 0) {
		try {
			const restoredAnalysis = analyzeSession(storedSnapshots);
			const restoredMetrics = toSessionMetrics(restoredAnalysis);

			// Filter out previously dismissed notifications
			const dismissed = new Set(store.loadDismissedNotifications());
			if (restoredMetrics.notifications) {
				restoredMetrics.notifications = restoredMetrics.notifications
					.filter(n => !dismissed.has(n.id));
			}

			initialMetricsHtml = buildSessionMetricsHtml(restoredMetrics);

			// Restore active vulnerabilities from the latest scan's findings
			const latestScan = storedSnapshots[storedSnapshots.length - 1];
			const restoredVulns = latestScan.vulnerabilities.flatMap((v, vi) =>
				v.instances.flatMap((inst, ii) =>
					inst.occurrences.map((occ, oi) => metadataToVulnerability({
						type: v.type,
						cwe_id: v.cwe_id,
						owasp_category: v.owasp_category,
						severity: v.severity,
						file_path: occ.file_path,
						line_number: occ.line_number,
						rule_id: v.rule_id,
						column_number: occ.column_number,
						taint_trace: occ.taint_trace,
						instance_name: inst.name,
						instance_kind: inst.kind,
					}, vi * 100 + ii * 10 + oi)),
			),
			);
			latestVulnerabilities = restoredVulns;
			initialVulnsHtml = buildActiveVulnerabilitiesHtml(restoredVulns);
		} catch {
			// If stored data is corrupted, start fresh
			console.warn('[Ariadne] Could not restore session from stored snapshots.');
		}
	}

	// ── Panel providers ────────────────────────────────────────────────
	const activeVulnsProvider = new AriadneViewProvider(initialVulnsHtml);
	activeVulnsProvider.setResolveHtml(() =>
		buildActiveVulnerabilitiesHtml(latestVulnerabilities, true),
	);
	const sessionMetricsProvider = new AriadneViewProvider(
		initialMetricsHtml,
		// Handle dismiss-notification messages from the Session Metrics webview.
		(msg) => {
			if (msg.type === 'dismiss-notification' && typeof msg.notifId === 'string') {
				store.dismissNotification(msg.notifId);
			}
		},
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

	// ── Ariadne engine session ───────────────────────────────────────────
	const session = runSession();
	registerDocumentEvents(context, session);

	// ── Wire findings from the engine to every UI surface ───────────────
	session.onFindings(async (findings: VulnerabilityMetadata[]) => {
		// ── 1. Active Vulnerabilities panel ─────────────────────────────
		const vulns = findings.map(metadataToVulnerability);
		latestVulnerabilities = vulns;
		activeVulnsProvider.updateHtml(buildActiveVulnerabilitiesHtml(vulns));
		activeVulnsProvider.setBadgeCount(vulns.length);

		// ── 2. Persist scan snapshot ──────────────────────────────────────
		const scanId = await store.nextScanId();
		const snapshot = metadataToScanSnapshot(findings, scanId);
		await store.appendSnapshot(snapshot);

		// ── 3. Session Metrics panel ─────────────────────────────────────
		try {
			const scanHistory = store.loadSnapshots();
			const sessionAnalysis = analyzeSession(scanHistory);
			const sessionMetrics = toSessionMetrics(sessionAnalysis);

			// Filter out previously dismissed notifications
			const dismissed = new Set(store.loadDismissedNotifications());
			if (sessionMetrics.notifications) {
				sessionMetrics.notifications = sessionMetrics.notifications
					.filter(n => !dismissed.has(n.id));
			}

			sessionMetricsProvider.updateHtml(buildSessionMetricsHtml(sessionMetrics));
			updateStatusBar(sessionAnalysis);

			// ── 3b. VS Code toast notifications (UC-4.3) ────────────────
			// Fire-and-forget: each category is independently throttled
			// with a 60 s cooldown to prevent notification flooding.
			showSessionToasts(sessionAnalysis);

			// Debug: log analysis results
			const sc = sessionAnalysis.severityCounts;
			console.log(
				`[Ariadne Analysis] Severities: ` +
				`${sc.critical}C ${sc.high}H ${sc.medium}M ${sc.low}L | ` +
				`Persisting: ${sessionAnalysis.persistingPatterns}, ` +
				`Improving: ${sessionAnalysis.improvingTrends}, ` +
				`Resolved: ${sessionAnalysis.resolvedThisSession}, ` +
				`New: ${sessionAnalysis.newVulnerabilities}`,
			);
		} catch {
			// analyzeSession throws on empty array (guarded above, but be safe)
		}

		// ── 3. Inline squiggles + diagnostics ────────────────────────────
		// Eagerly publish diagnostics for ALL files with findings so that
		// the native Problems Panel stays in sync with the Active
		// Vulnerabilities webview — even for files not currently open.
		// Decorations (squiggles) are applied lazily when the tab is opened.
		const byFile = groupFindingsByFile(findings);
		diagnosticManager.publishAllDiagnostics(byFile);
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
			const model = config.get<string>('openai.model', 'gpt-5.5');

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

	// ── Status bar — create once, updated via updateStatusBar() ─────────
	// If we have stored snapshots, initialise with the restored analysis;
	// otherwise show a neutral "Ariadne" label until the first scan.
	if (storedSnapshots.length > 0) {
		try {
			const restoredAnalysis = analyzeSession(storedSnapshots);
			context.subscriptions.push(createAriadneStatusBarItem(restoredAnalysis));
		} catch {
			context.subscriptions.push(createAriadneStatusBarItem());
		}
	} else {
		context.subscriptions.push(createAriadneStatusBarItem());
	}

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
