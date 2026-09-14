# RFC: Finding Identity & Fingerprinting Collaboration between Core and Extension

**Date:** 2026-09-04  
**Author:** Extension & Tracker Team  
**Reviewers:** Jeremiah (Core Lead), Ervin (Project Manager / Lead Researcher)  
**Status:** Proposal / Discussion Draft  
**Target Repositories:** `ariadne-core` (Rust SAST Engine) & `ariadne-extension-vscode` (TypeScript Extension)

---

## 1. Context & Goal

In Ariadne, the upcoming **Trends & Reinforcement Tracker** (Module 4) aims to track student code improvements across successive scans within a workspace session. Specifically, it must classify vulnerability occurrences into durable learning trends:
- **Persisting:** The exact same vulnerability remains unaddressed across scans.
- **Improving:** Vulnerability instances within a baseline group are being eliminated.
- **Resolved:** A previously confirmed vulnerability is fixed.
- **Recurring:** A previously resolved vulnerability is reintroduced.

To do this reliably, we need a **stable finding identity (fingerprint)** that survives everyday programmer edits:
- Inserting blank lines or comments above a function.
- Renaming unrelated local variables or changing formatting.
- Splitting a statement across multiple lines.

Line numbers alone (`line_number: 48`) cannot serve as stable identities because pressing `Enter` moves the finding to line 49, which causes the tracker to falsely claim that line 48 was "Resolved" and line 49 is a "New Vulnerability."

---

## 2. What We Tested in Phase 1 (Extension-Only Prototype)

Following an initial recommendation to minimize scanner contract changes, we built and tested an extension-only prototype (`feature/fingerprint-phase-1`).

The extension derived three 64-character SHA-256 hashes:
1. **Logical Fingerprint:** `rule_id`, `cwe_id`, `instance_kind`, `instance_name`, `enclosing_symbol_path`.
2. **Scope Fingerprint:** `workspace_relative_file_path`, `enclosing_symbol_path`.
3. **Content Fingerprint:** Normalized text slice of the vulnerable line (or origin + sink lines for taint).

### What Worked (Live Verification on `arinda-backend-trend-test`)
- **Line-movement immunity:** In `ApplicationController.java`, we added 5 blank lines at the top of the file, shifting the finding from Line 48 to Line 53. The calculated fingerprint remained **100% identical** (`1 unique-eligible`), proving that line-independent identity works in concept.
- **Duplicate ambiguity detection:** When we duplicated the vulnerable return statement twice inside the same method, the fingerprint system caught the collision and safely flagged both as `ambiguous` rather than guessing.

### The Ceiling We Hit (Why Extension-Only Cannot Reach Production Quality)
1. **The "Cold Start" Blind Spot:**
   - On initial workspace load (`Init`), the Rust engine scans files directly from disk.
   - The extension only receives live text buffers when files are actively opened in editor tabs.
   - As a result, **100% of initial findings on startup are marked `ineligible`**. Tracking cannot start until a student manually edits each file.
2. **Fragile Method-Name Guessing (Brace Counting):**
   - Because `VulnerabilityMetadata` only provides `line_number`, the extension tries to determine the enclosing method using a regex brace counter (`deriveEnclosingSymbolPath`).
   - This fails on constructors (no return type in Java), lambdas (`-> {`), multi-line method signatures, and block comments with braces (`/* } */`). When it fails, the finding is marked `ineligible` (`missing-enclosing-path`).
3. **Coarse Whole-Line Slicing:**
   - Without exact character start/end columns, the extension hashes the **entire line of code**.
   - If a student splits a statement over two lines, or if two function calls share a line, the content hash breaks or collides.
4. **Rust's Aggregator Pre-Collapses Distinct Sinks:**
   - In `aggregator.rs` line 25:
     ```rust
     let dedup_key = (m.cwe_id, m.file_path, m.line_number, m.rule_id);
     ```
   - If two distinct vulnerability sinks occur on the same line, the engine drops one before the extension ever sees it.

---

## 3. The Realization: Rust Already Has This Data

When looking into `ariadne-core`, we discovered that **Jeremiah’s engine already calculates and holds the exact AST metadata required**:

| Metadata Needed | Status in `ariadne-core` Internally | Status in Wire Payload (`VulnerabilityMetadata`) |
|---|---|---|
| **Enclosing Method FQN** | Available via `resolver.rs` (`find_enclosing_method`) and `dataflow/builder.rs` (`enclosing()`). | **Omitted** (not on struct). |
| **Exact Expression Range** | Tree-sitter provides `SourceRange` (`start_row`, `start_col`, `end_row`, `end_col`). Dataflow node IDs encode `start_row:start_col-end_row:end_col`. | **Omitted** (`column` is initialized to `0` and never populated by detectors). |
| **Taint Source/Sink Ranges** | Known in dataflow graph node positions. | **Only start lines emitted** in `TaintTrace`. |
| **Analysed File Content** | Exact UTF-8 buffer exists in `AstForest` at scan time. | Not sent (and doesn't need to be). |

Because this data is already in memory during analysis, we would like to collaborate with `ariadne-core` to expose or use it directly.

---

## 4. Architectural Proposals for Discussion

We see two viable ways forward. We strongly recommend **Option A**, but want Jeremiah's perspective.

### Option A (Recommended): Core Emits Rich AST Metadata; Extension Computes Hashes

In this model, Rust remains focused on static analysis and AST extraction. It simply stops discarding the character range and method name when creating `VulnerabilityMetadata`. The extension handles hashing, session persistence, and Trends state transitions.

#### What Rust Emits (Purely Additive, Non-Breaking)
In `VulnerabilityMetadata`:
```rust
#[derive(Debug, Clone, Serialize)]
pub struct VulnerabilityMetadata {
    // Existing fields remain unchanged...
    pub r#type: String,
    pub cwe_id: String,
    pub owasp_category: String,
    pub severity: String,
    pub file_path: String,
    pub line_number: usize,
    
    // --- Proposed New Optional Fields ---
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enclosing_symbol_path: Option<String>, // e.g. "com.example.controller.AuthController.login"

    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_column: Option<usize>,          // 0-based or 1-based character/byte column

    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_column: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<usize>,
}
```

#### Why Option A is Great:
1. **Minimal footprint on Rust:** Rust does not need to manage hashing algorithms, canonical framing, or fingerprint versions.
2. **100% Backward-compatible:** Existing consumers of `VulnerabilityMetadata` (like CLI `ariadne scan`) continue to work seamlessly; `serde` will simply omit the fields if `None`.
3. **Deletes ~100 lines of brittle code in the extension:** The TypeScript extension can completely remove the regex brace counter and whole-line slicing.

---

### Option B (Alternative): Core Computes and Emits the Fingerprints Directly

In this model, the Rust engine computes the three SHA-256 hashes right before serializing `VulnerabilityMetadata`, using the `AstForest` buffer currently in memory.

#### What Rust Emits:
```rust
#[serde(skip_serializing_if = "Option::is_none")]
pub fingerprint_version: Option<u32>,

#[serde(skip_serializing_if = "Option::is_none")]
pub logical_fingerprint: Option<String>,

#[serde(skip_serializing_if = "Option::is_none")]
pub scope_fingerprint: Option<String>,

#[serde(skip_serializing_if = "Option::is_none")]
pub content_fingerprint: Option<String>,
```

#### Pros & Cons of Option B:
- **Pro:** Complete immunity to buffer/editor desync. Rust hashes the exact AST bytes it just parsed.
- **Pro:** Resolves the startup "Cold Start" completely: disk files are hashed on the first `Init` scan.
- **Con:** Adds hashing logic (`sha2` crate or `ring`) and canonical string formatting to `ariadne-core`.
- **Con:** Bumps to fingerprint versions require changes in the Rust core repo rather than the extension repo.

---

## 5. Concrete Code Blueprint (If Option A is Chosen)

### Changes in `ariadne-core`

#### 1. `src/engine/findings/finding.rs`
- Add to `Finding`:
  ```rust
  pub enclosing_symbol_path: Option<String>,
  pub range: Option<SourceRange>,
  ```
- Update `Finding::to_metadata(&self)` to populate `enclosing_symbol_path`, `start_column`, `end_column`, `end_line` from `self.range`.

#### 2. Detectors (`taint.rs`, `pattern.rs`, `config.rs`)
- In taint analysis (`src/engine/dataflow/taint.rs`):
  - When constructing `Finding`, populate:
    - `f.enclosing_symbol_path = dfg.enclosing(file, node_range)` (or via resolver).
    - `f.range = sink_node.range` (extracting column positions instead of only `line_from_node_id`).
- In pattern detectors (`src/engine/detectors/pattern.rs`):
  - Populate `f.enclosing_symbol_path` and `f.range` directly from the matched AST node.
- In config detectors (`src/engine/detectors/config.rs`):
  - Set `f.enclosing_symbol_path = Some(property_key)`.

#### 3. Deduplication in `src/engine/findings/aggregator.rs`
- Update `dedup_key` from:
  ```rust
  (m.cwe_id.clone(), m.file_path.clone(), m.line_number, m.rule_id.clone())
  ```
  to:
  ```rust
  (m.cwe_id.clone(), m.file_path.clone(), m.line_number, m.start_column.unwrap_or(0), m.rule_id.clone())
  ```
  This prevents two distinct sinks on the same line from collapsing into one.

---

### Changes in `ariadne-extension-vscode`

1. **`vulnerabilityTypes.ts`:**
   Add `enclosing_symbol_path?`, `start_column?`, `end_column?`, `end_line?` to `VulnerabilityMetadata`.
2. **`fingerprint.ts`:**
   - Delete `deriveEnclosingSymbolPath()`, `stripForStructure()`, and regex matching helpers.
   - Use `finding.enclosing_symbol_path` directly.
   - Use `start_column` and `end_column` to slice exact tokens instead of the whole line.
3. **`convert.ts`:**
   - Replace the fallback `endColumn: 999` with `m.end_column ?? 999`, allowing accurate, tight inline squiggles in the editor.
4. **`sessionStore.ts` & `snapshotAnalyzer.ts` (Phase 2):**
   - Store the resulting fingerprints in scan snapshots and wire them to the Trends state machine.

---

## 6. Questions for Jeremiah

1. **Preference on Option A vs. Option B:** Do you prefer emitting the AST metadata (`enclosing_symbol_path` + `range`), or would you prefer the core to compute the SHA-256 hashes directly?
2. **Column 0-based vs 1-based convention:** Tree-sitter uses 0-based byte offsets for columns. Are you comfortable standardizing `start_column` / `end_column` as 0-based byte offsets (which VS Code's `Position` class natively expects)?
3. **Method Signature format:** For `enclosing_symbol_path`, would you prefer emitting `package.Class.method` or including parameter types (`package.Class.method(String, int)`) to separate overloaded methods?

---

## 7. Next Steps

- If approved, we can open a branch on `ariadne-core` to add the metadata fields and run a quick verification scan on `arinda-backend-trend-test`.
- The extension team can immediately consume the new fields without breaking any existing functionality.
