/**
 * workflow-lib.mjs
 *
 * Shared helpers for the Ariadne agentic workflow CLI.
 * Handles file I/O, date-stamped naming, template rendering,
 * and task brief validation.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// ── Paths ─────────────────────────────────────────────────────────────

const ROOT = process.cwd();

export const PATHS = {
	tasks: join(ROOT, 'docs', 'ai', 'tasks'),
	tasksArchive: join(ROOT, 'docs', 'ai', 'tasks', 'archive'),
	specs: join(ROOT, 'docs', 'specs'),
	specsArchive: join(ROOT, 'docs', 'specs', 'archive'),
	plans: join(ROOT, 'docs', 'plans'),
	plansArchive: join(ROOT, 'docs', 'plans', 'archive'),
	taskTemplate: join(ROOT, 'docs', 'ai', 'tasks', 'TEMPLATE.md'),
	specTemplate: join(ROOT, 'docs', 'specs', 'TEMPLATE.md'),
	planTemplate: join(ROOT, 'docs', 'plans', 'TEMPLATE.md'),
};

// ── Date helpers ──────────────────────────────────────────────────────

/** Returns today as YYYY-MM-DD in local time. */
export function today() {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

/** Builds a dated filename: YYYY-MM-DD-slug.md */
export function datedFilename(slug) {
	return `${today()}-${slug}.md`;
}

// ── Directory helpers ─────────────────────────────────────────────────

/** Ensures a directory exists (recursive). */
export function ensureDir(dir) {
	mkdirSync(dir, { recursive: true });
}

/** Ensures all workflow directories exist. */
export function ensureWorkflowDirs() {
	for (const dir of [
		PATHS.tasks,
		PATHS.tasksArchive,
		PATHS.specs,
		PATHS.specsArchive,
		PATHS.plans,
		PATHS.plansArchive,
	]) {
		ensureDir(dir);
	}
}

// ── Active task discovery ─────────────────────────────────────────────

/**
 * Returns all non-archived, non-template markdown files in docs/ai/tasks/.
 * These are considered "active" task briefs.
 */
export function findActiveTasks() {
	if (!existsSync(PATHS.tasks)) { return []; }
	return readdirSync(PATHS.tasks)
		.filter(f => f.endsWith('.md') && f !== 'TEMPLATE.md' && f !== 'README.md')
		.map(f => join(PATHS.tasks, f));
}

/**
 * Reads a task brief and extracts CLI-parsed fields.
 * Returns an object with { status, nextAction, blockers, spec, plan, filePath, fileName }.
 */
export function parseTaskBrief(filePath) {
	const content = readFileSync(filePath, 'utf-8');
	const fileName = basename(filePath);
	const lines = content.split(/\r?\n/);

	const extract = (key) => {
		// Match "- key: value" on each line (case-insensitive key match)
		const re = new RegExp(`^\\s*-\\s*${key}\\s*:\\s*(.*)$`, 'i');
		for (const line of lines) {
			const m = line.match(re);
			if (m) {
				const val = m[1].trim();
				return val || undefined;
			}
		}
		return undefined;
	};

	return {
		filePath,
		fileName,
		status: extract('status'),
		nextAction: extract('next action'),
		blockers: extract('blockers'),
		spec: extract('spec'),
		plan: extract('plan'),
		task: extract('task'),
	};
}

// ── Template rendering ────────────────────────────────────────────────

/**
 * Reads a template file and replaces the title placeholder with
 * a human-readable version of the slug.
 */
function renderTemplate(templatePath, slug) {
	if (!existsSync(templatePath)) {
		return `# ${slugToTitle(slug)}\n\n(Template not found at ${templatePath})\n`;
	}
	let content = readFileSync(templatePath, 'utf-8');

	// Replace the first heading with the slug-derived title
	content = content.replace(
		/^#\s+.+$/m,
		`# ${slugToTitle(slug)}`,
	);
	return content;
}

/** Converts a slug like "fix-bridge-parsing" to "Fix Bridge Parsing". */
function slugToTitle(slug) {
	return slug
		.split('-')
		.map(w => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

// ── Scaffold ──────────────────────────────────────────────────────────

/**
 * Creates a task brief (and optionally a spec + plan bundle).
 *
 * @param {string} slug - Topic slug (e.g. "fix-bridge-parsing")
 * @param {object} [options]
 * @param {'brief'|'bundle'} [options.artifacts='brief'] - What to create
 * @param {string} [options.reason] - Reason for creating a bundle (required when artifacts=bundle)
 * @returns {{ task: string, spec?: string, plan?: string }} Paths of created files
 */
export function scaffold(slug, options = {}) {
	const { artifacts = 'brief', reason } = options;
	ensureWorkflowDirs();

	const filename = datedFilename(slug);
	const created = {};

	// Task brief (always created)
	const taskPath = join(PATHS.tasks, filename);
	if (existsSync(taskPath)) {
		throw new Error(`Task brief already exists: ${taskPath}`);
	}
	writeFileSync(taskPath, renderTemplate(PATHS.taskTemplate, slug), 'utf-8');
	created.task = taskPath;

	// Bundle: spec + plan
	if (artifacts === 'bundle') {
		if (!reason) {
			throw new Error('--reason is required when --artifacts bundle');
		}

		const specPath = join(PATHS.specs, filename);
		if (!existsSync(specPath)) {
			let specContent = renderTemplate(PATHS.specTemplate, slug);
			specContent = specContent.replace(
				/^#\s+.+$/m,
				`# Spec: ${slugToTitle(slug)}`,
			);
			writeFileSync(specPath, specContent, 'utf-8');
			created.spec = specPath;
		}

		const planPath = join(PATHS.plans, filename);
		if (!existsSync(planPath)) {
			let planContent = renderTemplate(PATHS.planTemplate, slug);
			planContent = planContent.replace(
				/^#\s+.+$/m,
				`# ${slugToTitle(slug)} Implementation Plan`,
			);
			writeFileSync(planPath, planContent, 'utf-8');
			created.plan = planPath;
		}

		// Inject linked artifact paths into the task brief
		let taskContent = readFileSync(taskPath, 'utf-8');
		if (created.spec) {
			taskContent = taskContent.replace(
				/^(\s*-\s*spec:\s*)$/m,
				`$1docs/specs/${filename}`,
			);
		}
		if (created.plan) {
			taskContent = taskContent.replace(
				/^(\s*-\s*plan:\s*)$/m,
				`$1docs/plans/${filename}`,
			);
		}
		writeFileSync(taskPath, taskContent, 'utf-8');

		console.log(`\n📦 Bundle reason: ${reason}`);
	}

	return created;
}

// ── Check (validate) ──────────────────────────────────────────────────

/**
 * Validates that all active task briefs have the required fields filled.
 * Returns an array of { file, errors[] } for any failing briefs.
 */
export function check() {
	const active = findActiveTasks();
	if (active.length === 0) {
		return { ok: true, message: 'No active task briefs found.', results: [] };
	}

	const requiredFields = ['status', 'nextAction'];
	const results = [];

	for (const taskPath of active) {
		const brief = parseTaskBrief(taskPath);
		const errors = [];

		for (const field of requiredFields) {
			if (!brief[field] || brief[field].trim() === '') {
				errors.push(`Missing required field: "${field}"`);
			}
		}

		// Status must be a valid value
		const validStatuses = ['todo', 'in progress', 'completed'];
		if (brief.status && !validStatuses.includes(brief.status.toLowerCase())) {
			errors.push(`Invalid status "${brief.status}" — must be one of: ${validStatuses.join(', ')}`);
		}

		if (errors.length > 0) {
			results.push({ file: brief.fileName, errors });
		}
	}

	return {
		ok: results.length === 0,
		message: results.length === 0
			? `✅ All ${active.length} active task brief(s) are valid.`
			: `❌ ${results.length} task brief(s) have validation errors.`,
		results,
	};
}

// ── Finalize (archive) ────────────────────────────────────────────────

/**
 * Archives completed task briefs by moving them to the archive/ directory.
 * Only moves briefs whose status is "completed".
 *
 * @returns {{ archived: string[], skipped: string[] }}
 */
export function finalize() {
	const active = findActiveTasks();
	ensureDir(PATHS.tasksArchive);

	const archived = [];
	const skipped = [];

	for (const taskPath of active) {
		const brief = parseTaskBrief(taskPath);
		if (brief.status && brief.status.toLowerCase() === 'completed') {
			const dest = join(PATHS.tasksArchive, brief.fileName);
			renameSync(taskPath, dest);
			archived.push(brief.fileName);

			// Also archive linked spec and plan if they exist
			const specPath = join(PATHS.specs, brief.fileName);
			if (existsSync(specPath)) {
				ensureDir(PATHS.specsArchive);
				renameSync(specPath, join(PATHS.specsArchive, brief.fileName));
			}
			const planPath = join(PATHS.plans, brief.fileName);
			if (existsSync(planPath)) {
				ensureDir(PATHS.plansArchive);
				renameSync(planPath, join(PATHS.plansArchive, brief.fileName));
			}
		} else {
			skipped.push(`${brief.fileName} (status: ${brief.status ?? 'not set'})`);
		}
	}

	return { archived, skipped };
}
