/**
 * Shared severity color tokens for Ariadne UI surfaces.
 *
 * CRITICAL = red, HIGH = orange, MEDIUM = yellow, LOW = green.
 */

import type { Severity } from './panelTypes.js';

export const SEVERITY_COLORS: Record<Severity, string> = {
	critical: '#E24B4A',
	high: '#F0883E',
	medium: '#E3B341',
	low: '#3FB950',
};

/** Title-cased keys used by the diagnostics layer. */
export const SEVERITY_COLORS_TITLE: Record<
	'Critical' | 'High' | 'Medium' | 'Low',
	string
> = {
	Critical: SEVERITY_COLORS.critical,
	High: SEVERITY_COLORS.high,
	Medium: SEVERITY_COLORS.medium,
	Low: SEVERITY_COLORS.low,
};

/** Highlight background at ~20% opacity for editor squiggles. */
export const SEVERITY_BG_TITLE: Record<
	'Critical' | 'High' | 'Medium' | 'Low',
	string
> = {
	Critical: '#E24B4A33',
	High: '#F0883E33',
	Medium: '#E3B34133',
	Low: '#3FB95033',
};

export function severityCssVars(): string {
	return /* css */ `
		--critical: ${SEVERITY_COLORS.critical};
		--high: ${SEVERITY_COLORS.high};
		--medium: ${SEVERITY_COLORS.medium};
		--low: ${SEVERITY_COLORS.low};
	`;
}
