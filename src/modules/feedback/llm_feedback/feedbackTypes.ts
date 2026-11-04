/**
 * LLM feedback types for the Ariadne Feedback module.
 *
 * These types define the final output format of the feedback pipeline:
 * the complete finding sent to the WebView for rendering, and the
 * data package for initializing the feedback panel.
 */

import type { LLMExplanation } from '../llm_request/requestTypes.js';
import type { VulnerabilityMetadata } from '../vulnerability_results/vulnerabilityTypes.js';
import type { FeedbackPanelState } from '../views/feedbackPanel.js';

/**
 * The complete feedback finding sent to the WebView for rendering.
 * Combines vulnerability metadata with the model's explanation.
 * The code fields are made-up examples, not a patch for this finding.
 */
export interface FeedbackFinding extends LLMExplanation {
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
