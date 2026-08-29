import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import * as vscode from 'vscode';
import { resolveAriadneExecutable } from '../core/ariadneExecutable';

const DEBOUNCE_MS = 400;
const DIAGNOSTIC_SOURCE = 'ariadne-rules';

export interface CheckDiagnostic {
	file?: string | null;
	line?: number | null;
	message: string;
}

export interface CheckReport {
	ok: boolean;
	errors: CheckDiagnostic[];
}

/**
 * Syntax highlighting is contributed via TextMate. This module underlines
 * script parse errors on the faulty line.
 */
export function registerRuleLanguage(
	context: vscode.ExtensionContext,
): void {
	const collection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
	context.subscriptions.push(collection);

	let timer: ReturnType<typeof setTimeout> | null = null;
	let running = false;
	let queued = false;
	let queuedReload = false;

	const lint = async (reloadIfValid: boolean): Promise<void> => {
		if (running) {
			queued = true;
			queuedReload = queuedReload || reloadIfValid;
			return;
		}
		running = true;
		try {
			const report = await invokeCheck({ overlayDirty: !reloadIfValid });
			applyDiagnostics(collection, report);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			await publishSpawnFailure(collection, message);
		} finally {
			running = false;
			if (queued) {
				const reload = queuedReload;
				queued = false;
				queuedReload = false;
				void lint(reload);
			}
		}
	};

	const scheduleLint = (): void => {
		if (timer) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			timer = null;
			void lint(false);
		}, DEBOUNCE_MS);
	};

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((doc) => {
			if (isAriadneDoc(doc)) {
				void lint(true);
			}
		}),
		vscode.workspace.onDidOpenTextDocument((doc) => {
			if (isAriadneDoc(doc)) {
				scheduleLint();
			}
		}),
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.contentChanges.length === 0) {
				return;
			}
			if (isAriadneDoc(event.document)) {
				scheduleLint();
			}
		}),
	);

	const watcher = vscode.workspace.createFileSystemWatcher('**/*.ariadne');
	watcher.onDidCreate(() => { void lint(true); });
	watcher.onDidChange(() => { void lint(true); });
	watcher.onDidDelete(() => { void lint(true); });
	context.subscriptions.push(watcher);

	if (workspaceHasRules()) {
		void lint(false);
	}
}

function isAriadneDoc(doc: vscode.TextDocument): boolean {
	return doc.languageId === 'ariadne' || doc.uri.fsPath.endsWith('.ariadne');
}

function workspaceHasRules(): boolean {
	return (vscode.workspace.workspaceFolders ?? []).some((folder) =>
		existsSync(join(folder.uri.fsPath, 'rules', 'main.ariadne')),
	);
}

function applyDiagnostics(
	collection: vscode.DiagnosticCollection,
	report: CheckReport,
): void {
	collection.clear();
	if (report.ok || report.errors.length === 0) {
		return;
	}

	const byFile = new Map<string, vscode.Diagnostic[]>();
	for (const err of report.errors) {
		const file = err.file?.trim();
		if (!file) {
			continue;
		}
		const uri = vscode.Uri.file(file);
		const line = Math.max(0, (err.line ?? 1) - 1);
		const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
		const diagnostic = new vscode.Diagnostic(
			range,
			err.message,
			vscode.DiagnosticSeverity.Error,
		);
		diagnostic.source = DIAGNOSTIC_SOURCE;
		const list = byFile.get(uri.toString()) ?? [];
		list.push(diagnostic);
		byFile.set(uri.toString(), list);
	}

	for (const [uriString, diagnostics] of byFile) {
		collection.set(vscode.Uri.parse(uriString), diagnostics);
	}
}

async function publishSpawnFailure(
	collection: vscode.DiagnosticCollection,
	message: string,
): Promise<void> {
	collection.clear();
	const root = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (!root) {
		return;
	}
	const main = vscode.Uri.joinPath(root, 'rules', 'main.ariadne');
	try {
		await vscode.workspace.fs.stat(main);
	} catch {
		return;
	}
	const diagnostic = new vscode.Diagnostic(
		new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER),
		message,
		vscode.DiagnosticSeverity.Error,
	);
	diagnostic.source = DIAGNOSTIC_SOURCE;
	collection.set(main, [diagnostic]);
}

async function invokeCheck(options: { overlayDirty: boolean }): Promise<CheckReport> {
	const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!root) {
		return { ok: true, errors: [] };
	}

	let projectRoot = root;
	let overlayRoot: string | undefined;
	if (options.overlayDirty) {
		overlayRoot = writeDirtyOverlay(root);
		if (overlayRoot) {
			projectRoot = overlayRoot;
		}
	}

	try {
		const report = await spawnCheck(projectRoot);
		if (overlayRoot) {
			remapOverlayPaths(report, overlayRoot, root);
		}
		return report;
	} finally {
		if (overlayRoot) {
			rmSync(overlayRoot, { recursive: true, force: true });
		}
	}
}

function remapOverlayPaths(report: CheckReport, overlayRoot: string, workspaceRoot: string): void {
	const overlayRules = join(overlayRoot, 'rules');
	const workspaceRules = join(workspaceRoot, 'rules');
	for (const err of report.errors) {
		if (!err.file) {
			continue;
		}
		if (err.file.startsWith(overlayRules) || err.file.startsWith(overlayRoot)) {
			const rel = relative(overlayRules, err.file);
			err.file = join(workspaceRules, rel);
		}
	}
}

function writeDirtyOverlay(workspaceRoot: string): string | undefined {
	const rulesDir = join(workspaceRoot, 'rules');
	if (!existsSync(join(rulesDir, 'main.ariadne'))) {
		return undefined;
	}
	const dirty = vscode.workspace.textDocuments.filter(
		(doc) => isAriadneDoc(doc) && doc.isDirty && doc.uri.fsPath.startsWith(rulesDir),
	);
	if (dirty.length === 0) {
		return undefined;
	}

	const overlayRoot = realpathSync(mkdtempSync(join(tmpdir(), 'ariadne-lint-')));
	cpSync(rulesDir, join(overlayRoot, 'rules'), { recursive: true });
	for (const doc of dirty) {
		const rel = relative(rulesDir, doc.uri.fsPath);
		writeFileSync(join(overlayRoot, 'rules', rel), doc.getText());
	}
	return overlayRoot;
}

function spawnCheck(projectRoot: string): Promise<CheckReport> {
	const exe = resolveAriadneExecutable();
	return new Promise((resolve, reject) => {
		const proc = spawn(exe, ['check', '--path', projectRoot], { cwd: projectRoot });
		let stdout = '';
		let stderr = '';
		proc.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		proc.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		proc.on('error', (err) => {
			reject(new Error(
				`Could not run \`${exe}\`: ${err.message}. Set ariadne.executable, or cargo-build ariadne-core.`,
			));
		});
		proc.on('close', () => {
			const trimmed = stdout.trim();
			if (!trimmed) {
				reject(new Error(stderr.trim() || `\`${exe} check\` produced no output`));
				return;
			}
			try {
				const parsed = JSON.parse(trimmed) as CheckReport;
				if (!Array.isArray(parsed.errors)) {
					parsed.errors = [];
				}
				resolve(parsed);
			} catch {
				reject(new Error(`ariadne check returned invalid JSON: ${trimmed}`));
			}
		});
	});
}
