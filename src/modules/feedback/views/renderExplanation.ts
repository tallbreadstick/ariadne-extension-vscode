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
	const mistakeWhere = explanation.mistake.detail
		? `<p>${escapeHtml(explanation.mistake.detail)}</p>`
		: '';
	const saferCaption = explanation.safer.caption
		? `<p class="caption">${escapeHtml(explanation.safer.caption)}</p>`
		: '';
	const saferChange = explanation.safer.detail
		? `<p>${escapeHtml(explanation.safer.detail)}</p>`
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
		${renderDiagram(explanation.diagram)}
		<section class="explain-block">
			<h2>What the vulnerability can look like</h2>
			${mistakeCaption}
			${renderExampleCode(explanation.mistake.code, explanation.mistake.line)}
			${mistakeWhere}
		</section>
		<section class="explain-block">
			<h2>How an attacker can take advantage of this</h2>
			<p>${escapeHtml(explanation.attack)}</p>
		</section>
		<section class="explain-block">
			<h2>How to safeguard against this weakness</h2>
			${saferCaption}
			${renderExampleCode(explanation.safer.code)}
			${saferChange}
			<p class="note">Study the shape. It is not a replacement for your file.</p>
		</section>
		<section class="explain-block">
			<h2>Check your own code</h2>
			<ul>${checks}</ul>
		</section>`;
}

function renderDiagram(diagram: LLMExplanation['diagram']): string {
	if (!diagram) {
		return '';
	}
	const steps = diagram.steps.map((step, index) => {
		const join = index === 0
			? ''
			: '<li class="flow-join" aria-hidden="true"></li>';
		return `${join}<li class="flow-step ${escapeHtml(step.role)}"><span>${escapeHtml(step.label)}</span></li>`;
	}).join('');
	const caption = diagram.caption
		? `<figcaption>${escapeHtml(diagram.caption)}</figcaption>`
		: '';
	return `
		<section class="explain-block">
			<h2>A picture of the idea</h2>
			<figure class="flow">
				<ol>${steps}</ol>
				${caption}
			</figure>
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
