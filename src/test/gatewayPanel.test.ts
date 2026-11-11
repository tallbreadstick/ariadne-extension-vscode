import * as assert from 'assert';
import {
	buildGatewayHtml,
	SECURITY_TIPS,
	type GatewayState,
} from '../modules/presentation/views/gatewayPanel.js';

describe('Gateway Panel HTML Builder', () => {
	it('renders signed-out state with Ariadne shield logo, consent checkboxes, and GitHub sign-in button', () => {
		const html = buildGatewayHtml({ kind: 'signed-out' });

		assert.ok(html.includes('class="shield-icon"'), 'Shield icon missing');
		assert.ok(html.includes('Welcome to Ariadne'), 'Title missing');
		assert.ok(html.includes('Sign in with GitHub'), 'Sign in CTA button missing');
		assert.ok(html.includes('data-action="sign-in"'), 'Sign in data-action missing');
		assert.ok(html.includes('id="gateway-terms-checkbox"'), 'Terms checkbox missing');
		assert.ok(html.includes('id="gateway-privacy-checkbox"'), 'Privacy checkbox missing');
		assert.ok(html.includes('class="btn-primary disabled"'), 'Sign in button should be disabled initially');
		assert.ok(!html.includes('role="progressbar"'), 'Progress bar should be omitted when signed out');
		assert.ok(!html.includes('class="tips-box"'), 'Tips box should be omitted when signed out');
		assert.ok(html.includes('Code never leaves your workspace'), 'Privacy footnote missing');
	});

	it('renders signed-out state as active when terms and privacy are accepted', () => {
		const html = buildGatewayHtml({
			kind: 'signed-out',
			termsAccepted: true,
			privacyAccepted: true,
		});

		assert.ok(html.includes('id="gateway-terms-checkbox" checked'), 'Terms checkbox should be checked');
		assert.ok(html.includes('id="gateway-privacy-checkbox" checked'), 'Privacy checkbox should be checked');
		assert.ok(!html.includes('class="btn-primary disabled"'), 'Sign in button should not have disabled class');
		assert.ok(html.includes('aria-disabled="false"'), 'Button aria-disabled should be false');
	});

	it('renders downloading state with target name, animated beam, and security tips carousel', () => {
		const html = buildGatewayHtml({
			kind: 'downloading',
			targetName: 'Linux x86_64',
		});

		assert.ok(html.includes('Downloading Security Engine'), 'Title missing');
		assert.ok(html.includes('Linux x86_64'), 'Target name missing in copy');
		assert.ok(html.includes('class="beam beam-h beam-top"'), 'Animated beam missing');
		assert.ok(html.includes('role="progressbar"'), 'Progress bar missing');
		assert.ok(html.includes('class="tips-box"'), 'Tips box missing');
		assert.ok(html.includes('💡 Did you know?'), 'Tips header missing');
		assert.ok(html.includes(SECURITY_TIPS[0]), 'Initial tip missing');
	});

	it('renders initializing state while static engine starts', () => {
		const html = buildGatewayHtml({ kind: 'initializing' });

		assert.ok(html.includes('Initializing Ariadne'), 'Title missing');
		assert.ok(html.includes('Starting local static analysis session'), 'Copy missing');
		assert.ok(html.includes('role="progressbar"'), 'Progress bar missing');
		assert.ok(html.includes('class="tips-box"'), 'Tips box missing');
	});

	it('renders scanning state while analyzing Java workspace', () => {
		const html = buildGatewayHtml({ kind: 'scanning' });

		assert.ok(html.includes('Analyzing Project'), 'Title missing');
		assert.ok(html.includes('real-time AST and taint analysis'), 'Copy missing');
		assert.ok(html.includes('role="progressbar"'), 'Progress bar missing');
		assert.ok(html.includes('class="tips-box"'), 'Tips box missing');
	});

	it('renders error state with actionable settings CTA', () => {
		const html = buildGatewayHtml({
			kind: 'error',
			message: 'Custom error: spawn ENOENT',
		});

		assert.ok(html.includes('Security Scanner Unavailable'), 'Title missing');
		assert.ok(html.includes('Custom error: spawn ENOENT'), 'Custom error message missing');
		assert.ok(html.includes('Open Core Settings'), 'Core Settings CTA button missing');
		assert.ok(html.includes('data-action="open-core-settings"'), 'Open core settings data-action missing');
		assert.ok(!html.includes('role="progressbar"'), 'Progress bar should be omitted in error state');
	});

	it('renders no-java state when no Java workspace is detected', () => {
		const html = buildGatewayHtml({ kind: 'no-java' });

		assert.ok(html.includes('Java Project Needed'), 'Title missing');
		assert.ok(html.includes('Open Java Folder'), 'Open folder CTA missing');
		assert.ok(html.includes('data-action="open-folder"'), 'Open folder data-action missing');
	});
});

