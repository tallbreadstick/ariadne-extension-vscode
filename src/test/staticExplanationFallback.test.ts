import * as assert from 'assert';
import {
	buildStaticExplanation,
	staticExplanationPreamble,
} from '../modules/feedback/llm_feedback/staticExplanationFallback.js';
import type { VulnerabilityMetadata } from '../modules/feedback/vulnerability_results/vulnerabilityTypes.js';

function meta(overrides: Partial<VulnerabilityMetadata> = {}): VulnerabilityMetadata {
	return {
		type: 'SQL Injection',
		cwe_id: 'CWE-89',
		owasp_category: 'OWASP A03:2021 - Injection',
		severity: 'high',
		file_path: 'src/Db.java',
		line_number: 42,
		...overrides,
	};
}

describe('staticExplanationFallback', () => {
	it('provides CWE-specific SQLi content', () => {
		const explanation = buildStaticExplanation(meta());
		assert.ok(explanation.summary.includes('CWE-89'));
		assert.ok(explanation.checks.length >= 2);
		assert.ok(explanation.mistake.code.includes('PreparedStatement') === false);
		assert.ok(explanation.safer.code.includes('PreparedStatement'));
	});

	it('falls back to generic template for unknown CWE', () => {
		const explanation = buildStaticExplanation(meta({
			type: 'Obscure Pattern',
			cwe_id: 'CWE-99999',
		}));
		assert.ok(explanation.summary.includes('CWE-99999'));
		assert.ok(explanation.checks.some((c) => c.includes('line 42')));
	});

	it('includes an offline preamble with the finding line', () => {
		const html = staticExplanationPreamble(42);
		assert.ok(html.includes('fallback-note'));
		assert.ok(html.includes('line 42'));
	});
});
