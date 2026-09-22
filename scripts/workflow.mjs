#!/usr/bin/env node

/**
 * workflow.mjs
 *
 * Agentic workflow CLI for the Ariadne VSCode extension.
 *
 * Usage:
 *   npm run workflow -- scaffold --slug <topic>
 *   npm run workflow -- scaffold --slug <topic> --artifacts bundle --reason "<why>"
 *   npm run workflow -- status
 *   npm run workflow -- check
 *   npm run workflow -- finalize
 */

import { parseArgs } from 'node:util';
import { relative } from 'node:path';
import {
	scaffold,
	check,
	finalize,
	findActiveTasks,
	parseTaskBrief,
	ensureWorkflowDirs,
} from './workflow-lib.mjs';

// ── CLI parsing ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
	printHelp();
	process.exit(0);
}

// Strip the command from args before parseArgs
const commandArgs = args.slice(1);

try {
	switch (command) {
		case 'scaffold':
			runScaffold(commandArgs);
			break;
		case 'status':
			runStatus();
			break;
		case 'check':
			runCheck();
			break;
		case 'finalize':
			runFinalize();
			break;
		default:
			console.error(`❌ Unknown command: "${command}"\n`);
			printHelp();
			process.exit(1);
	}
} catch (err) {
	console.error(`\n❌ ${err.message}\n`);
	process.exit(1);
}

// ── Command implementations ───────────────────────────────────────────

function runScaffold(argv) {
	const { values } = parseArgs({
		args: argv,
		options: {
			slug: { type: 'string' },
			artifacts: { type: 'string', default: 'brief' },
			reason: { type: 'string' },
		},
		strict: true,
	});

	if (!values.slug) {
		console.error('❌ --slug is required.\n');
		console.log('Usage: npm run workflow -- scaffold --slug <topic>');
		console.log('       npm run workflow -- scaffold --slug <topic> --artifacts bundle --reason "<why>"');
		process.exit(1);
	}

	const created = scaffold(values.slug, {
		artifacts: values.artifacts,
		reason: values.reason,
	});

	console.log('\n✅ Scaffolded:');
	for (const [kind, filePath] of Object.entries(created)) {
		console.log(`   ${kind}: ${rel(filePath)}`);
	}
	console.log('');
}

function runStatus() {
	const active = findActiveTasks();

	if (active.length === 0) {
		console.log('\n📋 No active task briefs.\n');
		return;
	}

	console.log(`\n📋 Active task briefs (${active.length}):\n`);
	for (const taskPath of active) {
		const brief = parseTaskBrief(taskPath);
		console.log(`   📄 ${brief.fileName}`);
		console.log(`      status:      ${brief.status ?? '(not set)'}`);
		console.log(`      next action: ${brief.nextAction ?? '(not set)'}`);
		console.log(`      blockers:    ${brief.blockers ?? '(not set)'}`);
		if (brief.spec && brief.spec !== 'none') {
			console.log(`      spec:        ${brief.spec}`);
		}
		if (brief.plan && brief.plan !== 'none') {
			console.log(`      plan:        ${brief.plan}`);
		}
		console.log('');
	}
}

function runCheck() {
	const result = check();
	console.log(`\n${result.message}`);

	if (!result.ok) {
		for (const r of result.results) {
			console.log(`\n   📄 ${r.file}`);
			for (const e of r.errors) {
				console.log(`      ⚠️  ${e}`);
			}
		}
		console.log('');
		process.exit(1);
	}
	console.log('');
}

function runFinalize() {
	const result = finalize();

	if (result.archived.length === 0 && result.skipped.length === 0) {
		console.log('\n📋 No active task briefs to finalize.\n');
		return;
	}

	if (result.archived.length > 0) {
		console.log('\n✅ Archived:');
		for (const f of result.archived) {
			console.log(`   📄 ${f}`);
		}
	}

	if (result.skipped.length > 0) {
		console.log('\n⏭️  Skipped (not completed):');
		for (const f of result.skipped) {
			console.log(`   📄 ${f}`);
		}
	}
	console.log('');
}

// ── Helpers ───────────────────────────────────────────────────────────

function rel(absPath) {
	return relative(process.cwd(), absPath).replace(/\\/g, '/');
}

function printHelp() {
	console.log(`
Ariadne Workflow CLI

Usage:
  npm run workflow -- <command> [options]

Commands:
  scaffold    Create a new task brief (and optionally a spec + plan bundle)
  status      Show active task briefs
  check       Validate active task briefs have required fields
  finalize    Archive completed task briefs

Scaffold options:
  --slug <topic>          Topic slug (required, e.g. "fix-bridge-parsing")
  --artifacts <type>      "brief" (default) or "bundle" (task + spec + plan)
  --reason "<text>"       Reason for the bundle (required when --artifacts bundle)

Examples:
  npm run workflow -- scaffold --slug fix-bridge-parsing
  npm run workflow -- scaffold --slug code-lens-provider --artifacts bundle --reason "crosses modules"
  npm run workflow -- status
  npm run workflow -- check
  npm run workflow -- finalize
`);
}
