import * as vscode from 'vscode';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { AriadneViewProvider } from './modules/presentation/AriadneViewProvider';
import { runSession } from './modules/detection/bridge/iostream';
import {
	registerDocumentEvents,
	flushAllPendingUpdates,
	cancelAllPendingUpdates,
	isTrackedDocument,
} from './modules/detection/bridge/documentEvents';
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
	classifyFinding,
} from './modules/tracker/analysis/lifecycleEngine.js';
import { SessionStore } from './modules/tracker/storage/sessionStore.js';
import type { SaveScanState } from './modules/tracker/storage/sessionStore.js';
import type { FindingLifecycleRecord } from './modules/tracker/analysis/lifecycleTypes.js';
import { computeCommonVulnerabilities } from './modules/tracker/analysis/commonVulnerabilities.js';
import type {
	Vulnerability,
	SessionMetrics,
	CommonVulnerabilityItem,
	ImprovingSubItem,
} from './modules/presentation/panelTypes.js';
import type { SessionAnalysis } from './modules/tracker/analysis/analysisTypes.js';
import { getCurrentRevision } from './modules/detection/bridge/revisionTracker.js';
import { computeCategoryScores, computeTrendScore, formatTrendDelta, trendLabel } from './modules/tracker/analysis/scoreCalculator.js';

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

function getWorkspaceFileContent(filePath: string): string | undefined {
	const normalized = filePath.replace(/\\/g, '/').toLowerCase();
	const openDoc = vscode.workspace.textDocuments.find(doc => {
		return doc.uri.fsPath.replace(/\\/g, '/').toLowerCase() === normalized ||
			doc.fileName.replace(/\\/g, '/').toLowerCase() === normalized;
	});
	if (openDoc) {
		return openDoc.getText();
	}
	if (fs.existsSync(filePath)) {
		try {
			return fs.readFileSync(filePath, 'utf-8');
		} catch {
			return undefined;
		}
	}
	return undefined;
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
export async function activate(context: vscode.ExtensionContext): Promise<void> {

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

	// ── Save-scan settlement state ─────────────────────────────────────
	// Load persisted state (first-checkpoint tracking + cancellation count)
	let saveScanState: SaveScanState = store.loadSaveScanState();

	// The workspace revision recorded at the moment the save scan Analyze
	// IPC was sent. Null when no save scan is in flight.
	let pendingSaveRevision: number | null = null;

	// Active 2-second settlement timer handle. Non-null while waiting.
	let settlementTimer: ReturnType<typeof setTimeout> | null = null;

	// The findings received from a valid (but not yet settled) save scan.
	// Held until the timer expires or is cancelled.
	let pendingSettlementFindings: import('./modules/feedback/vulnerability_results/vulnerabilityTypes.js').VulnerabilityMetadata[] | null = null;

	// 1. Recover any cleanly finalized session persisted synchronously to disk during deactivation
	const pendingFinalized = await store.recoverPendingFinalizedSession();

	// 2. If no pending finalized session was recovered, check if an unfinalized session exists
	// (e.g. VS Code crashed or closed abruptly before deactivation could run).
	// In that case, recover it as incomplete per Section 9 of the trends framework.
	if (!pendingFinalized) {
		const staleSession = store.loadActiveSession();
		if (staleSession) {
			const recovered = finalizeSession(staleSession, lifecycles, Date.now(), 'incomplete');
			void store.appendCompletedSession(recovered);
			void store.clearActiveSession();
			console.log(`[Ariadne] Recovered unfinalized session ${staleSession.sessionId} as 'incomplete'.`);
		}
	}

	// Save-scan settlement state is session-scoped. Since we start with no
	// active session, ensure initialCheckpointDoneAt is reset so the first
	// settled save triggers session start + initial checkpoint together.
	if (saveScanState.initialCheckpointDoneAt !== null) {
		saveScanState.initialCheckpointDoneAt = null;
		saveScanState.totalSaveScansThisSession = 0;
		void store.saveSaveScanState(saveScanState);
	}

	// Session is created lazily on the first settled save scan, so that
	// SessionRecord.startedAt matches the initial checkpoint timestamp exactly.
	// Until then, activeSession is null and no lifecycle or Trends writes occur.
	let activeSession: ReturnType<typeof startSession> | null = null;
	let lastSettledRevision: number | null = null;

	let latestVulnerabilities: Vulnerability[] = [];
	let previousScanSnapshot = null as import('./modules/feedback/vulnerability_results/vulnerabilityTypes.js').ScanSnapshot | null;
	let latestSessionAnalysis: SessionAnalysis | null = null;

	function buildCurrentSessionMetrics(): SessionMetrics {
		const completedSessions = store.loadCompletedSessions();
		const priorCompletedSession = store.loadPriorCompletedSession();
		const graduationHistory = store.loadGraduationHistory();
		const totalSessionsAnalyzed = completedSessions.length + (activeSession ? 1 : 0);

		const commonVulns = computeCommonVulnerabilities(
			completedSessions,
			activeSession,
			lifecycles,
			graduationHistory,
		);

		if (latestSessionAnalysis) {
			const metrics = toSessionMetrics(latestSessionAnalysis, commonVulns, totalSessionsAnalyzed);
			if (latestVulnerabilities.length > 0) {
				metrics.critical = latestVulnerabilities.filter(v => v.severity === 'critical').length;
				metrics.high = latestVulnerabilities.filter(v => v.severity === 'high').length;
				metrics.medium = latestVulnerabilities.filter(v => v.severity === 'medium').length;
				metrics.low = latestVulnerabilities.filter(v => v.severity === 'low').length;
			}
			const dismissed = new Set(store.loadDismissedNotifications());
			if (metrics.notifications) {
				metrics.notifications = metrics.notifications.filter(n => !dismissed.has(n.id));
			}
			return metrics;
		}

		let critical = 0;
		let high = 0;
		let medium = 0;
		let low = 0;

		if (latestVulnerabilities.length > 0) {
			for (const v of latestVulnerabilities) {
				if (v.severity === 'critical') { critical++; }
				else if (v.severity === 'high') { high++; }
				else if (v.severity === 'medium') { medium++; }
				else if (v.severity === 'low') { low++; }
			}
		} else if (lifecycles.length > 0) {
			for (const flc of lifecycles) {
				if (flc.durableResolutionAt === null) {
					if (flc.severity === 'critical') { critical++; }
					else if (flc.severity === 'high') { high++; }
					else if (flc.severity === 'medium') { medium++; }
					else if (flc.severity === 'low') { low++; }
				}
			}
		} else if (priorCompletedSession?.finalCheckpoint?.findings) {
			for (const f of priorCompletedSession.finalCheckpoint.findings) {
				if (f.severity === 'critical') { critical++; }
				else if (f.severity === 'high') { high++; }
				else if (f.severity === 'medium') { medium++; }
				else if (f.severity === 'low') { low++; }
			}
		}

		let persistingPatterns = 0;
		let improvingTrends = 0;
		let resolvedThisSession = 0;
		let recurringPatterns = 0;

		const persistingMap = new Map<string, number>();
		const recurringMap = new Map<string, number>();
		const resolvedMap = new Map<string, number>();
		const improvingMap = new Map<string, ImprovingSubItem>();

		// ── Per-type aggregation for improving detection ──────────────
		// Track resolved vs active counts per vulnerability type so we
		// can detect "improving" at the type level (some instances fixed,
		// some still active).
		const typeResolvedCount = new Map<string, number>();
		const typePersistingCount = new Map<string, number>();
		const typeTotalCount = new Map<string, number>();

		for (const flc of lifecycles) {
			// Count per-type totals for improving detection
			typeTotalCount.set(flc.type, (typeTotalCount.get(flc.type) ?? 0) + 1);

			if (flc.lifecycleState === 'recurring') {
				recurringPatterns++;
				recurringMap.set(flc.type, (recurringMap.get(flc.type) ?? 0) + 1);
			} else if (flc.lifecycleState === 'resolved' || flc.durableResolutionAt !== null) {
				const isResolvedInActiveSession = activeSession !== null
					&& flc.durableResolutionAt !== null
					&& flc.durableResolutionAt >= activeSession.startedAt;
				if (isResolvedInActiveSession) {
					resolvedThisSession++;
					resolvedMap.set(flc.type, (resolvedMap.get(flc.type) ?? 0) + 1);
					typeResolvedCount.set(flc.type, (typeResolvedCount.get(flc.type) ?? 0) + 1);
				}
			} else if (flc.lifecycleState === 'persisting') {
				persistingPatterns++;
				persistingMap.set(flc.type, (persistingMap.get(flc.type) ?? 0) + 1);
				typePersistingCount.set(flc.type, (typePersistingCount.get(flc.type) ?? 0) + 1);
			} else if (flc.lifecycleState === 'improving') {
				typePersistingCount.set(flc.type, (typePersistingCount.get(flc.type) ?? 0) + 1);
			}
		}

		// ── Type-level improving detection ───────────────────────────
		// A vulnerability type is "improving" when it has at least one
		// resolved instance AND at least one still-persisting instance.
		// Recurring findings are regressions (relapses), never improving trends.
		for (const [type, resolved] of typeResolvedCount.entries()) {
			const persisting = typePersistingCount.get(type) ?? 0;
			const total = typeTotalCount.get(type) ?? 0;
			if (resolved > 0 && persisting > 0) {
				improvingTrends += persisting; // count improving instances
				const progressRatio = resolved / total;
				const delta = Math.round(progressRatio * 10 * 100) / 100;
				const label = progressRatio >= 0.7 ? 'Major progress'
					: progressRatio >= 0.4 ? 'Clear progress'
					: 'Some progress';
				improvingMap.set(type, {
					type,
					instances: persisting,
					progressLabel: label,
					progressDelta: formatTrendDelta(delta),
				});
				persistingPatterns = Math.max(0, persistingPatterns - persisting);
				persistingMap.delete(type);
			}
		}

		const persistingItems = persistingMap.size > 0
			? Array.from(persistingMap.entries()).map(([type, instances]) => ({ type, instances }))
			: undefined;
		const recurringItems = recurringMap.size > 0
			? Array.from(recurringMap.entries()).map(([type, instances]) => ({ type, instances }))
			: undefined;
		const resolvedItems = resolvedMap.size > 0
			? Array.from(resolvedMap.entries()).map(([type, instances]) => ({ type, instances }))
			: undefined;
		const improvingItems = improvingMap.size > 0
			? Array.from(improvingMap.values())
			: undefined;

		const fixScore = priorCompletedSession?.finalScores?.f;
		const persistenceScore = priorCompletedSession?.finalScores?.p;
		const trendScore = priorCompletedSession?.finalScores?.t ?? null;
		const trendLabelText = trendScore !== null && trendLabel(trendScore) !== null
			? `${trendLabel(trendScore)} (${formatTrendDelta(trendScore)})`
			: undefined;

		const commonItems: CommonVulnerabilityItem[] = [];
		for (const entry of commonVulns.values()) {
			commonItems.push({
				type: entry.type,
				cweId: entry.cweId,
				sessionCount: entry.sessionCount,
				totalSessions: entry.totalSessions,
				activeFindingCount: entry.activeFindingCount,
			});
		}

		return {
			critical,
			high,
			medium,
			low,
			trends: {
				persistingPatterns,
				improvingTrends,
				resolvedThisSession,
				recurringPatterns,
				persistingItems,
				improvingItems,
				recurringItems,
				resolvedItems,
				fixScore,
				persistenceScore,
				trendScore,
				trendLabel: trendLabelText,
			},
			notifications: undefined,
			commonVulnerabilities: commonItems.length > 0 ? commonItems : undefined,
			totalSessionsAnalyzed,
		};
	}

	function refreshSessionMetricsPanel(): void {
		const metrics = buildCurrentSessionMetrics();
		sessionMetricsProvider.updateHtml(buildSessionMetricsHtml(metrics));
	}

	let initialVulnsHtml = buildVulnsHtml([], store);
	let initialMetricsHtml = buildSessionMetricsHtml(buildCurrentSessionMetrics());

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
	sessionMetricsProvider.setResolveHtml(() =>
		buildSessionMetricsHtml(buildCurrentSessionMetrics()),
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

	// ── Settlement helpers ──────────────────────────────────────────────

	/**
	 * Cancels any active settlement timer and discards the pending
	 * findings. Called when a tracked-file change invalidates the
	 * save scan result before the 2-second window expires.
	 */
	function cancelSettlement(reason: string): void {
		if (settlementTimer !== null) {
			clearTimeout(settlementTimer);
			settlementTimer = null;
			pendingSettlementFindings = null;
			pendingSaveRevision = null;
			saveScanState.totalSettledCancellations += 1;
			void store.saveSaveScanState(saveScanState);
			console.log(`[Ariadne] Settlement cancelled (${reason}). Trends not updated.`);
		}
	}

	// ── Ariadne engine session ───────────────────────────────────────────
	const session = runSession();
	registerDocumentEvents(
		context,
		session,
		// onSaveTrigger: record the revision at the moment of save
		(revision: number) => {
			// If a previous settlement timer is still running, cancel it:
			// the new save supersedes the old pending result.
			cancelSettlement('superseded by a new save');
			pendingSaveRevision = revision;
		},
		// onRevisionChange: any tracked-file mutation cancels settlement
		(revision: number) => {
			if (settlementTimer !== null) {
				cancelSettlement(`workspace revision changed to ${revision}`);
			}
		},
	);
	registerRuleLanguage(context);

	// ── Wire findings from the engine to every UI surface ───────────────
	session.onFindings(async (findings: VulnerabilityMetadata[]) => {
		// ── 1. Active Vulnerabilities panel (always updated) ────────────
		const vulns = findings.map(metadataToVulnerability);
		latestVulnerabilities = vulns;
		activeVulnsProvider.updateHtml(buildVulnsHtml(vulns, store));
		activeVulnsProvider.setBadgeCount(vulns.length);

		// ── 2. Session Metrics panel (always updated on live scan) ──────
		refreshSessionMetricsPanel();

		// ── 3. Inline squiggles + diagnostics (always updated) ──────────
		const byFile = groupFindingsByFile(findings);
		diagnosticManager.publishAllDiagnostics(byFile);

		// ── 3. Valid-gate ────────────────────────────────────────────────
		// Only results from a pending save scan are candidates for Trends.
		if (pendingSaveRevision === null) {
			// Live-edit result — UI already updated above, done.
			console.log(
				`[Ariadne Live Scan] Evaluated ${findings.length} findings ` +
				`(${vulns.length} active vulnerabilities displayed).`,
			);
			return;
		}

		// Check whether the workspace revision is still the same as when
		// the save scan was sent. If not, the result is stale.
		const currentRev = getCurrentRevision();
		if (currentRev !== pendingSaveRevision) {
			console.log(
				`[Ariadne] Stale save result discarded ` +
				`(scan revision=${pendingSaveRevision}, current revision=${currentRev}).`,
			);

			pendingSaveRevision = null;
			return;
		}

		// Result is valid. Consume the pending revision.
		pendingSaveRevision = null;

		// Store findings for the settlement callback and start the timer.
		pendingSettlementFindings = findings;

		// ── 4. Settlement timer — 2-second idle window ──────────────────
		// We wait 2 seconds with no tracked-file change. If any change
		// arrives, cancelSettlement() fires and discards these findings.
		// If the timer expires cleanly, the result is settled.
		settlementTimer = setTimeout(async () => {
			settlementTimer = null;
			const settledFindings = pendingSettlementFindings;
			pendingSettlementFindings = null;

			if (!settledFindings) {
				return; // Defensive guard — shouldn't happen.
			}

			lastSettledRevision = getCurrentRevision();
			console.log('[Ariadne] Save scan settled — updating lifecycle and Session Metrics.');

			// ── 4a. Build scan snapshot ─────────────────────────────────
			const scanId = await store.nextScanId();
			const currentSnapshot = metadataToScanSnapshot(settledFindings, scanId);

			// ── 4b. Lifecycle engine ─────────────────────────────────────
			const observedFindings = metadataToObservedFindings(settledFindings);
			const timestamp = Date.now();

			// ── 4c. Session record — create or update ───────────────────
			if (!activeSession) {
				// First settlement: create the session NOW, using the
				// settlement timestamp so startedAt === initialCheckpointDoneAt.
				const priorCompletedSession = store.loadPriorCompletedSession();
				activeSession = startSession(store.nextSessionId(), timestamp, priorCompletedSession);
				setSessionBaseline(activeSession, observedFindings, timestamp);
				updateSessionLatest(activeSession, observedFindings, timestamp);
				saveScanState.initialCheckpointDoneAt = timestamp;
				const priorInfo = priorCompletedSession
					? ` (prior completed baseline: ${priorCompletedSession.sessionId})`
					: ' (no prior completed baseline; T=N/A)';
				console.log(
					`[Ariadne] Initial checkpoint + session ${activeSession.sessionId} ` +
					`started at ${new Date(timestamp).toISOString()}${priorInfo} ` +
					`(${settledFindings.length} finding(s))`,
				);
			} else {
				// Subsequent settlements: just update the existing session.
				updateSessionLatest(activeSession, observedFindings, timestamp);
			}
			// Persist the updated session so debug dumps reflect current state.
			void store.saveActiveSession(activeSession);

			// ── 4d. Lifecycle engine ──────────────────────────────────────
			const result = processObservation(
				observedFindings,
				lifecycles,
				timestamp,
				true,
				getWorkspaceFileContent,
			);
			lifecycles = result.lifecycles;

			// Persist updated lifecycles (serialized via write queue)
			void store.saveFindingLifecycles(lifecycles);

			saveScanState.totalSaveScansThisSession += 1;
			void store.saveSaveScanState(saveScanState);

			// ── 4e. Session Metrics panel ─────────────────────────────────
			try {
				const sessionAnalysis = buildSessionAnalysis(
					result.classifications,
					currentSnapshot,
					previousScanSnapshot,
					lifecycles,
					activeSession?.trendComparisonByKey,
					activeSession?.startedAt,
				);
				latestSessionAnalysis = sessionAnalysis;

				// ── 4e. Common Vulnerabilities ────────────────────────────
				const completedSessions = store.loadCompletedSessions();
				const graduationHistory = store.loadGraduationHistory();
				const commonVulns = computeCommonVulnerabilities(
					completedSessions,
					activeSession,
					lifecycles,
					graduationHistory,
				);
				void store.saveGraduationHistory(graduationHistory);

				refreshSessionMetricsPanel();
				updateStatusBar(sessionAnalysis);

				// ── 4e. VS Code toast notifications ──────────────────────
				showSessionToasts(sessionAnalysis);

				// Debug: log analysis results
				const sc = sessionAnalysis.severityCounts;
				const scoreInfo = sessionAnalysis.scores
					? ` | F=${sessionAnalysis.scores.f.toFixed(2)} P=${sessionAnalysis.scores.p.toFixed(2)} T=${sessionAnalysis.scores.tLive !== null ? sessionAnalysis.scores.tLive.toFixed(2) : 'N/A'}${sessionAnalysis.scores.tLabel ? ` (${sessionAnalysis.scores.tLabel})` : ''}`
					: '';
				console.log(
					`[Ariadne Analysis] Severities: ` +
					`${sc.critical}C ${sc.high}H ${sc.medium}M ${sc.low}L | ` +
					`Persisting: ${sessionAnalysis.persistingPatterns}, ` +
					`Improving: ${sessionAnalysis.improvingTrends}, ` +
					`Resolved: ${sessionAnalysis.resolvedThisSession}, ` +
					`Recurring: ${sessionAnalysis.recurringPatterns}` +
					scoreInfo,
				);

				// Debug: log common vulnerabilities
				const gradCount = Object.keys(graduationHistory).length;
				if (commonVulns.size > 0) {
					const cvEntries = [...commonVulns.values()]
						.map(cv => `${cv.type} (${cv.cweId}): ${cv.sessionCount}/${cv.totalSessions} sessions, ${cv.activeFindingCount} active`)
						.join('; ');
					console.log(
						`[Ariadne Common Vulns] ${commonVulns.size} common type(s): ${cvEntries} | ${gradCount} graduated type(s)`,
					);
				} else {
					console.log(
						`[Ariadne Common Vulns] No common types (${completedSessions.length + (activeSession ? 1 : 0)} session(s) analyzed, ${gradCount} graduated)`,
					);
				}
			} catch {
				// buildSessionAnalysis guards are in place, but be safe
			}

			// Track previous snapshot for the next save cycle
			previousScanSnapshot = currentSnapshot;
		}, 2000);
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
				if (sessionData.priorCompletedSessionId) {
					console.log(`  Prior Baseline: ${sessionData.priorCompletedSessionId}`);
				}
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
				const priorBaselineLine = s.priorCompletedSessionId
					? `\n  │ Prior Baseline  : ${s.priorCompletedSessionId}`
					: '';
				console.log(
					`\n  ┌─ ${s.sessionId} ──────────────────────────────` +
					`\n  │ Status          : ${(s.status ?? (s.endedAt ? 'completed' : 'active')).toUpperCase()}` +
					priorBaselineLine +
					`\n  │ Started At      : ${new Date(s.startedAt).toISOString()}` +
					`\n  │ Ended At        : ${s.endedAt ? new Date(s.endedAt).toISOString() : '(not finalized)'}` +
					`\n  │ Duration        : ${duration}` +
					`\n  │ Baseline Chkpt  : ${baselineCount} finding(s)${s.baselineCheckpoint ? ` at ${new Date(s.baselineCheckpoint.timestamp).toISOString()}` : ''}` +
					`\n  │ Final Chkpt     : ${finalCount} finding(s)${s.finalCheckpoint ? ` at ${new Date(s.finalCheckpoint.timestamp).toISOString()}` : ''}` +
				`\n  │ Lifecycles      : ${s.lifecycleSummaries.length}` +
					(s.finalScores
						? `\n  │ Final Scores    : F=${s.finalScores.f.toFixed(2)} P=${s.finalScores.p.toFixed(2)} T=${s.finalScores.t !== null ? s.finalScores.t.toFixed(2) : 'N/A'}`
						: ''),
				);
				for (const lc of s.lifecycleSummaries) {
					const lcStatus = (lc.lifecycleState ?? classifyFinding(lc, s.endedAt ?? Date.now())).toUpperCase();
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

				const status = (lc.lifecycleState ?? classifyFinding(lc, Date.now())).toUpperCase();

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

			// ── Live Scores ──
			if (lifecycles.length > 0) {
				const catResult = computeCategoryScores(lifecycles);
				const tResult = computeTrendScore(lifecycles, activeSession?.trendComparisonByKey);

				console.log('\n── Scores ──');
				console.log(`  Workspace F    : ${catResult.aggregate.f.toFixed(2)} / 10`);
				console.log(`  Workspace P    : ${catResult.aggregate.p.toFixed(2)} / 10`);
				if (tResult) {
					const label = trendLabel(tResult.workspaceT);
					console.log(`  Workspace T    : ${formatTrendDelta(tResult.workspaceT)}${label ? ` (${label})` : ''}`);
					if (activeSession?.priorCompletedSessionId) {
						console.log(`  Prior Session  : ${activeSession.priorCompletedSessionId}`);
					}
				} else {
					console.log(`  Workspace T    : N/A (first session)`);
				}

				console.log('\n  By Type:');
				for (const [key, ts] of catResult.byType) {
					const tForKey = tResult?.byKey[key];
					const tStr = tForKey !== undefined ? formatTrendDelta(tForKey) : 'N/A';
					console.log(
						`    ${ts.type} (${ts.cweId})  ` +
						`F=${ts.f.toFixed(2)}  P=${ts.p.toFixed(2)}  T=${tStr}  ` +
						`[${ts.durablyResolved}/${ts.totalEverObserved} resolved]`,
					);
				}
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
			activeSession = null;
			await store.clearSaveScanState();
			saveScanState = store.loadSaveScanState();
			console.log('[Ariadne Debug] All lifecycle data cleared. Session will start on next settled save.');
			vscode.window.showInformationMessage(
				'Ariadne Debug: All data cleared. Next settled save will start a fresh session and initial checkpoint.',
			);
		},
	);

	// ── Debug command — show save scan state ──────────────────────────
	const debugShowSaveScanState = vscode.commands.registerCommand(
		'ariadne-extension-vscode.debugShowSaveScanState',
		() => {
			const state = store.loadSaveScanState();
			const currentRev = getCurrentRevision();

			console.log('╔══════════════════════════════════════════════════════════╗');
			console.log('║        ARIADNE — SAVE SCAN STATE DEBUG DUMP             ║');
			console.log('╚══════════════════════════════════════════════════════════╝');
			console.log(`  Initial Checkpoint      : ${state.initialCheckpointDoneAt
				? new Date(state.initialCheckpointDoneAt).toISOString()
				: '(not yet set — no settled scan has been processed)'
				}`);
			console.log(`  Settled Scans (session) : ${state.totalSaveScansThisSession}`);
			console.log(`  Settlement Cancellations: ${state.totalSettledCancellations}`);
			console.log(`  Workspace Revision      : ${currentRev}`);
			console.log(`  Pending Save Revision   : ${pendingSaveRevision !== null ? pendingSaveRevision : '(none)'
				}`);
			console.log(`  Settlement Timer Active : ${settlementTimer !== null}`);
			console.log('═══════════════════════════════════════════════════════════');

			const checkpointStr = state.initialCheckpointDoneAt
				? `set at ${new Date(state.initialCheckpointDoneAt).toISOString()}`
				: 'not yet set';
			vscode.window.showInformationMessage(
				`Ariadne Debug: Initial checkpoint ${checkpointStr}. ` +
				`Settled scans: ${state.totalSaveScansThisSession}. ` +
				`Cancellations: ${state.totalSettledCancellations}. ` +
				`Workspace revision: ${currentRev}. ` +
				`See Developer Console for details.`,
			);
		},
	);

	// ── Debug command — reset save scan state ─────────────────────────
	const debugResetSaveScanState = vscode.commands.registerCommand(
		'ariadne-extension-vscode.debugResetSaveScanState',
		async () => {
			// Cancel any active settlement before clearing state
			if (settlementTimer !== null) {
				clearTimeout(settlementTimer);
				settlementTimer = null;
				pendingSettlementFindings = null;
			}
			pendingSaveRevision = null;
			await store.clearSaveScanState();
			saveScanState = store.loadSaveScanState();
			if (activeSession !== null) {
				const finalized = finalizeSession(activeSession, lifecycles, Date.now());
				void store.appendCompletedSession(finalized);
				void store.clearActiveSession();
				activeSession = null;
			}
			console.log('[Ariadne Debug] Save scan state reset. Next settled save will re-trigger the initial checkpoint.');
			vscode.window.showInformationMessage(
				'Ariadne Debug: Save scan state reset. Next settled save will re-trigger the initial checkpoint.',
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
		debugShowSaveScanState,
		debugResetSaveScanState,
	);

	// ── Deactivation Coordinator ─────────────────────────────────────────
	deactivationHandler = async (): Promise<void> => {
		console.log('[Ariadne] Deactivating extension...');

		// 1. Cancel active timers
		cancelSettlement('extension deactivation');
		cancelAllPendingUpdates();

		// 2. If no session was ever started, just shut down the engine
		if (!activeSession) {
			console.log('[Ariadne] No active session was started during this run.');
			session.kill();
			return;
		}

		const currentRev = getCurrentRevision();
		const hasDirtyTrackedDocs = vscode.workspace.textDocuments.some(
			doc => doc.isDirty && isTrackedDocument(doc),
		);

		// Case A: Clean workspace — no modifications since last settled save
		if (lastSettledRevision !== null && currentRev === lastSettledRevision && !hasDirtyTrackedDocs) {
			console.log(`[Ariadne] Clean deactivation: finalizing session ${activeSession.sessionId} as 'completed'...`);
			const timestamp = Date.now();
			const finalized = finalizeSession(activeSession, lifecycles, timestamp, 'completed');
			store.saveFinalizedSessionSync(finalized);
			void store.appendCompletedSession(finalized);
			void store.clearActiveSession();
			saveScanState.initialCheckpointDoneAt = null;
			saveScanState.totalSaveScansThisSession = 0;
			void store.saveSaveScanState(saveScanState);
			console.log(`[Ariadne] Session ${activeSession.sessionId} finalized cleanly as 'completed'.`);
			session.kill();
			return;
		}

		// Case B: Workspace has unsaved edits or un-settled changes
		// Flush pending editor buffers to Rust engine and attempt final scan
		console.log(
			`[Ariadne] Workspace has un-settled edits ` +
			`(revision=${currentRev}, lastSettled=${lastSettledRevision}, dirty=${hasDirtyTrackedDocs}). ` +
			`Requesting final session scan...`,
		);
		flushAllPendingUpdates(session);

		try {
			const finalFindings = await new Promise<VulnerabilityMetadata[]>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Final session scan timed out (4000ms)'));
				}, 4000);

				const sub = session.onFindings((findings) => {
					clearTimeout(timeout);
					sub.dispose();
					resolve(findings);
				});

				session.send({ type: 'Analyze', path: null });
			});

			const timestamp = Date.now();
			const observed = metadataToObservedFindings(finalFindings);
			updateSessionLatest(activeSession, observed, timestamp);

			const result = processObservation(
				observed,
				lifecycles,
				timestamp,
				true,
				getWorkspaceFileContent,
			);
			lifecycles = result.lifecycles;
			void store.saveFindingLifecycles(lifecycles);

			const finalized = finalizeSession(activeSession, lifecycles, timestamp, 'completed');
			store.saveFinalizedSessionSync(finalized);
			void store.appendCompletedSession(finalized);
			void store.clearActiveSession();
			console.log(`[Ariadne] Final scan completed. Session ${activeSession.sessionId} finalized as 'completed'.`);
		} catch (err) {
			console.warn(
				`[Ariadne] Final scan failed during deactivation ` +
				`(${err instanceof Error ? err.message : String(err)}). Marking session 'incomplete'.`,
			);
			const timestamp = Date.now();
			const incomplete = finalizeSession(activeSession, lifecycles, timestamp, 'incomplete');
			store.saveFinalizedSessionSync(incomplete);
			void store.appendCompletedSession(incomplete);
			void store.clearActiveSession();
		} finally {
			saveScanState.initialCheckpointDoneAt = null;
			saveScanState.totalSaveScansThisSession = 0;
			void store.saveSaveScanState(saveScanState);
			session.kill();
		}
	};
}

let deactivationHandler: (() => Promise<void>) | null = null;

export async function deactivate(): Promise<void> {
	if (deactivationHandler) {
		await deactivationHandler();
		deactivationHandler = null;
	}
}
