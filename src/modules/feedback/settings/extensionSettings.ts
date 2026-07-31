/** Copilot models exposed in the sidebar settings picker. Keep in sync with package.json. */
export const COPILOT_MODEL_OPTIONS = [
	'gpt-5-mini',
	'claude-haiku-4.5',
	'gemini-3.5-flash',
	'gpt-5.4-mini',
	'gpt-5.5',
] as const;

export const DEFAULT_COPILOT_MODEL = 'gemini-3.5-flash';

export interface SidebarSettingsViewModel {
	copilotModel: string;
	copilotModelOptions: readonly string[];
}
