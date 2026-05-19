/**
 * IPC message contract between VS Code (TypeScript)
 * and the Ariadne SAST engine (Rust).
 *
 * MUST mirror:
 * ariadne-core/src/iostream/messages.rs
 */

export interface TextEdit {
	start: number;
	end: number;
	new_text: string;
}

export type AriadneMessage =
	// ============================================================
	// SESSION LIFECYCLE
	// ============================================================

	| { type: 'Init'; root: string }

	// ============================================================
	// FILESYSTEM EVENTS
	// ============================================================

	| { type: 'CreateFile'; path: string; content: string }

	| { type: 'DeleteFile'; path: string }

	| { type: 'RenameFile'; old_path: string; new_path: string }

	// ============================================================
	// EDITOR EVENTS
	// ============================================================

	| { type: 'OpenFile'; path: string; content: string }

	| { type: 'UpdateFile'; path: string; edits: TextEdit[] }

	| { type: 'CloseFile'; path: string }

	// ============================================================
	// ANALYSIS CONTROL
	// ============================================================

	| { type: 'Analyze'; path: string | null };