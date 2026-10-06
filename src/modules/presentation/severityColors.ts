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

/** Highlight background at 50% opacity so editor marks stay easy to see. */
export const SEVERITY_BG_TITLE: Record<
	'Critical' | 'High' | 'Medium' | 'Low',
	string
> = {
	Critical: '#E24B4A80',
	High: '#D85A1A73',
	Medium: '#F3D78A55',
	Low: '#6AAF7866',
};

export function severityCssVars(): string {
	return /* css */ `
		--critical: ${SEVERITY_COLORS.critical};
		--high: ${SEVERITY_COLORS.high};
		--medium: ${SEVERITY_COLORS.medium};
		--low: ${SEVERITY_COLORS.low};
	`;
}
