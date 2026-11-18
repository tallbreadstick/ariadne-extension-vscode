/**
 * Payload slicing and Gzip compression for diff synchronization.
 */

import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import type { DiffResult } from './diffEngine.js';

export const CHUNK_THRESHOLD_BYTES = 64 * 1024; // 64 KB threshold for slicing

export interface DiffChunkPayload {
	format: 'ariadne-session-diff';
	version: 2;
	timestamp: string;
	trigger: 'save' | 'close';
	clientId: string | null;
	workspaceId: string;
	baseStateHash: string | null;
	targetStateHash: string;
	client: {
		extensionVersion: string;
		vscodeVersion: string;
		platform: string;
	};
	chunk: {
		chunkId: string;
		index: number;
		totalChunks: number;
	};
	delta: DiffResult;
}

/**
 * Creates one or more chunk payloads from a DiffResult.
 * If the uncompressed JSON serialization exceeds CHUNK_THRESHOLD_BYTES,
 * `upsertLifecycles` is sliced across multiple sequential chunks.
 */
export function sliceDiffPayload(
	diff: DiffResult,
	metadata: {
		trigger: 'save' | 'close';
		clientId: string | null;
		workspaceId: string;
		baseStateHash: string | null;
		targetStateHash: string;
		client: {
			extensionVersion: string;
			vscodeVersion: string;
			platform: string;
		};
	},
): DiffChunkPayload[] {
	const chunkId = crypto.randomUUID();
	const baseDelta = {
		newCompletedSessions: diff.newCompletedSessions,
		activeSessionUpdate: diff.activeSessionUpdate,
		featureCountIncrements: diff.featureCountIncrements,
	};

	// Check if single chunk fits under threshold
	const singleChunkDelta: DiffResult = {
		...baseDelta,
		upsertLifecycles: diff.upsertLifecycles,
	};

	const singlePayload: DiffChunkPayload = {
		format: 'ariadne-session-diff',
		version: 2,
		timestamp: new Date().toISOString(),
		trigger: metadata.trigger,
		clientId: metadata.clientId,
		workspaceId: metadata.workspaceId,
		baseStateHash: metadata.baseStateHash,
		targetStateHash: metadata.targetStateHash,
		client: metadata.client,
		chunk: {
			chunkId,
			index: 1,
			totalChunks: 1,
		},
		delta: singleChunkDelta,
	};

	const rawJson = JSON.stringify(singlePayload);
	if (Buffer.byteLength(rawJson, 'utf8') <= CHUNK_THRESHOLD_BYTES || diff.upsertLifecycles.length <= 1) {
		return [singlePayload];
	}

	// Needs slicing across upsertLifecycles
	// Calculate slice size estimate based on item count
	const approxBytesPerItem = Math.max(256, Math.ceil(Buffer.byteLength(rawJson, 'utf8') / diff.upsertLifecycles.length));
	const itemsPerChunk = Math.max(1, Math.floor((CHUNK_THRESHOLD_BYTES * 0.75) / approxBytesPerItem));

	const chunks: DiffChunkPayload[] = [];
	const totalItems = diff.upsertLifecycles.length;
	let startIdx = 0;

	while (startIdx < totalItems) {
		const endIdx = Math.min(startIdx + itemsPerChunk, totalItems);
		const slice = diff.upsertLifecycles.slice(startIdx, endIdx);
		chunks.push({
			format: 'ariadne-session-diff',
			version: 2,
			timestamp: new Date().toISOString(),
			trigger: metadata.trigger,
			clientId: metadata.clientId,
			workspaceId: metadata.workspaceId,
			baseStateHash: metadata.baseStateHash,
			targetStateHash: metadata.targetStateHash,
			client: metadata.client,
			chunk: {
				chunkId,
				index: chunks.length + 1,
				totalChunks: 1, // updated below once all chunks sliced
			},
			delta: {
				// Only include newCompletedSessions and activeSessionUpdate on first chunk
				newCompletedSessions: chunks.length === 0 ? baseDelta.newCompletedSessions : [],
				activeSessionUpdate: chunks.length === 0 ? baseDelta.activeSessionUpdate : null,
				featureCountIncrements: chunks.length === 0 ? baseDelta.featureCountIncrements : {
					explainVulnerabilityDelta: 0,
					auditGraphOpenDelta: 0,
					fileLocationOpenDelta: 0,
				},
				upsertLifecycles: slice,
			},
		});
		startIdx = endIdx;
	}

	// Update totalChunks across all created slices
	const totalChunks = chunks.length;
	for (const c of chunks) {
		c.chunk.totalChunks = totalChunks;
	}

	return chunks;
}

/**
 * Compresses an object using Gzip.
 */
export function compressGzip(payload: unknown): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const json = JSON.stringify(payload);
		zlib.gzip(Buffer.from(json, 'utf8'), (err, result) => {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
}
