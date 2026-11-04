/**
 * Turns an explanation into the HTML the feedback panel inserts.
 * Example code uses the audit-graph snippet renderer.
 */

import type { LLMExplanation } from '../llm_request/requestTypes.js';
import { renderExampleCode } from '../../presentation/views/snippetSnapshot.js';

export function renderExplanation(explanation: LLMExplanation): string {
	const mistakeCaption = explanation.mistake.caption
		? `<p class="caption">${escapeHtml(explanation.mistake.caption)}</p>`
		: '';
	const saferCaption = explanation.safer.caption
		? `<p class="caption">${escapeHtml(explanation.safer.caption)}</p>`
		: '';
	const checks = explanation.checks
		.map((item) => `<li>${escapeHtml(item)}</li>`)
		.join('');

	return `
		<p class="lead">${escapeHtml(explanation.summary)}</p>
		<section class="explain-block">
			<h2>What can go wrong</h2>
			<p>${escapeHtml(explanation.why)}</p>
		</section>
		<section class="explain-block">
			<h2>An example of the mistake</h2>
			${mistakeCaption}
			${renderExampleCode(explanation.mistake.code, explanation.mistake.line)}
		</section>
		<section class="explain-block">
			<h2>What someone could send</h2>
			${explanation.attack.caption ? `<p class="caption">${escapeHtml(explanation.attack.caption)}</p>` : ''}
			${renderExampleCode(explanation.attack.code, explanation.attack.line)}
		</section>
		<section class="explain-block">
			<h2>A safer shape</h2>
			${saferCaption}
			${renderExampleCode(explanation.safer.code)}
			<p class="note">Study the shape. It is not a replacement for your file.</p>
		</section>
		<section class="explain-block">
			<h2>Check your own code</h2>
			<ul>${checks}</ul>
		</section>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
