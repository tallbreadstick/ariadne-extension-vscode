/**
 * Comment detection utility for finding lifecycle records.
 *
 * Checks whether a previously detected vulnerability's code in a source file
 * has been commented out (using single-line `//` or block `/* ... * /` comments)
 * rather than genuinely remediated.
 *
 * When code is commented out, the SAST scanner skips it and reports absence.
 * This detector prevents such absences from falsely transitioning to 'resolved'.
 */

/**
 * Checks whether a finding's code location in a source file is commented out.
 *
 * @param fileContent - The full string content of the source file.
 * @param lineNumber - 1-based line number where the finding was last observed.
 * @param instanceName - Optional symbol/variable/method name of the finding.
 * @param endLine - Optional 1-based ending line number of the finding.
 * @returns `true` if the code at or around the finding is commented out.
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

	const lines = fileContent.split(/\r?\n/);
	const totalLines = lines.length;
	if (totalLines === 0) {
		return false;
	}

	// Determine line search window (±5 lines around target to handle minor line shifts)
	let startIdx = 0;
	let endIdx = totalLines - 1;

	if (typeof lineNumber === 'number' && lineNumber >= 1) {
		const targetIdx = lineNumber - 1;
		const lastIdx = (typeof endLine === 'number' && endLine >= lineNumber)
			? endLine - 1
			: targetIdx;
		startIdx = Math.max(0, targetIdx - 5);
		endIdx = Math.min(totalLines - 1, lastIdx + 5);
	}

	const cleanInstance = instanceName?.trim();

	// 1. Single-line comments (`//` or `#`)
	for (let i = startIdx; i <= endIdx; i++) {
		const trimmed = lines[i].trim();
		if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
			// If instanceName is known, verify the comment contains the symbol
			if (cleanInstance && cleanInstance.length > 0) {
				if (trimmed.includes(cleanInstance)) {
					return true;
				}
			}
			// If at the exact target line, any line comment indicates the line was commented out
			if (typeof lineNumber === 'number' && i === lineNumber - 1) {
				return true;
			}
		}
	}

	// 2. Block comments (`/* ... */`)
	// Track block-comment state throughout the file
	let inBlockComment = false;
	for (let i = 0; i < totalLines; i++) {
		const line = lines[i];
		let j = 0;
		const lineStartedInComment = inBlockComment;
		let lineHadBlockComment = false;

		while (j < line.length) {
			if (!inBlockComment) {
				if (line.slice(j, j + 2) === '//') {
					break; // Line comment ignores remainder of line
				}
				if (line.slice(j, j + 2) === '/*') {
					inBlockComment = true;
					lineHadBlockComment = true;
					j += 2;
					continue;
				}
			} else {
				if (line.slice(j, j + 2) === '*/') {
					inBlockComment = false;
					lineHadBlockComment = true;
					j += 2;
					continue;
				}
			}
			j++;
		}

		// Check if this line was within or contained a block comment and in our target window
		if ((lineStartedInComment || inBlockComment || lineHadBlockComment) && i >= startIdx && i <= endIdx) {
			if (cleanInstance && cleanInstance.length > 0) {
				if (line.includes(cleanInstance)) {
					return true;
				}
			}
			if (typeof lineNumber === 'number' && i === lineNumber - 1) {
				return true;
			}
		}
	}

	return false;
}
