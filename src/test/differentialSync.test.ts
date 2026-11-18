import * as assert from 'assert';
import * as zlib from 'node:zlib';
import { computeStateHash, computeWorkspaceId } from '../modules/tracker/ingest/diff/stateHasher.js';
import { extractDiff } from '../modules/tracker/ingest/diff/diffEngine.js';
import { sliceDiffPayload, compressGzip, CHUNK_THRESHOLD_BYTES } from '../modules/tracker/ingest/diff/chunker.js';
import type { FindingLifecycleRecord, SessionRecord } from '../modules/tracker/analysis/lifecycleTypes.js';

function createMockLifecycle(id: string, timestamp: number): FindingLifecycleRecord {
	return {
		logicalFingerprint: `CWE-89:rawQuery:${id}.java:10`,
		contentFingerprint: 'mock-content',
		scopeFingerprint: 'mock-scope',
		ruleId: 'sql-injection-rule',
		cweId: 'CWE-89',
		type: 'SQL Injection',
		severity: 'high',
		instanceName: 'rawQuery',
		filePath: `src/${id}.java`,
		firstConfirmedAt: timestamp,
		lastConfirmedAt: timestamp,
		missingSince: null,
		provisionalResolutionAt: null,
		durableResolutionAt: null,
		baselineOccurrenceCount: 1,
		currentOccurrenceCount: 1,
		confirmationCount: 2,
		recurrenceCount: 0,
		lastRecurredAt: null,
		inSessionToggleCount: 0,
		identicalRestorationCount: 0,
		lifecycleState: 'persisting',
	};
}

describe('differentialSync', () => {
	describe('stateHasher', () => {
		it('computes consistent hashes for identical states regardless of order', () => {
			const lc1 = createMockLifecycle('A', 1000);
			const lc2 = createMockLifecycle('B', 2000);

			const meta = {
				sessionStartTime: 1000,
				totalScansCount: 5,
				scanIdSeed: 5,
				sessionIdSeed: 1,
			};

			const hash1 = computeStateHash({
				findingLifecycles: [lc1, lc2],
				activeSession: null,
				completedSessions: [],
				sessionMeta: meta,
			});

			const hash2 = computeStateHash({
				findingLifecycles: [lc2, lc1],
				activeSession: null,
				completedSessions: [],
				sessionMeta: meta,
			});

			assert.strictEqual(hash1, hash2);
			assert.strictEqual(hash1.length, 64);
		});

		it('changes hash when a lifecycle is modified', () => {
			const lc1 = createMockLifecycle('A', 1000);
			const meta = {
				sessionStartTime: 1000,
				totalScansCount: 5,
				scanIdSeed: 5,
				sessionIdSeed: 1,
			};

			const hashOriginal = computeStateHash({
				findingLifecycles: [lc1],
				activeSession: null,
				completedSessions: [],
				sessionMeta: meta,
			});

			const modifiedLc = { ...lc1, confirmationCount: 3 };
			const hashModified = computeStateHash({
				findingLifecycles: [modifiedLc],
				activeSession: null,
				completedSessions: [],
				sessionMeta: meta,
			});

			assert.notStrictEqual(hashOriginal, hashModified);
		});

		it('computes stable workspace id', () => {
			const id1 = computeWorkspaceId('/path/to/project');
			const id2 = computeWorkspaceId('/path/to/project/');
			assert.strictEqual(computeWorkspaceId('/path/to/project'), id1);
			assert.strictEqual(id1.length, 64);
		});
	});

	describe('diffEngine', () => {
		it('extracts only newly modified lifecycles after lastSyncedTimestamp', () => {
			const lcOld = createMockLifecycle('Old', 1000);
			const lcNew = createMockLifecycle('New', 5000);

			const diff = extractDiff({
				currentLifecycles: [lcOld, lcNew],
				currentCompletedSessions: [],
				activeSession: null,
				lastSyncedTimestamp: 3000,
				featureCounts: {
					explainVulnerabilityCount: 5,
					auditGraphOpenCount: 2,
					fileLocationOpenCount: 1,
				},
				lastSyncedFeatureCounts: {
					explainVulnerabilityCount: 3,
					auditGraphOpenCount: 2,
					fileLocationOpenCount: 0,
				},
			});

			assert.strictEqual(diff.upsertLifecycles.length, 1);
			assert.strictEqual(diff.upsertLifecycles[0].logicalFingerprint, lcNew.logicalFingerprint);
			assert.strictEqual(diff.featureCountIncrements.explainVulnerabilityDelta, 2);
			assert.strictEqual(diff.featureCountIncrements.auditGraphOpenDelta, 0);
			assert.strictEqual(diff.featureCountIncrements.fileLocationOpenDelta, 1);
		});

		it('filters out already-known completed sessions', () => {
			const s1: SessionRecord = {
				sessionId: 'session-001',
				startedAt: 1000,
				endedAt: 2000,
				status: 'completed',
				baselineCheckpoint: null,
				finalCheckpoint: null,
				lifecycleSummaries: [],
			};
			const s2: SessionRecord = {
				sessionId: 'session-002',
				startedAt: 2000,
				endedAt: 3000,
				status: 'completed',
				baselineCheckpoint: null,
				finalCheckpoint: null,
				lifecycleSummaries: [],
			};

			const diff = extractDiff({
				currentLifecycles: [],
				currentCompletedSessions: [s1, s2],
				activeSession: null,
				knownCompletedSessionIds: ['session-001'],
				featureCounts: {
					explainVulnerabilityCount: 0,
					auditGraphOpenCount: 0,
					fileLocationOpenCount: 0,
				},
			});

			assert.strictEqual(diff.newCompletedSessions.length, 1);
			assert.strictEqual(diff.newCompletedSessions[0].sessionId, 'session-002');
		});
	});

	describe('chunker', () => {
		it('generates a single chunk when under the threshold', () => {
			const diff = extractDiff({
				currentLifecycles: [createMockLifecycle('Small', 1000)],
				currentCompletedSessions: [],
				activeSession: null,
				featureCounts: {
					explainVulnerabilityCount: 0,
					auditGraphOpenCount: 0,
					fileLocationOpenCount: 0,
				},
			});

			const chunks = sliceDiffPayload(diff, {
				trigger: 'save',
				clientId: 'client-1',
				workspaceId: 'ws-1',
				baseStateHash: 'base-1',
				targetStateHash: 'target-1',
				client: {
					extensionVersion: '0.1.6',
					vscodeVersion: '1.100.0',
					platform: 'linux-x64',
				},
			});

			assert.strictEqual(chunks.length, 1);
			assert.strictEqual(chunks[0].chunk.totalChunks, 1);
			assert.strictEqual(chunks[0].chunk.index, 1);
		});

		it('slices lifecycles into multiple chunks when payload exceeds threshold', () => {
			// Generate enough items to exceed 64 KB
			const manyLifecycles: FindingLifecycleRecord[] = [];
			for (let i = 0; i < 200; i++) {
				manyLifecycles.push(createMockLifecycle(`Item_${i}`, 1000 + i));
			}

			const diff = extractDiff({
				currentLifecycles: manyLifecycles,
				currentCompletedSessions: [],
				activeSession: null,
				featureCounts: {
					explainVulnerabilityCount: 0,
					auditGraphOpenCount: 0,
					fileLocationOpenCount: 0,
				},
			});

			const chunks = sliceDiffPayload(diff, {
				trigger: 'save',
				clientId: 'client-1',
				workspaceId: 'ws-1',
				baseStateHash: 'base-1',
				targetStateHash: 'target-1',
				client: {
					extensionVersion: '0.1.6',
					vscodeVersion: '1.100.0',
					platform: 'linux-x64',
				},
			});

			assert.ok(chunks.length > 1, `Expected multiple chunks, got ${chunks.length}`);
			for (let i = 0; i < chunks.length; i++) {
				assert.strictEqual(chunks[i].chunk.index, i + 1);
				assert.strictEqual(chunks[i].chunk.totalChunks, chunks.length);
				assert.strictEqual(chunks[i].chunk.chunkId, chunks[0].chunk.chunkId);
			}

			// Total sliced items should match original count
			const totalRecovered = chunks.reduce((sum, c) => sum + c.delta.upsertLifecycles.length, 0);
			assert.strictEqual(totalRecovered, 200);
		});

		it('compresses payloads with Gzip correctly', async () => {
			const data = { message: 'hello world', numbers: [1, 2, 3, 4, 5] };
			const compressed = await compressGzip(data);
			assert.ok(Buffer.isBuffer(compressed));

			const decompressed = zlib.gunzipSync(compressed).toString('utf8');
			assert.deepStrictEqual(JSON.parse(decompressed), data);
		});
	});
});
