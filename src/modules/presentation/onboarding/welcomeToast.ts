import * as vscode from 'vscode';

export const WELCOME_TOAST_MESSAGE =
	'Welcome to Ariadne! We are actively monitoring your Java code for security vulnerabilities. Ariadne provides guided conceptual explanations to help you fix issues independently.';

export const OPEN_PANEL_ACTION = 'Open Ariadne Panel';
export const GOT_IT_ACTION = 'Got it';

export interface ShowMessageFunction {
	(message: string, ...items: string[]): Thenable<string | undefined>;
}

/**
 * Checks whether the first-run welcome onboarding toast has been shown.
 * If not, displays it with actions to open the Ariadne panel or acknowledge.
 *
 * @param globalState VS Code global Memento storage
 * @param openPanelFn Callback to open the Ariadne bottom panel
 * @param showMessageFn Optional override for window.showInformationMessage (for unit testing)
 * @returns true if the welcome toast was shown, false if already seen
 */
export async function checkAndShowWelcomeToast(
	globalState: vscode.Memento,
	openPanelFn: () => Promise<void> | void,
	showMessageFn: ShowMessageFunction = vscode.window.showInformationMessage,
): Promise<boolean> {
	const hasSeen = globalState.get<boolean>('ariadne.hasSeenWelcome');
	if (hasSeen) {
		return false;
	}

	const choice = await showMessageFn(
		WELCOME_TOAST_MESSAGE,
		OPEN_PANEL_ACTION,
		GOT_IT_ACTION,
	);

	if (choice === OPEN_PANEL_ACTION) {
		await openPanelFn();
	}

	await globalState.update('ariadne.hasSeenWelcome', true);
	return true;
}

/**
 * Resets the welcome toast state so it can be re-triggered for testing.
 */
export async function resetWelcomeToast(globalState: vscode.Memento): Promise<void> {
	await globalState.update('ariadne.hasSeenWelcome', undefined);
}
