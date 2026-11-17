/**
 * Comment detection utility for finding lifecycle records.
 *
 * Checks whether a previously detected vulnerability's code in a source file
 * has been commented out (using single-line // or block /* ... * / comments)
 * rather than genuinely remediated.
 *
 * When code is commented out, the SAST scanner skips it and reports absence.
 * This detector prevents such absences from falsely transitioning to 'resolved'.
 */

export interface ParsedLineInfo {
	text: string;
	hasActiveCode: boolean;
	isDocstring: boolean;
	isCommentOnly: boolean;
	commentText: string;
}

/**
 * Parses file content into structured line information distinguishing active code,
 * docstrings (Javadoc / JSDoc / Python docstrings), and ordinary comments.
 */
export function parseFileLines(fileContent: string): ParsedLineInfo[] {
	const rawLines = fileContent.split(/\r?\n/);
	const parsed: ParsedLineInfo[] = [];

	let inBlockComment = false;
	let inDocstring = false;
	let pythonDocQuote: '"""' | "'''" | null = null;

	for (let i = 0; i < rawLines.length; i++) {
		const line = rawLines[i];
		let j = 0;
		let lineActiveChars = 0;
		let lineCommentText = '';
		let lineIsDocstring = inDocstring || pythonDocQuote !== null;
		let inStringQuote: string | null = null;

		// Check for Python triple-quote docstring continuation
		if (pythonDocQuote !== null) {
			const endIdx = line.indexOf(pythonDocQuote);
			if (endIdx !== -1) {
				lineCommentText += line.slice(0, endIdx);
				pythonDocQuote = null;
				j = endIdx + 3;
			} else {
				lineCommentText += line;
				parsed.push({
					text: line,
					hasActiveCode: false,
					isDocstring: true,
					isCommentOnly: true,
					commentText: lineCommentText.trim(),
				});
				continue;
			}
		}

		while (j < line.length) {
			const ch = line[j];
			const next = j + 1 < line.length ? line[j + 1] : '';

			if (inBlockComment) {
				if (ch === '*' && next === '/') {
					inBlockComment = false;
					inDocstring = false;
					j += 2;
					continue;
				}
				lineCommentText += ch;
				j++;
				continue;
			}

			if (inStringQuote !== null) {
				lineActiveChars++;
				if (ch === '\\') {
					j += 2; // skip escaped char
					continue;
				}
				if (ch === inStringQuote) {
					inStringQuote = null;
				}
				j++;
				continue;
			}

			// Check for Python triple-quote docstring start at statement level
			const slice3 = line.slice(j, j + 3);
			if (lineActiveChars === 0 && (slice3 === '"""' || slice3 === "'''")) {
				const quote = slice3 as '"""' | "'''";
				const closingIdx = line.indexOf(quote, j + 3);
				if (closingIdx !== -1) {
					// Single-line docstring
					lineCommentText += line.slice(j + 3, closingIdx);
					lineIsDocstring = true;
					j = closingIdx + 3;
					continue;
				} else {
					// Multi-line docstring begins
					pythonDocQuote = quote;
					lineIsDocstring = true;
					lineCommentText += line.slice(j + 3);
					break;
				}
			}

			// String literals
			if (ch === '"' || ch === '\'' || ch === String.fromCharCode(96)) {
				inStringQuote = ch;
				lineActiveChars++;
				j++;
				continue;
			}

			// Single-line comment //
			if (ch === '/' && next === '/') {
				lineCommentText += line.slice(j + 2);
				break;
			}

			// Single-line hash comment #
			if (ch === '#' && (j === 0 || /\s/.test(line[j - 1]))) {
				lineCommentText += line.slice(j + 1);
				break;
			}

			// Block comment /*
			if (ch === '/' && next === '*') {
				inBlockComment = true;
				// Check for Javadoc /** (and not /**/)
				const third = j + 2 < line.length ? line[j + 2] : '';
				const fourth = j + 3 < line.length ? line[j + 3] : '';
				if (third === '*' && fourth !== '/' && fourth !== '*') {
					inDocstring = true;
					lineIsDocstring = true;
				} else {
					inDocstring = false;
				}
				j += 2;
				continue;
			}

			if (!/\s/.test(ch)) {
				lineActiveChars++;
			}
			j++;
		}

		const hasActiveCode = lineActiveChars > 0;
		const trimmedComment = lineCommentText.trim();
		const isCommentOnly = !hasActiveCode && trimmedComment.length > 0;

		parsed.push({
			text: line,
			hasActiveCode,
			isDocstring: lineIsDocstring,
			isCommentOnly,
			commentText: trimmedComment,
		});
	}

	return parsed;
}

/**
 * Determines whether a comment string represents commented-out code
 * rather than documentation, annotations, or prose text.
 */
export function isCommentedCode(commentStr: string, instanceName?: string): boolean {
	if (!commentStr || typeof commentStr !== 'string') {
		return false;
	}

	// Clean comment delimiters (*, #, /) and leading/trailing whitespace
	const cleaned = commentStr.replace(/^[\s*#/]+/, '').replace(/[\s*#/]+$/, '').trim();
	if (cleaned.length === 0) {
		return false;
	}

	// 1. Documentation tags (Javadoc, JSDoc, TypeDoc, etc.)
	if (/@(?:param|return|returns|throws|exception|see|since|author|version|deprecated|link|code|type|api)\b/i.test(cleaned)) {
		return false;
	}

	// 2. Prose / Annotation label prefixes (e.g. "TODO:", "NOTE:", "VULN:", "BUG:", "FIXME:")
	if (/^(?:TODO|FIXME|NOTE|HACK|BUG|VULN|XXX|INFO|WARN|WARNING|TIP|SEE|DOC|DESCRIPTION)\b[:\s\-—]/i.test(cleaned)) {
		return false;
	}

	// 3. Prose sentences with em-dash or en-dash lacking statement syntax
	if (/[—–]/.test(cleaned) && !/;\s*$/.test(cleaned) && !/\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(cleaned)) {
		return false;
	}

	// 4. English sentence starters followed by normal prose
	if (/^(?:Includes|Contains|Checks|Returns|Represents|Provides|Handles|Deprecated|This|The|When|Where|Why|How|Because|Ensure|Verify|Support|Disable|Enable|Allow|Prevent|Avoid|Require|Sensitive)\b\s+[a-zA-Z]/i.test(cleaned)) {
		if (!/;\s*$/.test(cleaned) && !/(?<![!=<>&|])=(?![=>])/.test(cleaned) && !/\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(cleaned)) {
			return false;
		}
	}

	// 5. Code syntax indicators
	const hasKeyword = /\b(?:const|let|var|function|def|class|interface|import|export|return|throw|new|if|while|for|switch|case|package|private|public|protected|static|final|void|int|long|boolean|char|double|float|String|val|fun)\b/.test(cleaned);
	const hasCall = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(cleaned);
	const hasAssignment = /(?<![!=<>&|])=(?![=>])|:=/.test(cleaned);
	const hasSemicolon = /;\s*$/.test(cleaned) || /;\s*(?:\/\/|\/\*|$)/.test(cleaned);
	const hasCast = /\([A-Za-z_$][a-zA-Z0-9_$]*\)\s*[a-zA-Z_$]/.test(cleaned);

	const isCodeStatement = (hasKeyword && (hasAssignment || hasCall || hasSemicolon)) ||
		(hasCall && hasSemicolon) ||
		(hasAssignment && hasSemicolon) ||
		(hasCast && (hasAssignment || hasSemicolon)) ||
		hasKeyword ||
		(hasCall && !/[.?!]$/.test(cleaned));

	if (!isCodeStatement) {
		return false;
	}

	// 6. If instanceName is provided, verify it is involved in the commented code
	const cleanInstance = instanceName?.trim();
	if (cleanInstance && cleanInstance.length > 0) {
		const hasInstance = cleanInstance.includes('.') || cleanInstance.includes('(')
			? cleaned.includes(cleanInstance)
			: new RegExp('\\b' + escapeRegExp(cleanInstance) + '\\b').test(cleaned);

		if (!hasInstance) {
			return false;
		}
	}

	return true;
}

function escapeRegExp(str: string): string {
	return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Checks whether a finding's code location in a source file is commented out.
 *
 * @param fileContent - The full string content of the source file.
 * @param lineNumber - 1-based line number where the finding was last observed.
 * @param instanceName - Optional symbol/variable/method name of the finding.
 * @param endLine - Optional 1-based ending line number of the finding.
 * @returns true if the code at or around the finding is commented out.
 */
export function isCodeCommentedOut(
	fileContent: string,
	lineNumber?: number,
	instanceName?: string,
	endLine?: number,
): boolean {
	if (!fileContent || typeof fileContent !== 'string') {
		return false;
	}

	const parsedLines = parseFileLines(fileContent);
	const totalLines = parsedLines.length;
	if (totalLines === 0) {
		return false;
	}

	const cleanInstance = instanceName?.trim();

	if (typeof lineNumber === 'number' && lineNumber >= 1) {
		const targetIdx = lineNumber - 1;
		const lastIdx = (typeof endLine === 'number' && endLine >= lineNumber)
			? Math.min(totalLines - 1, endLine - 1)
			: Math.min(totalLines - 1, targetIdx);

		// If the target line itself currently contains active executable code,
		// the statement is active in the codebase and was not commented out
		// (unless an exact commented copy of the vulnerable symbol exists nearby and the active line is unrelated).
		const targetHasActiveCode = targetIdx < totalLines && parsedLines[targetIdx].hasActiveCode;

		// 1. Check target line(s) directly
		for (let i = targetIdx; i <= lastIdx; i++) {
			const lineInfo = parsedLines[i];
			if (lineInfo.isCommentOnly && !lineInfo.isDocstring) {
				if (isCommentedCode(lineInfo.commentText, cleanInstance)) {
					return true;
				}
				if (!cleanInstance && isCommentedCode(lineInfo.commentText)) {
					return true;
				}
			}
		}

		// 2. If target line has active code, check if the symbol was commented out nearby
		// If cleanInstance is known, check if it exists in commented code within ±5 lines
		// BUT only if cleanInstance is NOT present in the active code at/around target
		const searchStart = Math.max(0, targetIdx - 5);
		const searchEnd = Math.min(totalLines - 1, lastIdx + 5);

		// Check if active code in the search window already contains the remediated symbol
		let activeCodeContainsInstance = false;
		if (cleanInstance && cleanInstance.length > 0) {
			for (let i = searchStart; i <= searchEnd; i++) {
				if (parsedLines[i].hasActiveCode) {
					if (parsedLines[i].text.includes(cleanInstance)) {
						activeCodeContainsInstance = true;
						break;
					}
				}
			}
		}

		for (let i = searchStart; i <= searchEnd; i++) {
			const lineInfo = parsedLines[i];
			if (lineInfo.isCommentOnly && !lineInfo.isDocstring) {
				if (isCommentedCode(lineInfo.commentText, cleanInstance)) {
					// If active code still uses the symbol in the same scope, it was remediated, not commented out
					if (activeCodeContainsInstance && targetHasActiveCode) {
						continue;
					}
					return true;
				}
			}
		}

		return false;
	}

	// If lineNumber is not provided, check the whole file for commented-out code matching instanceName
	if (cleanInstance && cleanInstance.length > 0) {
		for (const lineInfo of parsedLines) {
			if (lineInfo.isCommentOnly && !lineInfo.isDocstring) {
				if (isCommentedCode(lineInfo.commentText, cleanInstance)) {
					return true;
				}
			}
		}
	}

	return false;
}
