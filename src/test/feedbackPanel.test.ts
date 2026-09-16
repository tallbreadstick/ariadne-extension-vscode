import * as assert from 'assert';
import { formatDisplayPath, buildFeedbackPanelHtml } from '../modules/feedback/views/feedbackPanel.js';
import type { VulnerabilityMetadata } from '../modules/feedback/vulnerability_results/vulnerabilityTypes.js';

describe('Feedback Panel File Path Display Test Suite', () => {
	describe('formatDisplayPath', () => {
		it('returns empty string when given empty path', () => {
			assert.strictEqual(formatDisplayPath(''), '');
		});

		it('returns bare filename when no directories present', () => {
			assert.strictEqual(formatDisplayPath('LandlordController.java'), 'LandlordController.java');
		});

		it('returns path as-is when only two segments exist (POSIX)', () => {
			assert.strictEqual(formatDisplayPath('controller/LandlordController.java'), 'controller/LandlordController.java');
		});

		it('normalizes backslashes for two-segment paths (Windows)', () => {
			assert.strictEqual(formatDisplayPath('controller\\LandlordController.java'), 'controller/LandlordController.java');
		});

		it('shortens deeply nested Windows absolute paths to parent and filename with ellipsis', () => {
			const winPath = 'c:\\Users\\Florence\\Documents\\! PROJECTS\\arinda-housing\\back\\arinda-backend\\src\\main\\java\\com\\abemivi\\arinda\\arindabackend\\controller\\LandlordController.java';
			assert.strictEqual(formatDisplayPath(winPath), '.../controller/LandlordController.java');
		});

		it('shortens deeply nested POSIX paths to parent and filename with ellipsis', () => {
			const posixPath = '/home/florence/dev/project/src/controllers/userController.ts';
			assert.strictEqual(formatDisplayPath(posixPath), '.../controllers/userController.ts');
		});

		it('handles Windows drive root paths cleanly', () => {
			assert.strictEqual(formatDisplayPath('c:\\file.txt'), 'file.txt');
			assert.strictEqual(formatDisplayPath('C:\\folder\\file.txt'), 'folder/file.txt');
		});
	});

	describe('buildFeedbackPanelHtml', () => {
		const mockMeta: VulnerabilityMetadata = {
			type: 'SQL Injection',
			cwe_id: 'CWE-89',
			owasp_category: 'A03:2021-Injection',
			severity: 'critical',
			file_path: 'c:\\Users\\Florence\\Documents\\! PROJECTS\\arinda-housing\\back\\arinda-backend\\src\\main\\java\\com\\abemivi\\arinda\\arindabackend\\controller\\LandlordController.java',
			line_number: 41,
		};

		it('renders shortened display path with full path in title tooltip', () => {
			const html = buildFeedbackPanelHtml(mockMeta);

			// Should render shortened path
			assert.ok(
				html.includes('.../controller/LandlordController.java:41'),
				'HTML should contain the shortened display path',
			);

			// Should contain full path in title attribute for hover inspection
			assert.ok(
				html.includes('title="c:\\Users\\Florence\\Documents\\! PROJECTS\\arinda-housing\\back\\arinda-backend\\src\\main\\java\\com\\abemivi\\arinda\\arindabackend\\controller\\LandlordController.java:41"'),
				'HTML should contain the full path in title attribute for hover tooltip',
			);
		});

		it('includes CSS rules preventing horizontal overflow', () => {
			const html = buildFeedbackPanelHtml(mockMeta);

			assert.ok(html.includes('overflow-x: hidden;'), 'Body should have overflow-x: hidden');
			assert.ok(html.includes('.header-sub > span.meta-file'), 'CSS should have specific meta-file rules');
			assert.ok(html.includes('text-overflow: ellipsis;'), 'CSS should truncate long text with ellipsis');
		});
	});
});
