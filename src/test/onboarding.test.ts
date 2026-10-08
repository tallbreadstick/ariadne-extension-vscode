import * as assert from 'assert';
import type * as vscode from 'vscode';
import {
	checkAndShowWelcomeToast,
	resetWelcomeToast,
	WELCOME_TOAST_MESSAGE,
	OPEN_PANEL_ACTION,
	GOT_IT_ACTION,
} from '../modules/presentation/onboarding/welcomeToast.js';

function createMockMemento(): {
	memento: vscode.Memento;
	store: Record<string, unknown>;
} {
	const store: Record<string, unknown> = {};
	const memento = {
		get: <T>(key: string, defaultValue?: T): T => {
			return (store[key] !== undefined ? store[key] : defaultValue) as T;
		},
		update: async (key: string, value: unknown): Promise<void> => {
			if (value === undefined) {
				delete store[key];
			} else {
				store[key] = value;
			}
		},
		keys: (): readonly string[] => Object.keys(store),
		setKeysForSync: () => undefined,
	} as unknown as vscode.Memento;

	return { memento, store };
}

describe('First-run Onboarding Welcome Toast', () => {
	it('shows welcome toast and executes openPanelFn when user selects Open Ariadne Panel', async () => {
		const { memento, store } = createMockMemento();
		let panelOpened = false;
		let capturedMessage = '';
		let capturedOptions: string[] = [];

		const shown = await checkAndShowWelcomeToast(
			memento,
			() => { panelOpened = true; },
			async (message: string, ...items: string[]) => {
				capturedMessage = message;
				capturedOptions = items;
				return OPEN_PANEL_ACTION;
			},
		);

		assert.strictEqual(shown, true, 'Toast should have been shown');
		assert.strictEqual(capturedMessage, WELCOME_TOAST_MESSAGE);
		assert.deepStrictEqual(capturedOptions, [OPEN_PANEL_ACTION, GOT_IT_ACTION]);
		assert.strictEqual(panelOpened, true, 'openPanelFn should have been called');
		assert.strictEqual(store['ariadne.hasSeenWelcome'], true, 'hasSeenWelcome should be true');
	});

	it('dismisses toast without opening panel when user selects Got it', async () => {
		const { memento, store } = createMockMemento();
		let panelOpened = false;

		const shown = await checkAndShowWelcomeToast(
			memento,
			() => { panelOpened = true; },
			async () => GOT_IT_ACTION,
		);

		assert.strictEqual(shown, true);
		assert.strictEqual(panelOpened, false, 'openPanelFn should NOT have been called');
		assert.strictEqual(store['ariadne.hasSeenWelcome'], true);
	});

	it('skips toast if user has already seen it', async () => {
		const { memento } = createMockMemento();
		await memento.update('ariadne.hasSeenWelcome', true);

		let messageShown = false;
		const shown = await checkAndShowWelcomeToast(
			memento,
			() => {},
			async () => {
				messageShown = true;
				return undefined;
			},
		);

		assert.strictEqual(shown, false, 'Toast should not be shown again');
		assert.strictEqual(messageShown, false, 'showMessageFn should never be invoked');
	});

	it('resets welcome toast state with resetWelcomeToast', async () => {
		const { memento, store } = createMockMemento();
		await memento.update('ariadne.hasSeenWelcome', true);
		assert.strictEqual(store['ariadne.hasSeenWelcome'], true);

		await resetWelcomeToast(memento);
		assert.strictEqual(store['ariadne.hasSeenWelcome'], undefined);
	});
});
