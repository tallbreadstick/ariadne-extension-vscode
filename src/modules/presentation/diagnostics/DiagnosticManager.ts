import * as vscode from "vscode";
import * as path from "node:path";
import { AriadneFinding } from "./diagnosticTypes";
import { SEVERITY_BG_TITLE, SEVERITY_COLORS_TITLE } from "../severityColors.js";

const SEVERITY_COLOR = SEVERITY_COLORS_TITLE;
const SEVERITY_BG = SEVERITY_BG_TITLE;

// ── UC-2.3: Severity → DiagnosticSeverity mapping ─────────────────────
// Used when publishing zero-width diagnostics to the Problems Panel.
const SEVERITY_TO_DIAGNOSTIC: Record<AriadneFinding["severity"], vscode.DiagnosticSeverity> = {
  Critical: vscode.DiagnosticSeverity.Error,
  High:     vscode.DiagnosticSeverity.Warning,
  Medium:   vscode.DiagnosticSeverity.Warning,
  Low:      vscode.DiagnosticSeverity.Information,
};

export class DiagnosticManager {
  private readonly decorationTypes: Record<
    AriadneFinding["severity"],
    vscode.TextEditorDecorationType
  >;

  private readonly findingsByFile = new Map<string, AriadneFinding[]>();

  /**
   * UC-2.3: A DiagnosticCollection named "ariadne" that populates the
   * Problems Panel.  Each entry uses a zero-width range at column 0 so
   * VS Code's built-in diagnostic hover toolbar does NOT appear over the
   * actual code squiggles (which are drawn by TextEditorDecorationType
   * on the real code range).
   */
  private readonly diagnosticCollection: vscode.DiagnosticCollection;

  constructor(context: vscode.ExtensionContext) {
    this.decorationTypes = {
      Critical: this._makeDecorationType("Critical"),
      High:     this._makeDecorationType("High"),
      Medium:   this._makeDecorationType("Medium"),
      Low:      this._makeDecorationType("Low"),
    };

    // UC-2.3: Create the "ariadne" DiagnosticCollection for Problems Panel.
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("ariadne");

    context.subscriptions.push(
      ...Object.values(this.decorationTypes),
      this.diagnosticCollection,
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

    // UC-2.3: Publish to Problems Panel via DiagnosticCollection.
    this._publishDiagnostics(document, findings);
  }

  /**
   * Eagerly publishes diagnostics to the Problems Panel for EVERY file
   * that has findings, regardless of whether the file is currently open.
   *
   * This keeps the native Problems Panel in sync with the Active
   * Vulnerabilities webview.  Decorations (squiggles / line highlights)
   * are still applied lazily when the user opens the file, via the
   * `onDidChangeActiveTextEditor` listener.
   *
   * Files that previously had diagnostics but are no longer in the new
   * `byFile` map are automatically cleared.
   */
  publishAllDiagnostics(byFile: Map<string, AriadneFinding[]>): void {
    // Track which file URIs still have findings so we can clear stale ones.
    const activeUris = new Set<string>();

    for (const [filePath, findings] of byFile) {
      const uri = vscode.Uri.file(filePath);
      const uriKey = uri.toString();
      activeUris.add(uriKey);

      // Store findings so _applyDecorations works when the tab opens later.
      this.findingsByFile.set(uriKey, findings);

      // Publish to the Problems Panel (does NOT require an open document).
      this._publishDiagnosticsForUri(uri, findings);
    }

    // Clear diagnostics and stored findings for files no longer reported.
    for (const uriKey of this.findingsByFile.keys()) {
      if (!activeUris.has(uriKey)) {
        this.findingsByFile.delete(uriKey);
        // Parse the URI string back to a vscode.Uri to clear its diagnostics.
        this.diagnosticCollection.delete(vscode.Uri.parse(uriKey));
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

    // UC-2.3: Clear Problems Panel entries for this document.
    this.diagnosticCollection.delete(document.uri);
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
      const range = this._codeHighlightRange(editor.document, f);
      if (!range) {
        console.warn(`[Ariadne] Skipping "${f.id}" — line out of bounds or empty.`);
        continue;
      }

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
    const endCol =
      f.endColumn >= 999
        ? endLineText.length
        : Math.min(f.endColumn, endLineText.length);

    if (startCol >= endCol) {
      return undefined;
    }

    return new vscode.Range(f.startLine, startCol, f.endLine, endCol);
  }

  /**
   * One decoration type per severity combining:
   *   - background tint on the code range
   *   - wavy underline on the same range
   *   - overview ruler dot in the scroll bar
   */
  private _makeDecorationType(
    severity: AriadneFinding["severity"]
  ): vscode.TextEditorDecorationType {
    const color = SEVERITY_COLOR[severity];
    const bg    = SEVERITY_BG[severity];
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      backgroundColor: bg,
      textDecoration: `underline wavy ${color}`,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  // ── UC-2.3: Problems Panel ────────────────────────────────────────────

  /**
   * Publishes findings to the Problems Panel via DiagnosticCollection.
   *
   * Each diagnostic uses a ZERO-WIDTH range at (startLine, 0) so that
   * VS Code's built-in diagnostic hover toolbar ("Explain and Fix",
   * "View Problem") only triggers at column 0, not over the actual code
   * squiggles drawn by TextEditorDecorationType.
   *
   * Problems Panel entry format (matches wireframe):
   *   ⚠ SQL Injection — unsanitized input…   ariadne (java:CWE-89) [Ln 3]
   *
   * Click-to-navigate is handled automatically by VS Code — clicking an
   * entry navigates the editor to the diagnostic's range position.
   */
  private _publishDiagnostics(
    document: vscode.TextDocument,
    findings: AriadneFinding[]
  ): void {
    const diagnostics: vscode.Diagnostic[] = [];

    for (const f of findings) {
      // Guard: skip findings whose lines exceed the document length.
      if (f.startLine >= document.lineCount) {
        continue;
      }

      // Zero-width range at column 0 of the finding's start line.
      // This populates the Problems Panel but keeps the diagnostic hover
      // toolbar away from the real code squiggles.
      const zeroRange = new vscode.Range(
        f.startLine, 0,
        f.startLine, 0
      );

      const diag = new vscode.Diagnostic(
        zeroRange,
        `[Ariadne - ${f.severity.toUpperCase()}] ${f.vulnerabilityName} — ${f.shortExplanation}`,
        SEVERITY_TO_DIAGNOSTIC[f.severity]
      );

      // Source label shown in the Problems Panel (e.g. "ariadne").
      diag.source = "ariadne";

      // Code shown after the source (e.g. "java:CWE-89").
      diag.code = `java:${f.cweId}`;

      diagnostics.push(diag);
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * Publishes findings to the Problems Panel for a file URI that may
   * or may not be open.  Unlike `_publishDiagnostics`, this does NOT
   * need a TextDocument — it builds Diagnostics using only the data
   * already present in each AriadneFinding.
   */
  private _publishDiagnosticsForUri(
    uri: vscode.Uri,
    findings: AriadneFinding[]
  ): void {
    const diagnostics: vscode.Diagnostic[] = [];

    for (const f of findings) {
      // Zero-width range at column 0 — same strategy as _publishDiagnostics.
      const zeroRange = new vscode.Range(
        f.startLine, 0,
        f.startLine, 0
      );

      const diag = new vscode.Diagnostic(
        zeroRange,
        `[Ariadne - ${f.severity.toUpperCase()}] ${f.vulnerabilityName} — ${f.shortExplanation}`,
        SEVERITY_TO_DIAGNOSTIC[f.severity]
      );

      diag.source = "ariadne";

      // Derive language hint from file extension for the code label.
      const ext = path.extname(uri.fsPath).replace(".", "") || "file";
      diag.code = `${ext}:${f.cweId}`;

      diagnostics.push(diag);
    }

    this.diagnosticCollection.set(uri, diagnostics);
  }
}
