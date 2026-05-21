/**
 * Canonical TypeScript interfaces for the Ariadne Feedback module (Module 3).
 *
 * These types define the data contract between:
 *   - The extension host (payload assembly, LLM call, response parsing)
 *   - The feedback WebView panel (rendering the 3-section explanation)
 *
 * Adapted for OpenAI as the LLM provider.
 *
 * ─────────────────────────────────────────────────────────────────────
 * STATUS: DORMANT — These types are defined but not yet used in the
 * active code path. The extension currently uses FeedbackFinding from
 * mock/types.ts. When the SAST core engine is ready, swap the imports
 * in extension.ts and feedbackPanel.ts to use these types instead.
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Vulnerability Metadata (UC-1.5 output → UC-3.1 input) ───────────

/**
 * Describes the origin of a taint-style vulnerability.
 * Included when the SAST engine reports data-flow tracking.
 */
export interface TaintTrace {
	/** Line number where the tainted value originates */
	origin_line: number;
	/** Line number where the tainted value reaches a security-sensitive sink */
	sink_line: number;
	/** Human-readable summary of the data-flow path */
	path_summary: string;
}

/**
 * Metadata for a single vulnerability finding from the SAST engine.
 * This is the primary input to the LLM prompt serialization (UC-3.1).
 */
export interface VulnerabilityMetadata {
	/** Vulnerability type/name (e.g. "SQL Injection") */
	type: string;
	/** CWE identifier (e.g. "CWE-89") */
	cwe_id: string;
	/** OWASP category reference (e.g. "OWASP A03:2021 - Injection") */
	owasp_category: string;
	/** Severity level */
	severity: 'critical' | 'high' | 'medium' | 'low';
	/** Absolute or workspace-relative path to the affected file */
	file_path: string;
	/** 1-based line number of the finding */
	line_number: number;

	// ── Optional fields from UC-1.5 ──────────────────────────────────
	/** SAST rule identifier (engine-specific) */
	rule_id?: string;
	/** 1-based column number of the finding */
	column_number?: number;
	/** Taint-flow trace, if the engine provides data-flow tracking */
	taint_trace?: TaintTrace;
}

// ── LLM Prompt Payload (UC-3.1 output) ───────────────────────────────

/**
 * Represents the active Java file content sent alongside vulnerability
 * metadata so the LLM has full context for its explanation.
 */
export interface ActiveJavaFile {
	/** Path to the file */
	file_path: string;
	/** Full file text, or empty string if the file couldn't be read */
	content: string;
}

/**
 * The complete prompt payload that gets JSON.stringify()'d into the
 * OpenAI user message content.
 */
export interface LLMPromptPayload {
	vulnerability: VulnerabilityMetadata;
	active_file: ActiveJavaFile;
}

// ── OpenAI Request Types ─────────────────────────────────────────────

/**
 * A single message in the OpenAI Chat Completions format.
 */
export interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * The request body sent to POST /v1/chat/completions.
 */
export interface AriadneLLMRequestBody {
	model: string;
	messages: OpenAIMessage[];
}

// ── LLM Response Types (UC-3.2 output) ───────────────────────────────

/**
 * The parsed 3-field educational response from the LLM.
 * The system prompt instructs the LLM to return a JSON object
 * with exactly these three fields.
 */
export interface LLMThreeSectionResponse {
	/** What this vulnerability is (plain-language explanation) */
	vulnerability: string;
	/** Why this vulnerability is dangerous (real-world impact) */
	impact: string;
	/** Where the student should look in their code */
	suggestion: string;
}

// ── Feedback Finding (final output format) ───────────────────────────

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

// ── Feedback Panel Data (WebView contract) ───────────────────────────

/**
 * Union type representing the three possible states of the feedback panel.
 * Used for postMessage communication between extension host and WebView.
 */
export type FeedbackPanelState =
	| { type: 'loading' }
	| { type: 'llm-result'; finding: FeedbackFinding }
	| { type: 'llm-error'; message: string };

/**
 * Complete data package for initializing the feedback panel.
 * The panel opens immediately with metadata (loading state), then
 * receives a FeedbackPanelState update via postMessage.
 */
export interface FeedbackPanelData {
	metadata: VulnerabilityMetadata;
	state: FeedbackPanelState;
}
