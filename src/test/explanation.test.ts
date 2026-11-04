import * as assert from 'assert';
import { parseExplanation } from '../modules/feedback/llm_request/parseResponse.js';
import { renderExplanation } from '../modules/feedback/views/renderExplanation.js';

const sample = {
	summary: 'This is SQL injection, CWE-89.',
	why: 'An attacker can change the query and read other rows.',
	mistake: {
		caption: 'A made-up lookup that joins the name into the command.',
		line: 1,
		code: 'String query = "SELECT name FROM accounts WHERE name = \'" + name + "\'";\nStatement stmt = connection.createStatement();\nstmt.executeQuery(query);',
	},
	attack: {
		caption: 'A made-up request that puts a quote into that lookup.',
		line: 1,
		code: 'curl http://127.0.0.1:8080/accounts?name=ada\'%20OR%20\'1\'=\'1',
	},
	safer: {
		caption: 'The same lookup keeps the name beside the command.',
		code: 'PreparedStatement stmt = connection.prepareStatement(sql);\nstmt.setString(1, name);\nstmt.executeQuery();',
	},
	checks: [
		'Where does the value on this line come from?',
		'Is it joined into the command, or passed beside it?',
	],
};

describe('Explain Vulnerability response', () => {
	it('parses the explanation object', () => {
		const parsed = parseExplanation(JSON.stringify(sample));
		assert.strictEqual(parsed.summary, sample.summary);
		assert.strictEqual(parsed.mistake.line, 1);
		assert.ok(parsed.attack.code.startsWith('curl '));
		assert.deepStrictEqual(parsed.checks, sample.checks);
	});

	it('strips a java fence the model wrapped around an example', () => {
		const wrapped = {
			...sample,
			mistake: {
				caption: sample.mistake.caption,
				code: '```java\nreturn name;\n```',
			},
		};
		const parsed = parseExplanation(JSON.stringify(wrapped));
		assert.strictEqual(parsed.mistake.code, 'return name;');
	});

	it('rejects a response that is missing the example', () => {
		const { mistake: _mistake, ...rest } = sample;
		assert.throws(() => parseExplanation(JSON.stringify(rest)), /missing or empty "mistake"/);
	});

	it('renders examples with the audit-graph snippet chrome and token colors', () => {
		const html = renderExplanation(sample);
		assert.ok(html.includes('An example of the mistake'));
		assert.ok(html.includes('A safer shape'));
		assert.ok(html.includes('not a replacement for your file'));
		assert.ok(html.includes('class="code"'));
		assert.ok(html.includes('What someone could send'));
		assert.ok(html.includes('class="code-line mark"'));
		const mistake = html.split('An example of the mistake')[1]?.split('What someone could send')[0] ?? '';
		assert.match(mistake, /class="code-line mark"[\s\S]*SELECT name FROM accounts/);
		const safer = html.split('A safer shape')[1] ?? '';
		assert.ok(!safer.includes('code-line mark'));
		assert.ok(html.includes('class="ln"'));
		assert.ok(html.includes('<span class="ln">1</span>'));
		assert.match(html, /<span style="color:[^"]+">String<\/span>/);
		assert.match(html, /<span style="color:[^"]+">executeQuery<\/span>/);
		assert.ok(html.includes('SELECT name FROM accounts'));
		assert.ok(!html.includes('<script'));
	});
});
