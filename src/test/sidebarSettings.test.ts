import * as assert from 'assert';
import { buildSignInPanelHtml } from '../modules/feedback/views/signInPanel.js';
import { buildActiveVulnerabilitiesHtml } from '../modules/presentation/views/activeVulnerabilities.js';
import type { SignInPanelViewModel } from '../modules/feedback/auth/authTypes.js';
import { DEFAULT_COPILOT_MODEL } from '../modules/feedback/settings/extensionSettings.js';
import {
	INIT_RULE_SCRIPT_ARGS,
	RESET_RULE_SCRIPT_ARGS,
} from '../modules/rules/ruleScriptCommands.js';

function signedOutModel(
	overrides: Partial<SignInPanelViewModel> = {},
): SignInPanelViewModel {
	return {
		status: 'signed-out',
		hasConsent: false,
		analyticsConsent: false,
		settings: {
			copilotModel: DEFAULT_COPILOT_MODEL,
			rulesPresent: false,
		},
		...overrides,
	};
}

function signedInModel(
	overrides: Partial<SignInPanelViewModel> = {},
): SignInPanelViewModel {
	return {
		status: 'signed-in',
		accountLabel: 'student@github',
		signedInAt: Date.parse('2026-09-14T08:00:00Z'),
		analyticsConsent: true,
		copilotUsage: {
			label: 'Premium interactions',
			remainingPercent: 72,
			usedPercent: 28,
			isUnlimited: false,
			resetDate: '2026-10-01',
		},
		settings: {
			copilotModel: DEFAULT_COPILOT_MODEL,
			rulesPresent: true,
		},
		...overrides,
	};
}

describe('Sidebar settings accordion', () => {
	it('renders Account, Scripting, and Session accordion sections', () => {
		const html = buildSignInPanelHtml(signedOutModel());

		assert.ok(html.includes('id="accordion-account"'), 'Account accordion missing');
		assert.ok(html.includes('id="accordion-scripting"'), 'Scripting accordion missing');
		assert.ok(html.includes('id="accordion-session"'), 'Session accordion missing');
		assert.match(html, /<summary[^>]*>\s*Account/);
		assert.match(html, /<summary[^>]*>\s*Scripting/);
		assert.match(html, /<summary[^>]*>\s*Session/);
	});

	it('opens the Account section by default', () => {
		const html = buildSignInPanelHtml(signedOutModel());
		assert.match(html, /id="accordion-account"[^>]*\sopen/);
	});

	it('does not expose a Copilot model picker', () => {
		const html = buildSignInPanelHtml(signedInModel());
		assert.ok(!html.includes('copilot-model-select'));
		assert.ok(!html.includes('update-copilot-model'));
	});

	it('shows a locked Gemini Flash label in Account', () => {
		const html = buildSignInPanelHtml(signedInModel());
		assert.ok(html.includes('Gemini Flash'));
		assert.strictEqual(DEFAULT_COPILOT_MODEL, 'gemini-3.5-flash');
		assert.ok(!/other models are not/i.test(html));
		assert.ok(!/not available/i.test(html));
	});

	it('keeps only one accordion section name so opening one closes another', () => {
		const html = buildSignInPanelHtml(signedOutModel());
		assert.equal(
			(html.match(/name="ariadne-settings"/g) ?? []).length,
			3,
		);
	});

	it('requires separate Terms of Use and Privacy Policy checkboxes', () => {
		const html = buildSignInPanelHtml(signedOutModel());
		assert.ok(html.includes('id="terms-checkbox"'));
		assert.ok(html.includes('id="privacy-checkbox"'));
		assert.match(html, /Terms of Use/);
		assert.match(html, /Privacy Policy/);
		assert.ok(!html.includes('id="analytics-checkbox"'));
	});

	it('shows Copilot token usage when signed in', () => {
		const html = buildSignInPanelHtml(signedInModel());
		assert.ok(html.includes('72% remaining') || html.includes('remainingPercent'));
		assert.ok(html.includes('28% used') || html.includes('usage-bar-fill'));
	});

	it('requires sign-in to use the whole extension, not only AI feedback', () => {
		const html = buildSignInPanelHtml(signedOutModel());
		assert.ok(
			/sign in with GitHub/i.test(html),
			'Sign-in button missing',
		);
		assert.ok(
			/scanning|rule scripts|use Ariadne/i.test(html),
			'Signed-out copy should mention extension use, not only AI feedback',
		);
	});

	it('renders initialize and reset rule-script buttons', () => {
		const html = buildSignInPanelHtml(signedInModel());
		assert.ok(html.includes('id="init-rules-btn"'));
		assert.ok(html.includes('id="reset-rules-btn"'));
		assert.match(html, /Initialize rule scripts/i);
		assert.match(html, /Reset rule scripts/i);
	});

	it('disables scripting actions while signed out', () => {
		const html = buildSignInPanelHtml(signedOutModel());
		assert.match(html, /id="init-rules-btn"[^>]*disabled/);
		assert.match(html, /id="reset-rules-btn"[^>]*disabled/);
	});

	it('enables scripting actions while signed in', () => {
		const html = buildSignInPanelHtml(signedInModel());
		assert.ok(!/id="init-rules-btn"[^>]*disabled/.test(html));
		assert.ok(!/id="reset-rules-btn"[^>]*disabled/.test(html));
	});

	it('keeps the Session section as placeholders', () => {
		const html = buildSignInPanelHtml(signedInModel());
		assert.ok(/coming soon|placeholder/i.test(html));
		assert.ok(!html.includes('id="clear-session-btn"'));
	});
});

describe('Active Vulnerabilities signed-out state', () => {
	it('asks the user to sign in instead of showing an all-clear empty state', () => {
		const html = buildActiveVulnerabilitiesHtml([], { signedIn: false });
		assert.match(html, /Sign in required/i);
		assert.ok(!html.includes('No active vulnerabilities'));
		assert.ok(!html.includes('You are all clear'));
	});

	it('shows the all-clear empty state when signed in with no findings', () => {
		const html = buildActiveVulnerabilitiesHtml([], { signedIn: true });
		assert.ok(html.includes('No active vulnerabilities'));
		assert.ok(!/Sign in required/i.test(html));
	});
});

describe('Rule script CLI contract', () => {
	it('initializes rule scripts with ariadne init', () => {
		assert.deepStrictEqual([...INIT_RULE_SCRIPT_ARGS], ['init']);
	});

	it('resets rule scripts with ariadne init --force', () => {
		assert.deepStrictEqual([...RESET_RULE_SCRIPT_ARGS], ['init', '--force']);
	});
});
