import * as vscode from "vscode";
import { AriadneFinding } from "./types";

// Design tokens — mirrored from activeVulnerabilities.ts CSS variables
const SEVERITY_COLOR: Record<AriadneFinding["severity"], string> = {
  Critical: "#E24B4A",
  High:     "#BA7517",
  Medium:   "#227AD0",
  Low:      "#5CA221",
};

// Highlight background colours at 20% opacity (hex alpha 33 = 51/255 ≈ 20%)
const SEVERITY_BG: Record<AriadneFinding["severity"], string> = {
  Critical: "#EA2D2E33",
  High:     "#BA751733",
  Medium:   "#0074BD33",
  Low:      "#608B4E33",
};

export class DiagnosticManager {
  private readonly decorationTypes: Record<
    AriadneFinding["severity"],
    vscode.TextEditorDecorationType
  >;

  private readonly findingsByFile = new Map<string, AriadneFinding[]>();

  constructor(context: vscode.ExtensionContext) {
    this.decorationTypes = {
      Critical: this._makeDecorationType("Critical"),
      High:     this._makeDecorationType("High"),
      Medium:   this._makeDecorationType("Medium"),
      Low:      this._makeDecorationType("Low"),
    };

    context.subscriptions.push(...Object.values(this.decorationTypes));

    // Re-paint decorations when the user switches tabs
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) { this._applyDecorations(editor); }
      })
    );
  }

  refresh(document: vscode.TextDocument, findings: AriadneFinding[]): void {
    this.findingsByFile.set(document.uri.toString(), findings);

    vscode.window.visibleTextEditors
      .filter((e) => e.document.uri.toString() === document.uri.toString())
      .forEach((e) => this._applyDecorations(e));
  }

  getFindingAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): AriadneFinding | undefined {
    const findings = this.findingsByFile.get(document.uri.toString());
    if (!findings) { return undefined; }

    return findings.find((f) => {
      if (f.startLine >= document.lineCount || f.endLine >= document.lineCount) {
        return false;
      }
      const range = new vscode.Range(
        f.startLine, f.startColumn,
        f.endLine,
        Math.min(f.endColumn, document.lineAt(f.endLine).text.length)
      );
      return range.contains(position);
    });
  }

  clear(document: vscode.TextDocument): void {
    this.findingsByFile.delete(document.uri.toString());
    vscode.window.visibleTextEditors
      .filter((e) => e.document.uri.toString() === document.uri.toString())
      .forEach((e) => this._clearDecorations(e));
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private _applyDecorations(editor: vscode.TextEditor): void {
    const findings =
      this.findingsByFile.get(editor.document.uri.toString()) ?? [];

    // Bucket DecorationOptions per severity (allows per-range renderOptions)
    const buckets: Record<AriadneFinding["severity"], vscode.DecorationOptions[]> = {
      Critical: [], High: [], Medium: [], Low: [],
    };

    for (const f of findings) {
      if (
        f.startLine >= editor.document.lineCount ||
        f.endLine   >= editor.document.lineCount
      ) {
        console.warn(`[Ariadne] Skipping "${f.id}" — line out of bounds.`);
        continue;
      }

      const endCol = Math.min(
        f.endColumn,
        editor.document.lineAt(f.endLine).text.length
      );
      const range = new vscode.Range(f.startLine, f.startColumn, f.endLine, endCol);
      const color = SEVERITY_COLOR[f.severity];

      buckets[f.severity].push({
        range,
        // Per-range renderOptions → different inline label per finding
        renderOptions: {
          after: {
            contentText: `  ${f.vulnerabilityName}`,
            color,
            fontStyle: "italic",
            margin: "0 0 0 16px",
          },
        },
      });
    }

    for (const severity of ["Critical", "High", "Medium", "Low"] as const) {
      editor.setDecorations(this.decorationTypes[severity], buckets[severity]);
    }
  }

  private _clearDecorations(editor: vscode.TextEditor): void {
    for (const dt of Object.values(this.decorationTypes)) {
      editor.setDecorations(dt, []);
    }
  }

  /**
   * One decoration type per severity combining:
   *   - isWholeLine background tint  → visible even on empty lines
   *   - wavy underline on text       → squiggle on lines with content
   *   - overview ruler dot           → gutter marker in scroll bar
   */
  private _makeDecorationType(
    severity: AriadneFinding["severity"]
  ): vscode.TextEditorDecorationType {
    const color = SEVERITY_COLOR[severity];
    const bg    = SEVERITY_BG[severity];
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: bg,
      textDecoration: `underline wavy ${color}`,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }
}
