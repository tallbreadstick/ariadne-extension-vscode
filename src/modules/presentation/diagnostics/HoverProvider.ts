/**
 * UC-2.2 – HoverProvider
 *
 * Registers a VS Code hover provider for Java files that renders the
 * structured Ariadne vulnerability popup when the cursor is over an
 * annotated code segment.
 *
 * Popup layout (matches hi-fi design):
 *
 *   ⚠ **SQL Injection**
 *
 *   `Critical`  ·  CWE-89  ·  A03:2021
 *
 *   Unsanitized user input is concatenated…
 *
 *   *taint origin: line 3 → sink: line 5*
 *
 *   ---
 *
 *   [Ask Ariadne →](command:ariadne.askAriadne)
 */

import * as vscode from "vscode";
import { DiagnosticManager } from "./DiagnosticManager";
import { AriadneFinding } from "./types";

/**
 * Registers the hover provider and pushes it into context.subscriptions.
 *
 * @param context - Extension context for lifecycle management.
 * @param manager - DiagnosticManager that answers position queries.
 */
export function registerHoverProvider(
  context: vscode.ExtensionContext,
  manager: DiagnosticManager
): void {
  const disposable = vscode.languages.registerHoverProvider("java", {
    provideHover(
      document: vscode.TextDocument,
      position: vscode.Position
    ): vscode.Hover | null {
      try {
        const finding = manager.getFindingAtPosition(document, position);
        if (!finding) {
          return null;
        }

        const md = buildMarkdown(finding);
        return new vscode.Hover(md);
      } catch (err) {
        console.error("[Ariadne] HoverProvider error:", err);
        return null;
      }
    },
  });

  context.subscriptions.push(disposable);
}

const TAINT_COLOR     = "#4EC9B0"; // matches .summary-file span in activeVulnerabilities.ts
const REFERENCE_COLOR = "#CE9178"; // matches --reference in activeVulnerabilities.ts

// ── Private helpers ─────────────────────────────────────────────────────

/**
 * Builds the MarkdownString for the hover popup from a single finding.
 *
 * isTrusted  → command:// links render (Ask Ariadne button)
 * supportHtml → <span style="color:…"> renders (colour badges, taint path)
 *
 * background-color is sanitised by VS Code in hover context, so severity
 * is shown as coloured bold text using the same hex values as the panel.
 */
function buildMarkdown(finding: AriadneFinding): vscode.MarkdownString {
  const md = new vscode.MarkdownString("", true);
  md.isTrusted = true;
  md.supportThemeIcons = true;
  md.supportHtml = true;


  // ── Header: theme icon + vulnerability name ──────────────────────────
  const icon = severityIcon(finding.severity);
  md.appendMarkdown(`${icon} **${finding.vulnerabilityName}**\n\n`);

  // ── Badge row: severity · CWE · OWASP ────────────────────────────────
  // VS Code strips inline span colors in this context; severity is plain bold.
  // CWE/OWASP uses the reference color which renders correctly on its own line.
  md.appendMarkdown(`**${finding.severity.toUpperCase()}**  `);
  md.appendMarkdown(`<span style="color:${REFERENCE_COLOR};">${finding.cweId} \u00B7 OWASP ${finding.owaspCategory}</span>\n\n`);

  // ── Short explanation ─────────────────────────────────────────────────
  md.appendMarkdown(`${finding.shortExplanation}\n\n`);

  // ── Taint path — teal, matching .summary-file span in the panel ───────
  if (finding.taintPath) {
    md.appendMarkdown(
      `<span style="color:${TAINT_COLOR};">` +
      `taint origin: line ${finding.taintPath.originLine} \u2192 sink: line ${finding.taintPath.sinkLine}` +
      `</span>\n\n`
    );
  }

  // ── Divider ───────────────────────────────────────────────────────────
  md.appendMarkdown("---\n\n");

  // ── Ask Ariadne CTA — italic link ────────────────────────────────────
  // The ariadne.askAriadne command is not yet implemented; the link wires
  // the command name so the AI Feedback module can register it later
  // without touching HoverProvider.
  md.appendMarkdown("*[Ask Ariadne →](command:ariadne.askAriadne)*");

  return md;
}

/**
 * Returns the VS Code themed icon for each severity level.
 * Critical and High use the warning triangle to match the hi-fi design.
 */
function severityIcon(severity: AriadneFinding["severity"]): string {
  switch (severity) {
    case "Critical": return "$(warning)";
    case "High":     return "$(warning)";
    case "Medium":   return "$(info)";
    case "Low":      return "$(lightbulb)";
  }
}

