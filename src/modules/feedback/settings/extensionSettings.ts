/** Copilot model used for vulnerability explanations. No other models are allowed. */
export const DEFAULT_COPILOT_MODEL = 'gemini-3.5-flash';

export const LOCKED_COPILOT_MODEL_LABEL = 'Gemini Flash';

export interface SidebarSettingsViewModel {
	copilotModel: string;
	rulesPresent: boolean;
}
