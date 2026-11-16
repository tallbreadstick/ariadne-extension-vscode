import { PendingResolutionItem } from '../panelTypes.js';

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export const PENDING_RESOLUTIONS_CSS = /* css */ `
	/* ── Pending Resolution Per-Save Counter Section ── */
	.pending-resolutions-section {
		border-top: 1px solid var(--vscode-panel-border);
		background: color-mix(in srgb, var(--accent) 6%, var(--panel));
		padding: 10px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.pending-resolutions-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}

	.pending-resolutions-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--accent-strong);
	}

	.pending-resolutions-hint {
		font-size: 11px;
		color: var(--muted);
	}

	.pending-resolutions-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 170px;
		overflow-y: auto;
		padding-right: 2px;
	}

	.pending-resolution-row {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 10px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--vscode-editor-background) 75%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
		flex-wrap: wrap;
	}

	.pending-resolution-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.pending-resolution-type {
		font-size: 12px;
		font-weight: 600;
		color: var(--text);
	}

	.pending-resolution-instance {
		font-weight: 400;
		color: var(--muted);
	}

	.pending-resolution-sub {
		font-size: 11px;
		color: var(--muted);
	}

	.pending-resolution-steps {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 3px 9px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border));
		flex-shrink: 0;
	}

	.save-step-dots {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.save-step-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--muted) 35%, transparent);
		border: 1px solid color-mix(in srgb, var(--muted) 60%, transparent);
	}

	.save-step-dot.filled {
		background: var(--accent-strong);
		border-color: var(--accent-strong);
	}

	.save-step-counter {
		font-size: 11px;
		font-weight: 700;
		color: var(--accent-strong);
		white-space: nowrap;
	}
`;

/**
 * Formats the save-confirmation guidance copy and 3-dot progress HTML
 * for a single pending resolution item.
 */
export function getPendingResolutionDetails(item: PendingResolutionItem): {
	guidance: string;
	savesLeftLabel: string;
	dotsHtml: string;
} {
	const savesLeft = item.savesRequired - item.savesCompleted;
	const savesLeftLabel = savesLeft === 1 ? '1 save left' : `${savesLeft} saves left`;
	const guidance = item.savesCompleted === 0
		? `Fix detected by Live Scan · Save file to start (${savesLeftLabel})`
		: item.savesCompleted === 1
			? `Wait 5s, then save again (${savesLeftLabel})`
			: `Almost done · Save 1 more time to confirm (${savesLeftLabel})`;

	const dotsHtml = [0, 1, 2].map((idx) => {
		const filled = idx < item.savesCompleted ? ' filled' : '';
		return `<span class="save-step-dot${filled}"></span>`;
	}).join('');

	return { guidance, savesLeftLabel, dotsHtml };
}

/**
 * Builds the "Confirming Resolution" strip showing live-fixed findings that
 * are awaiting multi-save confirmation before being counted as resolved.
 */
export function buildPendingResolutionsSection(items: PendingResolutionItem[] | undefined): string {
	if (!items || items.length === 0) {
		return '';
	}

	const grouped = new Map<string, { item: PendingResolutionItem; count: number }>();
	for (const item of items) {
		const key = `${item.type}::${item.savesCompleted}`;
		const existing = grouped.get(key);
		if (existing) {
			existing.count += 1;
		} else {
			grouped.set(key, { item, count: 1 });
		}
	}
	const groups = [...grouped.values()].sort((a, b) =>
		b.item.savesCompleted - a.item.savesCompleted || a.item.type.localeCompare(b.item.type));

	const rows = groups.map(({ item, count }) => {
		const { guidance, savesLeftLabel, dotsHtml } = getPendingResolutionDetails(item);

		const instanceSuffix = count > 1
			? ` <span class="pending-resolution-instance">(${count} instances)</span>`
			: item.instanceName
				? ` <span class="pending-resolution-instance">· ${escapeHtml(item.instanceName)}</span>`
				: '';

		return /* html */ `
			<div class="pending-resolution-row">
				<div class="pending-resolution-info">
					<span class="pending-resolution-type">${escapeHtml(item.type)}${instanceSuffix}</span>
					<span class="pending-resolution-sub">${guidance}</span>
				</div>
				<div class="pending-resolution-steps" title="${item.savesCompleted} of ${item.savesRequired} confirmation saves completed (${savesLeftLabel})">
					<span class="save-step-dots" aria-hidden="true">${dotsHtml}</span>
					<span class="save-step-counter">Save ${item.savesCompleted}/${item.savesRequired}</span>
				</div>
			</div>`;
	}).join('');

	return /* html */ `
		<div class="pending-resolutions-section" role="status" aria-live="polite">
			<div class="pending-resolutions-header">
				<span class="pending-resolutions-title">Confirming Resolution (${items.length})</span>
				<span class="pending-resolutions-hint">Requires 3 settled saves (≥5s apart) to record in Full Report</span>
			</div>
			<div class="pending-resolutions-list">
				${rows}
			</div>
		</div>`;
}
