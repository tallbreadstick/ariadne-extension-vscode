/**
 * Workspace revision tracker for the save-triggered scan settlement gate.
 *
 * The extension keeps one monotonically increasing `workspaceRevision`
 * number. It increments whenever a tracked file changes, is created,
 * deleted, or renamed. A save scan request records the revision at the
 * moment of the save so the findings callback can check whether the
 * workspace changed during the scan.
 *
 * Settlement rule (Section 2.1 of ariadne-trends-framework-realtime-
 * stability-and-cohort-clarification.md):
 *
 *   1. Save fires at revision N.
 *   2. Result arrives → valid only if revision is still N.
 *   3. 2-second timer starts.
 *   4. If any tracked file changes, revision becomes N+1; timer is
 *      cancelled — result is not settled.
 *   5. If timer expires with revision still N → settled.
 *
 * No vscode import — pure state logic, fully testable.
 */

// ── Workspace revision ────────────────────────────────────────────────

let workspaceRevision = 0;

/** Increments the revision and returns the new value. */
export function incrementRevision(): number {
	workspaceRevision += 1;
	return workspaceRevision;
}

/** Returns the current workspace revision without mutating it. */
export function getCurrentRevision(): number {
	return workspaceRevision;
}

// ── Pending save request ──────────────────────────────────────────────

/**
 * Snapshot of the workspace state at the moment a save-triggered scan
 * was requested. Used to validate the corresponding findings result.
 */
export interface PendingSaveRequest {
	/** Workspace revision when the save scan was sent. */
	revision: number;
	/** Epoch ms when the save scan was sent (for timeout guard). */
	requestedAt: number;
}

let pendingSaveRequest: PendingSaveRequest | null = null;

/**
 * Records a pending save request. Call this immediately before sending
 * the `Analyze` IPC message on a tracked-file save.
 */
export function setPendingSaveRequest(req: PendingSaveRequest): void {
	pendingSaveRequest = req;
}

/** Clears the pending save request after the result is processed. */
export function clearPendingSaveRequest(): void {
	pendingSaveRequest = null;
}

/** Returns the current pending save request, or null if none. */
export function getPendingSaveRequest(): PendingSaveRequest | null {
	return pendingSaveRequest;
}
