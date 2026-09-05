/**
 * Shared TypeScript interfaces that define the data contract between
 * the Ariadne SAST engine and the VS Code extension presentation layer.
 *
 * These types are consumed by the view builders (activeVulnerabilities,
 * sessionMetrics), the bridge converter (convert.ts), the snapshot
 * analyzer, and extension.ts.
 */

/** Severity levels for a detected vulnerability. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * A single vulnerability finding produced by an Ariadne scan session.
 *
 * This is the card-level shape used by the Active Vulnerabilities panel.
 * It is produced by `metadataToVulnerability()` in convert.ts from
 * the flat VulnerabilityMetadata emitted by the SAST engine.
 */
export interface Vulnerability {
	/** Unique identifier for this finding (e.g. "vuln-001"). */
	id: string;
	/** Severity classification of the vulnerability. */
	severity: Severity;
	/** CWE identifier (e.g. "CWE-89"). */
	cwe: string;
	/** OWASP category reference (e.g. "OWASP A03"). Optional. */
	owaspRef?: string;
	/** Short, human-readable title shown in the collapsed card header. */
	title: string;
	/** Full description shown in the expanded detail panel. */
	description: string;
	/** Relative file path where the vulnerability was detected. */
	filePath: string;
	/** Line number within the file. */
	line: number;
}

/** A single sub-item entry for a persisting, recurring, or resolved trend row. */
export interface TrendSubItem {
	/** Vulnerability type label (e.g. "SQL Injection"). */
	type: string;
	/** Current instance count. */
	instances: number;
}

/** A single sub-item entry for an improving trend row, with progress label. */
export interface ImprovingSubItem extends TrendSubItem {
	/**
	 * Human-readable progress classification.
	 * Placeholder until F/P/T calculation is implemented.
	 */
	progressLabel: 'Some progress' | 'Clear progress' | 'Major progress';
	/** Delta string shown alongside the label (e.g. "+2.00"). Placeholder. */
	progressDelta: string;
}

/**
 * Trend counters summarising how vulnerability patterns shifted
 * across the current session.
 */
export interface TrendData {
	/** Unique instances still present after being seen in this session. */
	persistingPatterns: number;
	/** Unique instances seen earlier that are currently gone. */
	improvingTrends: number;
	/** Unique instances fully resolved during this session. */
	resolvedThisSession: number;
	/**
	 * Per-vulnerability detail for the Persisting Patterns collapsible row.
	 * Optional — placeholder rows are shown when absent.
	 */
	persistingItems?: TrendSubItem[];
	/**
	 * Per-vulnerability detail for the Improving Trends collapsible row.
	 * Optional — placeholder rows are shown when absent.
	 */
	improvingItems?: ImprovingSubItem[];
	/**
	 * Per-vulnerability detail for the Recurring Patterns collapsible row.
	 * Optional — placeholder rows are shown when absent.
	 */
	recurringItems?: TrendSubItem[];
	/**
	 * Per-vulnerability detail for the Resolved This Session collapsible row.
	 * Optional — placeholder rows are shown when absent.
	 */
	resolvedItems?: TrendSubItem[];
}

/**
 * A dismissable notification banner shown at the bottom of the
 * Session Metrics panel.
 */
export interface SessionNotification {
	/** Stable identifier used for persistent dismiss tracking. */
	id: string;
	/** Short headline for the notification. */
	message: string;
	/** Supporting detail text. */
	detail: string;
	/** Human-readable timestamp label (e.g. "just now"). */
	timestamp: string;
}

/**
 * Aggregated metrics for the current scan session,
 * displayed in the Session Metrics panel.
 */
export interface SessionMetrics {
	/** Count of critical-severity findings. */
	critical: number;
	/** Count of high-severity findings. */
	high: number;
	/** Count of medium-severity findings. */
	medium: number;
	/** Count of low-severity findings. */
	low: number;
	/** Trend breakdown for this session. */
	trends: TrendData;
	/** Optional list of notifications to display in a scrollable feed at the bottom of the panel. */
	notifications?: SessionNotification[];
}
