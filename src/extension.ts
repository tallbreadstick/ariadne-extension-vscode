import * as vscode from 'vscode';
import { join } from 'node:path';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';
import { registerDocumentEvents } from './modules/detection/bridge/documentEvents';
import { registerRuleLanguage } from './modules/rules/ruleDiagnostics';
import {
	metadataToVulnerability,
	metadataToScanSnapshot,
	metadataToObservedFindings,
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
import { sanitizeLlmError } from './modules/feedback/llm_request/sanitizeError.js';
import type { VulnerabilityMetadata } from './modules/feedback/vulnerability_results/vulnerabilityTypes.js';
import type { FeedbackFinding } from './modules/feedback/llm_feedback/feedbackTypes.js';

// ── Tracker (lifecycle engine + views) ────────────────────────────────
import { createAriadneStatusBarItem, updateStatusBar } from './modules/tracker/views/statusBar';
import { showSessionToasts } from './modules/tracker/views/notificationToast.js';
import { buildSessionAnalysis, toSessionMetrics } from './modules/tracker/analysis/snapshotAnalyzer.js';
import {
	processObservation,
	startSession,
	setSessionBaseline,
	updateSessionLatest,
	finalizeSession,
} from './modules/tracker/analysis/lifecycleEngine.js';
import { SessionStore } from './modules/tracker/storage/sessionStore.js';
import type { FindingLifecycleRecord } from './modules/tracker/analysis/lifecycleTypes.js';
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

	// ── Migrate from legacy snapshot storage ───────────────────────────
	void store.migrateFromLegacy();

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

	// ── Initialize lifecycle state ─────────────────────────────────────
	let lifecycles: FindingLifecycleRecord[] = store.loadFindingLifecycles();

	// If a previous active session exists (e.g. VS Code reloaded before
	// deactivation could persist), finalize it now and start fresh.
	const staleSession = store.loadActiveSession();
	if (staleSession) {
		const finalized = finalizeSession(staleSession, lifecycles, Date.now());
		void store.appendCompletedSession(finalized);
		void store.clearActiveSession();
		console.log(`[Ariadne] Finalized stale session ${staleSession.sessionId} from previous activation.`);
	}

	// Start a new active session
	let activeSession = startSession(store.nextSessionId(), Date.now());
	void store.saveActiveSession(activeSession);

	let latestVulnerabilities: Vulnerability[] = [];
	let previousScanSnapshot = null as import('./modules/feedback/vulnerability_results/vulnerabilityTypes.js').ScanSnapshot | null;

	let initialVulnsHtml = buildVulnsHtml([], store);
	let initialMetricsHtml = buildSessionMetricsHtml({
		critical: 0, high: 0, medium: 0, low: 0,
		trends: { persistingPatterns: 0, improvingTrends: 0, resolvedThisSession: 0 },
	});

	// Restore UI from lifecycle data if available
	if (lifecycles.length > 0) {
		console.log(`[Ariadne] Restored ${lifecycles.length} finding lifecycle(s) from storage.`);
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

		// ── 2. Build scan snapshot (kept for SessionAnalysis compatibility) ──
		const scanId = await store.nextScanId();
		const currentSnapshot = metadataToScanSnapshot(findings, scanId);

		// ── 3. Lifecycle engine — process the observation ───────────────
		const observedFindings = metadataToObservedFindings(findings);
		const timestamp = Date.now();

		// Set session baseline on first observation, update latest checkpoint
		setSessionBaseline(activeSession, observedFindings, timestamp);
		updateSessionLatest(activeSession, observedFindings, timestamp);

		const result = processObservation(
			observedFindings,
			lifecycles,
			timestamp,
		);
		lifecycles = result.lifecycles;

		// Persist updated lifecycles (serialized via write queue)
		void store.saveFindingLifecycles(lifecycles);

		// ── 4. Session Metrics panel ────────────────────────────────────
		try {
			const sessionAnalysis = buildSessionAnalysis(
				result.classifications,
				currentSnapshot,
				previousScanSnapshot,
			);

			// Filter out previously dismissed notifications
			const sessionMetrics = toSessionMetrics(sessionAnalysis);
			const dismissed = new Set(store.loadDismissedNotifications());
			if (sessionMetrics.notifications) {
				sessionMetrics.notifications = sessionMetrics.notifications
					.filter(n => !dismissed.has(n.id));
			}

			sessionMetricsProvider.updateHtml(buildSessionMetricsHtml(sessionMetrics));
			updateStatusBar(sessionAnalysis);

			// ── 4b. VS Code toast notifications ─────────────────────────
			showSessionToasts(sessionAnalysis);

			// Debug: log analysis results
			const sc = sessionAnalysis.severityCounts;
			console.log(
				`[Ariadne Analysis] Severities: ` +
				`${sc.critical}C ${sc.high}H ${sc.medium}M ${sc.low}L | ` +
				`Persisting: ${sessionAnalysis.persistingPatterns}, ` +
				`Improving: ${sessionAnalysis.improvingTrends}, ` +
				`Resolved: ${sessionAnalysis.resolvedThisSession}, ` +
				`Recurring: ${sessionAnalysis.recurringPatterns}`,
			);
		} catch {
			// buildSessionAnalysis guards are in place, but be safe
		}

		// Track previous snapshot for the next cycle
		previousScanSnapshot = currentSnapshot;

		// ── 5. Inline squiggles + diagnostics ───────────────────────────
		const byFile = groupFindingsByFile(findings);
		diagnosticManager.publishAllDiagnostics(byFile);
	});

	// ── Finalize session on deactivation ─────────────────────────────────
	context.subscriptions.push({
		dispose: () => {
			const finalized = finalizeSession(activeSession, lifecycles, Date.now());
			// Best-effort persist — VS Code may not await this
			void store.appendCompletedSession(finalized);
			void store.clearActiveSession();
			session.kill();
		},
	});

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

	// ── Debug command — inspect lifecycle data ────────────────────────
	const debugLifecycles = vscode.commands.registerCommand(
		'ariadne-extension-vscode.debugLifecycles',
		() => {
			const sessionData = store.loadActiveSession();
			const completedSessions = store.loadCompletedSessions();

			console.log('╔══════════════════════════════════════════════════════════╗');
			console.log('║        ARIADNE — LIFECYCLE DEBUG DUMP                   ║');
			console.log('╚══════════════════════════════════════════════════════════╝');

			// ── Active Session ──
			console.log('\n── Active Session ──');
			if (sessionData) {
				console.log(`  Session ID : ${sessionData.sessionId}`);
				console.log(`  Started At : ${new Date(sessionData.startedAt).toISOString()}`);
				console.log(`  Ended At   : ${sessionData.endedAt ? new Date(sessionData.endedAt).toISOString() : '(active)'}`);
				if (sessionData.baselineCheckpoint) {
					console.log(`  Baseline   : ${sessionData.baselineCheckpoint.findings.length} finding(s) at ${new Date(sessionData.baselineCheckpoint.timestamp).toISOString()}`);
				} else {
					console.log(`  Baseline   : (not yet captured)`);
				}
				if (sessionData.finalCheckpoint) {
					console.log(`  Final      : ${sessionData.finalCheckpoint.findings.length} finding(s) at ${new Date(sessionData.finalCheckpoint.timestamp).toISOString()}`);
				} else {
					console.log(`  Final      : (not yet captured)`);
				}
			} else {
				console.log('  (no active session)');
			}

			// ── Completed Sessions ──
			console.log(`\n── Completed Sessions: ${completedSessions.length} ──`);
			for (const s of completedSessions) {
				const duration = s.endedAt
					? `${Math.round((s.endedAt - s.startedAt) / 1000)}s`
					: '?';
				const baselineCount = s.baselineCheckpoint?.findings.length ?? 0;
				const finalCount = s.finalCheckpoint?.findings.length ?? 0;
				console.log(
					`\n  ┌─ ${s.sessionId} ──────────────────────────────` +
					`\n  │ Started At      : ${new Date(s.startedAt).toISOString()}` +
					`\n  │ Ended At        : ${s.endedAt ? new Date(s.endedAt).toISOString() : '(not finalized)'}` +
					`\n  │ Duration        : ${duration}` +
					`\n  │ Baseline Chkpt  : ${baselineCount} finding(s)${s.baselineCheckpoint ? ` at ${new Date(s.baselineCheckpoint.timestamp).toISOString()}` : ''}` +
					`\n  │ Final Chkpt     : ${finalCount} finding(s)${s.finalCheckpoint ? ` at ${new Date(s.finalCheckpoint.timestamp).toISOString()}` : ''}` +
					`\n  │ Lifecycles      : ${s.lifecycleSummaries.length}`,
				);
				for (const lc of s.lifecycleSummaries) {
					const lcStatus = lc.durableResolutionAt
						? 'RESOLVED'
						: lc.missingSince
							? 'ABSENT'
							: 'ACTIVE';
					console.log(
						`  │   [${lcStatus}] ${lc.type} (${lc.cweId}) — ${lc.instanceName || '(unnamed)'}` +
						`\n  │     Severity      : ${lc.severity}` +
						`\n  │     Rule ID       : ${lc.ruleId}` +
						`\n  │     File          : ${lc.filePath}` +
						`\n  │     Fingerprint   : ${lc.logicalFingerprint}` +
						`\n  │     Confirmations : ${lc.confirmationCount}` +
						`\n  │     Occurrences   : ${lc.baselineOccurrenceCount} → ${lc.currentOccurrenceCount}` +
						`\n  │     Recurrences   : ${lc.recurrenceCount}`,
					);
				}
				console.log(`  └──────────────────────────────────────────`);
			}

			// ── Finding Lifecycles ──
			console.log(`\n── Finding Lifecycles: ${lifecycles.length} ──`);
			for (const lc of lifecycles) {
				const age = Date.now() - lc.firstConfirmedAt;
				const ageStr = age < 60_000
					? `${Math.round(age / 1000)}s`
					: `${Math.round(age / 60_000)}m`;

				const status = lc.durableResolutionAt
					? 'RESOLVED'
					: lc.missingSince
						? 'ABSENT'
						: lc.confirmationCount >= 2 && age >= 30_000
							? 'PERSISTING'
							: 'CANDIDATE';

				console.log(
					`  [${status}] ${lc.type} (${lc.cweId}) — ${lc.instanceName || '(unnamed)'}` +
					`\n    Severity           : ${lc.severity}` +
					`\n    Rule ID            : ${lc.ruleId}` +
					`\n    File               : ${lc.filePath}` +
					`\n    Logical Fingerprint: ${lc.logicalFingerprint}` +
					`\n    Content Fingerprint: ${lc.contentFingerprint || '(empty)'}` +
					`\n    Scope Fingerprint  : ${lc.scopeFingerprint || '(empty)'}` +
					`\n    Age                : ${ageStr}` +
					`\n    First Confirmed At : ${new Date(lc.firstConfirmedAt).toISOString()}` +
					`\n    Last Confirmed At  : ${new Date(lc.lastConfirmedAt).toISOString()}` +
					`\n    Missing Since      : ${lc.missingSince ? new Date(lc.missingSince).toISOString() : '(active)'}` +
					`\n    Provisional Res.   : ${lc.provisionalResolutionAt ? new Date(lc.provisionalResolutionAt).toISOString() : '(none)'}` +
					`\n    Durable Res.       : ${lc.durableResolutionAt ? new Date(lc.durableResolutionAt).toISOString() : '(none)'}` +
					`\n    Confirmations      : ${lc.confirmationCount}` +
					`\n    Baseline Occs.     : ${lc.baselineOccurrenceCount}` +
					`\n    Current Occs.      : ${lc.currentOccurrenceCount}` +
					`\n    Recurrences        : ${lc.recurrenceCount}` +
					`\n    Toggles            : ${lc.inSessionToggleCount}` +
					`\n    Restorations       : ${lc.identicalRestorationCount}`,
				);
			}

			console.log('\n═══════════════════════════════════════════════════════════');

			vscode.window.showInformationMessage(
				`Ariadne Debug: ${lifecycles.length} lifecycle(s), ` +
				`${completedSessions.length} completed session(s). ` +
				`See Developer Console for details.`,
			);
		},
	);

	// ── Debug command — reset all lifecycle data ──────────────────────
	const debugResetLifecycles = vscode.commands.registerCommand(
		'ariadne-extension-vscode.debugResetLifecycles',
		async () => {
			await store.clearAllLifecycleData();
			lifecycles = [];
			activeSession = startSession(store.nextSessionId(), Date.now());
			void store.saveActiveSession(activeSession);
			console.log('[Ariadne Debug] All lifecycle data cleared. Fresh session started.');
			vscode.window.showInformationMessage(
				`Ariadne Debug: All data cleared. New session: ${activeSession.sessionId}`,
			);
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
				const rawMessage =
					error instanceof Error ? error.message : 'Unknown error';
				console.error('[Ariadne] LLM pipeline error:', rawMessage);
				panel.webview.postMessage({
					type: 'llm-error',
					message: sanitizeLlmError(rawMessage),
				});
			}
		},
	);

	// ── Status bar — create once, updated via updateStatusBar() ─────────
	context.subscriptions.push(createAriadneStatusBarItem());

	context.subscriptions.push(
		helloWorld,
		activeVulnsDisposable,
		sessionMetricsDisposable,
		signInDisposable,
		openSignInPanel,
		openTermsOfUse,
		openFeedbackPanel,
		debugLifecycles,
		debugResetLifecycles,
	);
}

export function deactivate(): void {
	return undefined;
}
