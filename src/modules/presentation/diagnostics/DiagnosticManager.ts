import * as vscode from "vscode";
import { AriadneFinding } from "./diagnosticTypes";
import { SEVERITY_BG_TITLE, SEVERITY_COLORS_TITLE } from "../severityColors.js";

const SEVERITY_COLOR = SEVERITY_COLORS_TITLE;
const SEVERITY_BG = SEVERITY_BG_TITLE;

const SEVERITY_RANK: Record<AriadneFinding["severity"], number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export class DiagnosticManager {
  private readonly decorationTypes: Record<
    AriadneFinding["severity"],
    vscode.TextEditorDecorationType
  >;

  /** After-text only: no underline, so the label can sit at end-of-line. */
  private readonly afterDecorationType: vscode.TextEditorDecorationType;

  private readonly findingsByFile = new Map<string, AriadneFinding[]>();

  /** Editor highlights only. Findings and hovers stay either way. */
  private highlightsVisible = true;

  constructor(context: vscode.ExtensionContext) {
    this.decorationTypes = {
      Critical: this._makeDecorationType("Critical"),
      High:     this._makeDecorationType("High"),
      Medium:   this._makeDecorationType("Medium"),
      Low:      this._makeDecorationType("Low"),
    };
    this.afterDecorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
    });

    context.subscriptions.push(
      ...Object.values(this.decorationTypes),
      this.afterDecorationType,
    );

    // Re-paint decorations when the user switches tabs
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) { this._applyDecorations(editor); }
      })
    );
  }

  refresh(document: vscode.TextDocument, findings: AriadneFinding[]): void {
    this.findingsByFile.set(document.uri.toString(), findings);

    // UC-2.2: Paint squiggles + line highlights via TextEditorDecorationType.
    vscode.window.visibleTextEditors
      .filter((e) => e.document.uri.toString() === document.uri.toString())
      .forEach((e) => this._applyDecorations(e));
  }

  /**
   * Stores findings for highlights and hovers. The Ariadne tab is the
   * list of record; these findings are not published to the Problems panel.
   */
  publishAllDiagnostics(byFile: Map<string, AriadneFinding[]>): void {
    // Track which file URIs still have findings so we can clear stale ones.
    const activeUris = new Set<string>();

    for (const [filePath, findings] of byFile) {
      const uriKey = vscode.Uri.file(filePath).toString();
      activeUris.add(uriKey);
      this.findingsByFile.set(uriKey, findings);
    }

    for (const uriKey of this.findingsByFile.keys()) {
      if (!activeUris.has(uriKey)) {
        this.findingsByFile.delete(uriKey);
      }
    }

    // Also repaint decorations on any editors that happen to be visible.
    for (const editor of vscode.window.visibleTextEditors) {
      this._applyDecorations(editor);
    }
  }

  getFindingAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): AriadneFinding | undefined {
    const findings = this.findingsByFile.get(document.uri.toString());
    if (!findings) { return undefined; }

    return findings.find((f) => {
      const range = this._codeHighlightRange(document, f);
      return range?.contains(position) ?? false;
    });
  }

  clear(document: vscode.TextDocument): void {
    this.findingsByFile.delete(document.uri.toString());

    // UC-2.2: Remove squiggles.
    vscode.window.visibleTextEditors
      .filter((e) => e.document.uri.toString() === document.uri.toString())
      .forEach((e) => this._clearDecorations(e));
  }

  /** Hides or restores editor highlights without dropping findings. */
  setHighlightsVisible(visible: boolean): void {
    this.highlightsVisible = visible;
    for (const editor of vscode.window.visibleTextEditors) {
      if (visible) {
        this._applyDecorations(editor);
      } else {
        this._clearDecorations(editor);
      }
    }
  }

  /** Clears stored findings and editor decorations. */
  clearAll(): void {
    this.findingsByFile.clear();
    for (const editor of vscode.window.visibleTextEditors) {
      this._clearDecorations(editor);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private _applyDecorations(editor: vscode.TextEditor): void {
    if (!this.highlightsVisible) {
      this._clearDecorations(editor);
      return;
    }
    const findings =
      this.findingsByFile.get(editor.document.uri.toString()) ?? [];

    // Bucket DecorationOptions per severity (underline stays on the finding span)
    const buckets: Record<AriadneFinding["severity"], vscode.DecorationOptions[]> = {
      Critical: [], High: [], Medium: [], Low: [],
    };
    // One after-label per line so "SQL Injection" sits after `;`, not mid-call.
    const afterByLine = new Map<number, AriadneFinding[]>();

    for (const f of findings) {
      const range = this._codeHighlightRange(editor.document, f);
      if (!range) {
        console.warn(`[Ariadne] Skipping "${f.id}" — line out of bounds or empty.`);
        continue;
      }

      buckets[f.severity].push({ range });

      const labelLine = range.end.line;
      const existing = afterByLine.get(labelLine) ?? [];
      existing.push(f);
      afterByLine.set(labelLine, existing);
    }

    const afters: vscode.DecorationOptions[] = [];
    for (const [line, lineFindings] of afterByLine) {
      const lineText = editor.document.lineAt(line).text;
      const end = lineText.length;
      const lead = lineFindings.reduce((best, f) =>
        SEVERITY_RANK[f.severity] < SEVERITY_RANK[best.severity] ? f : best
      );
      afters.push({
        range: new vscode.Range(line, end, line, end),
        renderOptions: {
          after: {
            contentText: `  [Ariadne] ${lineFindings.map((f) => f.vulnerabilityName).join("  ·  ")}`,
            color: SEVERITY_COLOR[lead.severity],
            fontStyle: "italic",
            margin: "0 0 0 16px",
          },
        },
      });
    }

    for (const severity of ["Critical", "High", "Medium", "Low"] as const) {
      editor.setDecorations(this.decorationTypes[severity], buckets[severity]);
    }
    editor.setDecorations(this.afterDecorationType, afters);
  }

  private _clearDecorations(editor: vscode.TextEditor): void {
    for (const dt of Object.values(this.decorationTypes)) {
      editor.setDecorations(dt, []);
    }
    editor.setDecorations(this.afterDecorationType, []);
  }

  /**
   * Build a highlight range that skips leading indentation so squiggles
   * and background tints align with code, not whitespace.
   */
  private _codeHighlightRange(
    document: vscode.TextDocument,
    f: AriadneFinding,
  ): vscode.Range | undefined {
    if (f.startLine >= document.lineCount || f.endLine >= document.lineCount) {
      return undefined;
    }

    const startLineText = document.lineAt(f.startLine).text;
    const endLineText = document.lineAt(f.endLine).text;
    const leading = startLineText.match(/^\s*/)?.[0]?.length ?? 0;

    const startCol = Math.max(f.startColumn, leading);
    let endCol =
      f.endColumn >= 999
        ? endLineText.length
        : Math.min(f.endColumn, endLineText.length);

    // Empty or inverted spans used to drop the underline entirely.
    if (startCol >= endCol) {
      endCol = endLineText.length;
    }
    if (startCol >= endCol) {
      if (leading >= endLineText.length) {
        return undefined;
      }
      return new vscode.Range(f.startLine, leading, f.endLine, endLineText.length);
    }

    return new vscode.Range(f.startLine, startCol, f.endLine, endCol);
  }

  /**
   * One decoration type per severity: a background highlight on the code
   * range, plus an overview-ruler dot. No underline, so a vulnerability
   * does not look like a compiler error. Hover text stays on HoverProvider.
   */
  private _makeDecorationType(
    severity: AriadneFinding["severity"]
  ): vscode.TextEditorDecorationType {
    const color = SEVERITY_COLOR[severity];
    const bg    = SEVERITY_BG[severity];
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      backgroundColor: bg,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }
}
