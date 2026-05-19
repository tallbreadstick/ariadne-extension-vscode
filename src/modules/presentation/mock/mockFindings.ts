/**
 * UC-2.2 – Mock Finding Source
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS THE ONLY FILE THAT CHANGES WHEN THE REAL BACKEND SHIPS.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Replace the hardcoded array below with a call to the Ariadne SAST engine
 * (e.g. parse stdout from the Java process, call a language-server endpoint,
 * or deserialise a JSON response).  The return type must remain
 * AriadneFinding[] so that DiagnosticManager and HoverProvider need no
 * changes.
 *
 * Target lines (0-indexed): 2, 6, 10, 14
 * Open src/fixtures/Sample.java to see the squiggles and hover popups
 * immediately after running the extension in Extension Development Host.
 */

import * as vscode from "vscode";
import { AriadneFinding } from "../diagnostics/types";

/**
 * Returns a hardcoded set of findings scoped to the given document.
 *
 * @param document - The currently open Java TextDocument.
 * @returns An array of four AriadneFinding objects covering all four
 *          severity levels, one per target line.
 */
export function getMockFindings(
  document: vscode.TextDocument
): AriadneFinding[] {
  const uri = document.uri.toString();

  return [
    // ── Line 2 (0-indexed) ── Critical / SQL Injection ─────────────────
    {
      id: "finding-001",
      vulnerabilityName: "SQL Injection",
      severity: "Critical",
      cweId: "CWE-89",
      owaspCategory: "A03:2021",
      shortExplanation:
        "Unsanitized user input is concatenated directly into a SQL query " +
        "string. An attacker can manipulate the query to bypass authentication " +
        "or exfiltrate the entire database.",
      filePath: uri,
      startLine: 2,
      startColumn: 0,
      endLine: 2,
      endColumn: 999,
      taintPath: {
        originLine: 3, // 1-indexed for display
        sinkLine: 5,
      },
    },

    // ── Line 6 (0-indexed) ── High / Hardcoded Secret ──────────────────
    {
      id: "finding-002",
      vulnerabilityName: "Hardcoded Secret",
      severity: "High",
      cweId: "CWE-798",
      owaspCategory: "A07:2021",
      shortExplanation:
        "A credential or API key is embedded as a string literal in source " +
        "code. Anyone with repository access can retrieve and misuse the " +
        "secret, and rotation requires a code change.",
      filePath: uri,
      startLine: 6,
      startColumn: 0,
      endLine: 6,
      endColumn: 999,
    },

    // ── Line 10 (0-indexed) ── Medium / Sensitive Data in Log ──────────
    {
      id: "finding-003",
      vulnerabilityName: "Sensitive Data in Log",
      severity: "Medium",
      cweId: "CWE-532",
      owaspCategory: "A09:2021",
      shortExplanation:
        "User-supplied or privacy-sensitive values are written to the " +
        "application log verbatim. Log aggregators or anyone with log " +
        "access can read data such as passwords or personal identifiers.",
      filePath: uri,
      startLine: 10,
      startColumn: 0,
      endLine: 10,
      endColumn: 999,
      taintPath: {
        originLine: 7,  // 1-indexed for display
        sinkLine: 11,
      },
    },

    // ── Line 14 (0-indexed) ── Low / Weak Cipher Algorithm ─────────────
    {
      id: "finding-004",
      vulnerabilityName: "Weak Cipher Algorithm",
      severity: "Low",
      cweId: "CWE-327",
      owaspCategory: "A02:2021",
      shortExplanation:
        "A deprecated or cryptographically weak algorithm (e.g. DES, MD5, " +
        "SHA-1) is used for encryption or hashing. Prefer AES-256-GCM or " +
        "SHA-256/SHA-3 for any new cryptographic operations.",
      filePath: uri,
      startLine: 14,
      startColumn: 0,
      endLine: 14,
      endColumn: 999,
    },
  ];
}
