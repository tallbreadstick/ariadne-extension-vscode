import * as assert from 'assert';
import { createHash } from 'node:crypto';
import type { VulnerabilityMetadata } from '../modules/feedback/vulnerability_results/vulnerabilityTypes.js';
import {
	FINGERPRINT_VERSION,
	AnalysisBufferTracker,
	deriveEnclosingSymbolPath,
	fingerprintScan,
	workspaceRelativePath,
} from '../modules/detection/bridge/fingerprint.js';

const JAVA_TWO_METHODS = [
	'package com.app;',
	'',
	'public class UserRepo {',
	'    public User find(String id) {',
	'        stmt.executeQuery(id);',
	'        return null;',
	'    }',
	'',
	'    public User list() {',
	'        stmt.executeQuery("all");',
	'        return null;',
	'    }',
	'}',
	'',
].join('\n');

const FIND_QUERY_LINE = 5;
const LIST_QUERY_LINE = 10;

function meta(overrides: Partial<VulnerabilityMetadata> = {}): VulnerabilityMetadata {
	return {
		type: 'SQL Injection',
		cwe_id: 'CWE-89',
		owasp_category: 'A05 - Injection',
		severity: 'critical',
		file_path: '/proj/src/UserRepo.java',
		line_number: FIND_QUERY_LINE,
		rule_id: 'taint.sql.execute',
		instance_name: 'id',
		instance_kind: 'parameter',
		...overrides,
	};
}

function sha256(canonical: string): string {
	return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

suite('Fingerprint Phase 1', () => {
	suite('workspaceRelativePath', () => {
		test('relativizes a path under the workspace root', () => {
			assert.strictEqual(
				workspaceRelativePath('/proj/src/UserRepo.java', '/proj'),
				'src/UserRepo.java',
			);
		});

		test('returns undefined when the file is outside the root', () => {
			assert.strictEqual(
				workspaceRelativePath('/other/UserRepo.java', '/proj'),
				undefined,
			);
		});
	});

	suite('deriveEnclosingSymbolPath', () => {
		test('returns package.class.method for a line inside a method', () => {
			assert.strictEqual(
				deriveEnclosingSymbolPath(JAVA_TWO_METHODS, FIND_QUERY_LINE),
				'com.app.UserRepo.find',
			);
			assert.strictEqual(
				deriveEnclosingSymbolPath(JAVA_TWO_METHODS, LIST_QUERY_LINE),
				'com.app.UserRepo.list',
			);
		});

		test('keeps class scope when the type body opens and closes on the finding line', () => {
			assert.strictEqual(
				deriveEnclosingSymbolPath('class C { String s = "x"; }\n', 1),
				'C',
			);
		});

		test('returns package.class for a class-level field line', () => {
			const source = [
				'package com.app;',
				'public class Secrets {',
				'    private String password = "hardcoded";',
				'}',
				'',
			].join('\n');
			assert.strictEqual(
				deriveEnclosingSymbolPath(source, 3),
				'com.app.Secrets',
			);
		});

		test('returns undefined for an out-of-range line', () => {
			assert.strictEqual(deriveEnclosingSymbolPath(JAVA_TWO_METHODS, 0), undefined);
			assert.strictEqual(deriveEnclosingSymbolPath(JAVA_TWO_METHODS, 99), undefined);
		});
	});

	suite('AnalysisBufferTracker', () => {
		test('pairs the next dequeue with the buffers recorded before enqueue', () => {
			const tracker = new AnalysisBufferTracker();
			tracker.recordFile('/proj/A.java', 'class A {}');
			tracker.enqueueAnalysis();
			tracker.recordFile('/proj/A.java', 'class A { void n() {} }');
			tracker.enqueueAnalysis();

			const first = tracker.dequeueAnalysis();
			const second = tracker.dequeueAnalysis();
			assert.strictEqual(first?.get('/proj/A.java'), 'class A {}');
			assert.strictEqual(second?.get('/proj/A.java'), 'class A { void n() {} }');
			assert.strictEqual(tracker.dequeueAnalysis(), undefined);
		});

		test('recordFile does not enqueue until enqueueAnalysis', () => {
			const tracker = new AnalysisBufferTracker();
			tracker.recordFile('/proj/A.java', 'class A {}');
			assert.strictEqual(tracker.dequeueAnalysis(), undefined);
		});

		test('rename moves buffer identity without copying stale path keys', () => {
			const tracker = new AnalysisBufferTracker();
			tracker.recordFile('/proj/Old.java', 'class Old {}');
			tracker.recordRename('/proj/Old.java', '/proj/New.java');
			tracker.enqueueAnalysis();
			const snap = tracker.dequeueAnalysis();
			assert.strictEqual(snap?.get('/proj/New.java'), 'class Old {}');
			assert.strictEqual(snap?.has('/proj/Old.java'), false);
		});
	});

	suite('fingerprintScan', () => {
		const root = '/proj';

		function scanWithJava(
			findings: VulnerabilityMetadata[],
			source: string = JAVA_TWO_METHODS,
		) {
			const tracker = new AnalysisBufferTracker();
			tracker.recordFile('/proj/src/UserRepo.java', source);
			tracker.enqueueAnalysis();
			const snapshot = tracker.dequeueAnalysis();
			assert.ok(snapshot);
			return fingerprintScan(findings, snapshot, root);
		}

		test('does not include line numbers in hashes so blank lines above do not change identity', () => {
			const shifted = `\n\n${JAVA_TWO_METHODS}`;
			const original = scanWithJava([meta()], JAVA_TWO_METHODS);
			const moved = scanWithJava(
				[meta({ line_number: FIND_QUERY_LINE + 2 })],
				shifted,
			);
			assert.strictEqual(original.findings[0].fingerprint.continuityEligible, true);
			assert.strictEqual(moved.findings[0].fingerprint.continuityEligible, true);
			assert.strictEqual(
				original.findings[0].fingerprint.logicalFingerprint,
				moved.findings[0].fingerprint.logicalFingerprint,
			);
			assert.strictEqual(
				original.findings[0].fingerprint.scopeFingerprint,
				moved.findings[0].fingerprint.scopeFingerprint,
			);
			assert.strictEqual(
				original.findings[0].fingerprint.contentFingerprint,
				moved.findings[0].fingerprint.contentFingerprint,
			);
		});

		test('uses different logical and scope hashes for the same rule in two methods', () => {
			const result = scanWithJava([
				meta({ line_number: FIND_QUERY_LINE, instance_name: 'id' }),
				meta({ line_number: LIST_QUERY_LINE, instance_name: 'id' }),
			]);
			const [findRow, listRow] = result.findings;
			assert.notStrictEqual(
				findRow.fingerprint.logicalFingerprint,
				listRow.fingerprint.logicalFingerprint,
			);
			assert.notStrictEqual(
				findRow.fingerprint.scopeFingerprint,
				listRow.fingerprint.scopeFingerprint,
			);
		});

		test('changes logical hash when instance_name is renamed', () => {
			const before = scanWithJava([meta({ instance_name: 'id' })]);
			const after = scanWithJava([meta({ instance_name: 'rawId' })]);
			assert.notStrictEqual(
				before.findings[0].fingerprint.logicalFingerprint,
				after.findings[0].fingerprint.logicalFingerprint,
			);
			assert.strictEqual(
				before.findings[0].fingerprint.scopeFingerprint,
				after.findings[0].fingerprint.scopeFingerprint,
			);
		});

		test('does not change hashes when only the detector title changes', () => {
			const a = scanWithJava([meta({ type: 'SQL Injection' })]);
			const b = scanWithJava([meta({ type: 'SQLi' })]);
			assert.strictEqual(
				a.findings[0].fingerprint.logicalFingerprint,
				b.findings[0].fingerprint.logicalFingerprint,
			);
		});

		test('hashes taint origin and sink lines separately from a single-line slice', () => {
			const withTaint = scanWithJava([meta({
				taint_trace: {
					origin_line: 4,
					sink_line: FIND_QUERY_LINE,
					path_summary: 'id → executeQuery',
				},
			})]);
			const lineOnly = scanWithJava([meta()]);
			assert.strictEqual(withTaint.findings[0].fingerprint.continuityEligible, true);
			assert.notStrictEqual(
				withTaint.findings[0].fingerprint.contentFingerprint,
				lineOnly.findings[0].fingerprint.contentFingerprint,
			);
		});

		test('treats a secrets finding with no instance_name as missing enclosing path', () => {
			const tracker = new AnalysisBufferTracker();
			tracker.recordFile('/proj/src/App.java', 'class App {}\n');
			tracker.enqueueAnalysis();
			const result = fingerprintScan(
				[meta({
					file_path: '/proj/src/App.java',
					line_number: 1,
					rule_id: 'config.secrets.hardcoded',
					instance_name: '',
				})],
				tracker.dequeueAnalysis(),
				root,
			);
			assert.strictEqual(result.findings[0].fingerprint.continuityEligible, false);
			assert.strictEqual(
				result.findings[0].fingerprint.ineligibilityReason,
				'missing-enclosing-path',
			);
		});

		test('marks a scan ambiguous when two eligible rows share version+logical+scope', () => {
			const result = scanWithJava([
				meta({ line_number: FIND_QUERY_LINE, instance_name: 'stmt' }),
				meta({
					line_number: FIND_QUERY_LINE,
					instance_name: 'stmt',
					taint_trace: {
						origin_line: 4,
						sink_line: FIND_QUERY_LINE,
						path_summary: 'id → executeQuery',
					},
				}),
			]);
			assert.strictEqual(result.ambiguousCount, 2);
			assert.ok(result.findings.every((row) => row.fingerprint.continuityAmbiguous));
			assert.ok(result.findings.every((row) => row.fingerprint.continuityEligible));
			assert.notStrictEqual(
				result.findings[0].fingerprint.contentFingerprint,
				result.findings[1].fingerprint.contentFingerprint,
			);
		});

		test('treats missing rule_id as ineligible', () => {
			const result = scanWithJava([meta({ rule_id: undefined })]);
			assert.strictEqual(result.findings[0].fingerprint.continuityEligible, false);
			assert.strictEqual(result.findings[0].fingerprint.ineligibilityReason, 'missing-rule-id');
		});

		test('treats a missing file buffer as ineligible', () => {
			const tracker = new AnalysisBufferTracker();
			tracker.enqueueAnalysis();
			const result = fingerprintScan([meta()], tracker.dequeueAnalysis(), root);
			assert.strictEqual(result.findings[0].fingerprint.continuityEligible, false);
			assert.strictEqual(result.findings[0].fingerprint.ineligibilityReason, 'missing-buffer');
		});

		test('treats a missing snapshot as ineligible', () => {
			const result = fingerprintScan([meta()], undefined, root);
			assert.strictEqual(result.findings[0].fingerprint.continuityEligible, false);
			assert.strictEqual(result.findings[0].fingerprint.ineligibilityReason, 'missing-snapshot');
		});

		test('excludes .env hygiene findings from continuity', () => {
			const tracker = new AnalysisBufferTracker();
			tracker.recordFile('/proj/.env', 'SECRET=1');
			tracker.enqueueAnalysis();
			const result = fingerprintScan(
				[meta({
					type: 'Exposure of Sensitive Information',
					cwe_id: 'CWE-200',
					file_path: '/proj/.env',
					line_number: 1,
					rule_id: 'config.env.not_gitignored',
					instance_name: '.env',
					instance_kind: 'variable',
				})],
				tracker.dequeueAnalysis(),
				root,
			);
			assert.strictEqual(result.findings[0].fingerprint.continuityEligible, false);
			assert.strictEqual(
				result.findings[0].fingerprint.ineligibilityReason,
				'excluded-project-finding',
			);
		});

		test('hashes the parsed config property value, not the key', () => {
			const line = 'spring.datasource.password=s3cret';
			const tracker = new AnalysisBufferTracker();
			tracker.recordFile('/proj/src/main/resources/application.properties', line);
			tracker.enqueueAnalysis();
			const finding = meta({
				type: 'Hardcoded Credentials',
				cwe_id: 'CWE-798',
				file_path: '/proj/src/main/resources/application.properties',
				line_number: 1,
				rule_id: 'config.secrets.application_properties',
				instance_name: 'spring.datasource.password',
				instance_kind: 'variable',
			});
			const result = fingerprintScan([finding], tracker.dequeueAnalysis(), root);
			assert.strictEqual(result.findings[0].fingerprint.continuityEligible, true);

			const valueCanonical = [
				`ariadne-fp v${FINGERPRINT_VERSION} content config_property_value`,
				`value:${Buffer.byteLength('s3cret', 'utf8')}:s3cret`,
			].join('\n');
			assert.strictEqual(result.findings[0].fingerprint.contentFingerprint, sha256(valueCanonical));
		});

		test('produces different content hashes for NFC vs NFD of the same letter', () => {
			const nfc = `class C { String s = "\u00e9"; }\n`;
			const nfd = `class C { String s = "e\u0301"; }\n`;
			const a = scanWithJava(
				[meta({ file_path: '/proj/src/UserRepo.java', line_number: 1, instance_name: 's' })],
				nfc,
			);
			const b = scanWithJava(
				[meta({ file_path: '/proj/src/UserRepo.java', line_number: 1, instance_name: 's' })],
				nfd,
			);
			assert.notStrictEqual(
				a.findings[0].fingerprint.contentFingerprint,
				b.findings[0].fingerprint.contentFingerprint,
			);
		});

		test('keeps string literal text in the content hash', () => {
			const withSecret = [
				'package com.app;',
				'public class Secrets {',
				'    private String password = "hardcoded";',
				'}',
				'',
			].join('\n');
			const commented = [
				'package com.app;',
				'public class Secrets {',
				'    private String password = "hardcoded"; // ignore me',
				'}',
				'',
			].join('\n');
			const a = scanWithJava([meta({
				file_path: '/proj/src/UserRepo.java',
				line_number: 3,
				instance_name: 'password',
				rule_id: 'pattern.hardcoded.field',
			})], withSecret);
			const b = scanWithJava([meta({
				file_path: '/proj/src/UserRepo.java',
				line_number: 3,
				instance_name: 'password',
				rule_id: 'pattern.hardcoded.field',
			})], commented);
			assert.strictEqual(
				a.findings[0].fingerprint.contentFingerprint,
				b.findings[0].fingerprint.contentFingerprint,
			);
			assert.ok(withSecret.includes('hardcoded'));
		});
	});
});
