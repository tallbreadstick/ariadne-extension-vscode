/**
 * UC-2.2 – Hover Popup Vulnerability Summary Display
 *
 * Data contract shared between the Ariadne SAST backend and the
 * VS Code extension frontend.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BACKEND INTEGRATION NOTE
 * ─────────────────────────────────────────────────────────────────────────
 * When the real engine ships, only mockFindings.ts is replaced.
 * DiagnosticManager, HoverProvider, and extension.ts require zero changes
 * as long as the engine output conforms to AriadneFinding below.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface AriadneFinding {
  /** Unique identifier for this finding (e.g. "finding-001"). */
  id: string;

  /** Human-readable vulnerability title shown in the popup header. */
  vulnerabilityName: string;

  /** Severity classification used for badge colour and diagnostic severity. */
  severity: "Critical" | "High" | "Medium" | "Low";

  /** CWE identifier (e.g. "CWE-89"). */
  cweId: string;

  /** OWASP Top-10 2021 category reference (e.g. "A03:2021"). */
  owaspCategory: string;

  /** 1–2 sentence plain-language explanation shown in the hover popup body. */
  shortExplanation: string;

  /** Absolute or workspace-relative path to the affected file. */
  filePath: string;

  /** 0-indexed line where the vulnerable range begins. */
  startLine: number;

  /** 0-indexed column where the vulnerable range begins. */
  startColumn: number;

  /** 0-indexed line where the vulnerable range ends (inclusive). */
  endLine: number;

  /** 0-indexed column where the vulnerable range ends (exclusive). */
  endColumn: number;

  /**
   * Optional taint-flow information.
   * Present only when the engine can trace the data from its origin
   * (source) to its use (sink).
   * Both line numbers are 1-indexed for human-readable display.
   */
  taintPath?: {
    /** 1-indexed line where the tainted value first enters the program. */
    originLine: number;
    /** 1-indexed line where the tainted value reaches the vulnerable sink. */
    sinkLine: number;
  };
}
