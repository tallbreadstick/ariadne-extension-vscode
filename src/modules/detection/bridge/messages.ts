/**
 * IPC message contract between the VS Code extension (TypeScript)
 * and the Ariadne SAST engine (Rust).
 *
 * Mirrors `ariadne-core/src/iostream/messages.rs`.
 * The `type` discriminant must match the Rust `serde(tag = "type")` keys exactly.
 */

export interface TextEdit {
	/** Byte offset where the replaced range starts. */
	start: number;
	/** Byte offset where the replaced range ends. */
	end: number;
	/** New text inserted at this range. */
	new_text: string;
}

export type AriadneMessage =
	/**
	 * INIT — sent once at session start.
	 * Initialises global analysis context, workspace root, rule cache.
	 */
	| { type: 'Init'; root: string }

	/**
	 * OPEN_FILE — sent when a file is first opened or discovered.
	 * Triggers initial AST parse and taint-state setup.
	 */
	| { type: 'OpenFile'; path: string; content: string }

	/**
	 * UPDATE_FILE — sent on every text-change event.
	 * Carries incremental edits for Tree-sitter `tree.edit()`.
	 * May fire many times per second; must be fast.
	 */
	| { type: 'UpdateFile'; path: string; edits: TextEdit[] }

	/**
	 * CLOSE_FILE — sent when a file is closed or evicted.
	 * Frees AST memory, symbol-table entries, and taint state.
	 */
	| { type: 'CloseFile'; path: string }

	/**
	 * ANALYZE — explicit full-analysis trigger (manual scan or debounce).
	 * path = string  → analyse that single file
	 * path = null    → analyse the entire workspace
	 */
	| { type: 'Analyze'; path: string | null };
