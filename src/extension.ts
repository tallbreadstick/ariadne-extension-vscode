import * as vscode from 'vscode';
import { join } from 'node:path';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';
import { registerDocumentEvents } from './modules/detection/bridge/documentEvents';
import { registerRuleLanguage } from './modules/rules/ruleDiagnostics';
import {
	metadataToVulnerability,
	metadataToScanSnapshot,
	groupFindingsByFile,
} from './modules/detection/bridge/convert';

// ── Presentation layer ────────────────────────────────────────────────
import { DiagnosticManager } from './modules/presentation/diagnostics/DiagnosticManager';
import { registerHoverProvider } from './modules/presentation/diagnostics/HoverProvider';
import { buildActiveVulnerabilitiesHtml, buildVulnKey } from './modules/presentation/views/activeVulnerabilities';
import { buildSessionMetricsHtml } from './modules/tracker/views/sessionMetrics';

// ── Feedback panel (LLM-powered) ──────────────────────────────────────
import { buildFeedbackPanelHtml } from './modules/feedback/views/feedbackPanel.js';
import { buildSignInPanelHtml } from './modules/feedback/views/signInPanel.js';
import { buildTermsOfUseHtml } from './modules/feedback/views/termsOfUsePanel.js';
import { GitHubAuthService } from './modules/feedback/auth/githubAuthService.js';
import type { AuthPanelState, SignInPanelViewModel } from './modules/feedback/auth/authTypes.js';
import {
	COPILOT_MODEL_OPTIONS,
	DEFAULT_COPILOT_MODEL,
	type SidebarSettingsViewModel,
} from './modules/feedback/settings/extensionSettings.js';
import { fetchCopilotQuotaUsage } from './modules/feedback/auth/copilotQuota.js';
import { CopilotClientManager } from './modules/feedback/llm_request/copilotClientManager.js';
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

async function focusSignInSidebar(): Promise<void> {
	await vscode.commands.executeCommand('workbench.view.extension.ariadne-sidebar');
	await vscode.commands.executeCommand('ariadne.sidebar.signIn.focus');
}

function copilotRuntimeOptions(
	context: vscode.ExtensionContext,
	gitHubToken: string,
): {
	gitHubToken: string;
	copilotHome: string;
	extensionPath: string;
} {
	return {
		gitHubToken,
		copilotHome: join(context.globalStorageUri.fsPath, 'copilot'),
		extensionPath: context.extensionPath,
	};
}

function getSidebarSettings(): SidebarSettingsViewModel {
	const config = vscode.workspace.getConfiguration('ariadne');
	return {
		copilotModel: config.get<string>('copilot.model', DEFAULT_COPILOT_MODEL),
		copilotModelOptions: COPILOT_MODEL_OPTIONS,
	};
}

function isCopilotModel(value: string): value is typeof COPILOT_MODEL_OPTIONS[number] {
	return (COPILOT_MODEL_OPTIONS as readonly string[]).includes(value);
}
function resolveExpandedVulnKey(
	vulns: Vulnerability[],
	store: SessionStore,
): string | undefined {
	const stored = store.loadExpandedVulnKey();
	if (!stored) {
		return undefined;
	}
	const validKeys = new Set(vulns.map(buildVulnKey));
	if (!validKeys.has(stored)) {
		void store.saveExpandedVulnKey(undefined);
		return undefined;
	}
	return stored;
}

function buildVulnsHtml(vulns: Vulnerability[], store: SessionStore): string {
	return buildActiveVulnerabilitiesHtml(vulns, {
		expandedKey: resolveExpandedVulnKey(vulns, store),
	});
}

// ─────────────────────────────────────────────────────────────────────
// ACTIVATE
// ─────────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {

	// ── Session persistence layer ──────────────────────────────────────
	const store = new SessionStore(context);
	const githubAuth = new GitHubAuthService(context);
	const copilotManager = new CopilotClientManager();

	let latestSignInHtml = buildSignInPanelHtml({
		status: 'loading',
		settings: getSidebarSettings(),
	});

	const refreshSignInPanel = async (
		signInProvider: AriadneViewProvider,
		override?: AuthPanelState,
	): Promise<void> => {
		const settings = getSidebarSettings();
		let model: SignInPanelViewModel = {
			...(override ?? await githubAuth.getPanelViewModel()),
			settings,
		};

		if (model.status === 'signed-in' && !override) {
			const token = await githubAuth.getAccessToken();
			if (token) {
				const usage = await fetchCopilotQuotaUsage(
					copilotManager,
					copilotRuntimeOptions(context, token),
				);
				if (usage) {
					model = {
						...model,
						copilotUsage: {
							label: usage.label,
							remainingPercent: usage.remainingPercent,
							usedPercent: usage.usedPercent,
							isUnlimited: usage.isUnlimited,
							resetDate: usage.resetDate,
						},
					};
				}
			}
		}

		latestSignInHtml = buildSignInPanelHtml(model);
		signInProvider.updateHtml(latestSignInHtml);
	};

	// ── Restore UI from stored snapshots (survives VS Code restarts) ────
	const storedSnapshots = store.loadSnapshots();

	let latestVulnerabilities: Vulnerability[] = [];

	let initialVulnsHtml = buildVulnsHtml([], store);
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
			initialVulnsHtml = buildVulnsHtml(restoredVulns, store);
		} catch {
			// If stored data is corrupted, start fresh
			console.warn('[Ariadne] Could not restore session from stored snapshots.');
		}
	}

	// ── Panel providers ────────────────────────────────────────────────
	const activeVulnsProvider = new AriadneViewProvider(
		initialVulnsHtml,
		(msg) => {
			if (msg.type === 'vuln-expanded') {
				const key = msg.key === null || msg.key === undefined
					? undefined
					: String(msg.key);
				void store.saveExpandedVulnKey(key);
			}
		},
	);
	activeVulnsProvider.setResolveHtml(() =>
		buildVulnsHtml(latestVulnerabilities, store),
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

	const signInProvider = new AriadneViewProvider(
		latestSignInHtml,
		async (msg) => {
			if (msg.type === 'github-sign-in') {
				await refreshSignInPanel(signInProvider, { status: 'signing-in' });
				try {
					await githubAuth.signIn({
						termsAccepted: msg.termsAccepted === true,
						analyticsConsent: msg.analyticsConsent === true,
					});
					await refreshSignInPanel(signInProvider);
					const token = await githubAuth.getAccessToken();
					if (token) {
						copilotManager.prewarm(copilotRuntimeOptions(context, token));
					}
					vscode.window.showInformationMessage(
						'Ariadne: Signed in to GitHub. AI feedback will use your Copilot allowance.',
					);
				} catch (error: unknown) {
					const message =
						error instanceof Error ? error.message : 'GitHub sign-in failed.';
					await refreshSignInPanel(signInProvider, {
						status: 'error',
						errorMessage: message,
					});
				}
				return;
			}

			if (msg.type === 'github-sign-out') {
				await refreshSignInPanel(signInProvider, {
					status: 'signed-out',
					hasConsent: false,
					analyticsConsent: false,
				});
				try {
					await githubAuth.signOut();
					await copilotManager.dispose();
					await refreshSignInPanel(signInProvider);
					vscode.window.showInformationMessage('Ariadne: Signed out of GitHub.');
				} catch (error: unknown) {
					const message =
						error instanceof Error ? error.message : 'GitHub sign-out failed.';
					vscode.window.showErrorMessage(`Ariadne: ${message}`);
				}
				return;
			}

			if (msg.type === 'github-auth-refresh') {
				await refreshSignInPanel(signInProvider);
				return;
			}

			if (msg.type === 'update-copilot-model' && typeof msg.model === 'string') {
				if (isCopilotModel(msg.model)) {
					const config = vscode.workspace.getConfiguration('ariadne');
					await config.update(
						'copilot.model',
						msg.model,
						vscode.ConfigurationTarget.Global,
					);
				}
				await refreshSignInPanel(signInProvider);
			}
		},
	);
	signInProvider.setResolveHtml(() => latestSignInHtml);
	void (async () => {
		await githubAuth.initialize();
		await refreshSignInPanel(signInProvider);
	})();

	const signInDisposable = vscode.window.registerWebviewViewProvider(
		'ariadne.sidebar.signIn',
		signInProvider,
	);

	context.subscriptions.push(
		githubAuth.onDidChangeAuth(() => {
			void refreshSignInPanel(signInProvider);
		}),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('ariadne.copilot.model')) {
				void refreshSignInPanel(signInProvider);
			}
		}),
		{ dispose: () => { void copilotManager.dispose(); } },
	);

	void githubAuth.isAuthenticated().then(async (signedIn) => {
		if (!signedIn) {
			return;
		}
		const token = await githubAuth.getAccessToken();
		if (token) {
			copilotManager.prewarm(copilotRuntimeOptions(context, token));
		}
	});

	// ── Diagnostic / inline highlight manager ───────────────────────────
	const diagnosticManager = new DiagnosticManager(context);
	registerHoverProvider(context, diagnosticManager);

	// ── Latest known findings (needed for feedback panel lookup) ────────

	// ── Ariadne engine session ───────────────────────────────────────────
	const session = runSession();
	registerDocumentEvents(context, session);
	registerRuleLanguage(context);

	// ── Wire findings from the engine to every UI surface ───────────────
	session.onFindings(async (findings: VulnerabilityMetadata[]) => {
		// ── 1. Active Vulnerabilities panel ─────────────────────────────
		const vulns = findings.map(metadataToVulnerability);
		latestVulnerabilities = vulns;
		activeVulnsProvider.updateHtml(buildVulnsHtml(vulns, store));
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
	const openSignInPanel = vscode.commands.registerCommand(
		'ariadne-extension-vscode.openSignInPanel',
		async () => {
			await focusSignInSidebar();
		},
	);

	const openTermsOfUse = vscode.commands.registerCommand(
		'ariadne-extension-vscode.openTermsOfUse',
		() => {
			const panel = vscode.window.createWebviewPanel(
				'ariadne.termsOfUse',
				'Ariadne: Terms of Use',
				vscode.ViewColumn.One,
				{ enableScripts: false },
			);
			panel.webview.html = buildTermsOfUseHtml();
		},
	);

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

			const isSignedIn = await githubAuth.isAuthenticated();
			if (!isSignedIn) {
				await focusSignInSidebar();
				vscode.window.showInformationMessage(
					'Ariadne: Sign in to GitHub to use AI vulnerability explanations.',
				);
				return;
			}

			const gitHubToken = await githubAuth.getAccessToken();
			if (!gitHubToken) {
				vscode.window.showErrorMessage(
					'Ariadne: Could not retrieve your GitHub session. Please sign in again.',
				);
				return;
			}

			const config = vscode.workspace.getConfiguration('ariadne');
			const model = config.get<string>('copilot.model', 'gemini-3.5-flash');

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
				const rawResponse = await callLLM(requestBody, {
					...copilotRuntimeOptions(context, gitHubToken),
					clientManager: copilotManager,
				});
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
		signInDisposable,
		openSignInPanel,
		openTermsOfUse,
		openFeedbackPanel,
	);
}

export function deactivate(): void {
	return undefined;
}
