import * as assert from 'assert';
import { parseExplanation } from '../modules/feedback/llm_request/parseResponse.js';
import { renderExplanation } from '../modules/feedback/views/renderExplanation.js';

const sample = {
	summary: 'This is SQL injection, CWE-89. A program builds a database question by pasting in text a person typed.',
	why: 'Someone can change what the question asks and read other rows.',
	diagram: {
		caption: 'A made-up story, not the student program.',
		steps: [
			{ label: 'A visitor types a name', role: 'start' as const },
			{ label: 'The name is mixed into the question', role: 'weak' as const },
			{ label: 'The database follows that mixed text', role: 'harm' as const },
		],
	},
	mistake: {
		caption: 'A made-up lookup that joins the name into the command.',
		where: 'The highlighted line is the weak one, because the typed name becomes part of the question.',
		line: 1,
		code: 'String query = "SELECT name FROM accounts WHERE name = \'" + name + "\'";\nStatement stmt = connection.createStatement();\nstmt.executeQuery(query);',
	},
	attack: 'A person could type a name that also changes the question, so the lookup no longer means only that name.',
	safer: {
		caption: 'The same lookup keeps the name beside the command.',
		change: 'The question stays fixed and the name is passed beside it, so extra words in the name cannot change the question.',
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
		assert.strictEqual(parsed.mistake.detail, sample.mistake.where);
		assert.strictEqual(parsed.attack, sample.attack);
		assert.strictEqual(parsed.diagram?.steps.length, 3);
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
		const html = renderExplanation(parseExplanation(JSON.stringify(sample)));
		assert.ok(html.includes('What the vulnerability can look like'));
		assert.ok(html.includes('How to safeguard against this weakness'));
		assert.ok(html.includes('not a replacement for your file'));
		assert.ok(html.includes('class="code"'));
		assert.ok(html.includes('How an attacker can take advantage of this'));
		assert.ok(html.includes('class="flow"'));
		assert.ok(html.includes('class="flow-step weak"'));
		assert.ok(html.includes('The highlighted line is the weak one'));
		assert.ok(html.includes('The question stays fixed'));
		assert.ok(!html.includes('curl '));
		assert.ok(html.includes('class="code-line mark"'));
		const mistake = html.split('What the vulnerability can look like')[1]?.split('How an attacker can take advantage of this')[0] ?? '';
		assert.match(mistake, /class="code-line mark"[\s\S]*SELECT name FROM accounts/);
		const safer = html.split('How to safeguard against this weakness')[1] ?? '';
		assert.ok(!safer.includes('code-line mark'));
		assert.ok(html.includes('class="ln"'));
		assert.ok(html.includes('<span class="ln">1</span>'));
		assert.match(html, /<span style="color:[^"]+">String<\/span>/);
		assert.match(html, /<span style="color:[^"]+">executeQuery<\/span>/);
		assert.ok(html.includes('SELECT name FROM accounts'));
		assert.ok(!html.includes('<script'));
	});
});
