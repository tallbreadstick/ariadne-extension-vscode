/**
 * LLM feedback types for the Ariadne Feedback module.
 *
 * These types define the final output format of the feedback pipeline:
 * the complete finding sent to the WebView for rendering, and the
 * data package for initializing the feedback panel.
 */

import type { VulnerabilityMetadata } from '../vulnerability_results/vulnerabilityTypes.js';
import type { FeedbackPanelState } from '../views/feedbackPanel.js';

/**
 * The complete feedback finding sent to the WebView for rendering.
 * Combines vulnerability metadata (from SAST/mock input) with
 * LLM-generated educational text (vulnerability, impact, suggestion).
 */
export interface FeedbackFinding {
	/** Vulnerability type/name (e.g. "SQL Injection") */
	type: string;
	/** CWE identifier (e.g. "CWE-89") */
	cwe: string;
	/** OWASP category (e.g. "OWASP A03:2021 - Injection") */
	owasp: string;
	/** Severity level */
	severity: 'critical' | 'high' | 'medium' | 'low';
	/** File path where the vulnerability was detected */
	path: string;
	/** Line number of the finding */
	line: number;
	/** LLM-generated: what this vulnerability is */
	vulnerability: string;
	/** LLM-generated: why this vulnerability is dangerous */
	impact: string;
	/** LLM-generated: where the student should look */
	suggestion: string;
}

/**
 * Complete data package for initializing the feedback panel.
 * The panel opens immediately with metadata (loading state), then
 * receives a FeedbackPanelState update via postMessage.
 */
export interface FeedbackPanelData {
	metadata: VulnerabilityMetadata;
	state: FeedbackPanelState;
}
