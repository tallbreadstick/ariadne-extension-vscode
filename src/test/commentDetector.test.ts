import assert from 'assert';
import { isCodeCommentedOut, parseFileLines, isCommentedCode } from '../modules/tracker/analysis/commentDetector.js';

describe('Comment Detector (isCodeCommentedOut)', () => {
	describe('Docstrings and Prose Exclusions (False Positive Prevention)', () => {
		it('does NOT flag as commented out when Javadoc above method mentions the symbol (e.g. Sensitive Data in toString)', () => {
			const javaFile = [
				'public class Student {',
				'    private String name;',
				'    private String email;',
				'    private String password;',
				'',
				'    /**',
				'     * Includes password — sensitive data leak when printed or logged.',
				'     */',
				'    @Override',
				'    public String toString() {',
				'        return getRole() + "{name=\'" + name + "\', email=\'" + email + "\'}";',
				'    }',
				'}',
			].join('\n');

			// Finding was at line 11 (the return statement), instanceName was "password"
			const result = isCodeCommentedOut(javaFile, 11, 'password', 11);
			assert.strictEqual(result, false, 'Remediated toString() with Javadoc mentioning password must NOT be flagged as commented out');
		});

		it('does NOT flag as commented out when Javadoc contains @param or @return tags with symbol', () => {
			const javaFile = [
				'/**',
				' * Sets the user password.',
				' * @param password The plaintext password to hash',
				' * @return boolean indicating success',
				' */',
				'public boolean setPassword(String password) {',
				'    this.passwordHash = hash(password);',
				'    return true;',
				'}',
			].join('\n');

			const result = isCodeCommentedOut(javaFile, 7, 'password', 7);
			assert.strictEqual(result, false, 'Javadoc @param tags must not be treated as commented-out code');
		});

		it('does NOT flag as commented out when line has active code with a trailing prose comment', () => {
			const javaFile = [
				'public void process(Object record) {',
				'    Student student = (Student) record;  // VULN: Incorrect Type Conversion or Cast',
				'    System.out.println("Processing: " + student.getName());',
				'}',
			].join('\n');

			// Even if instanceName is "record", line 2 has active code
			const result = isCodeCommentedOut(javaFile, 2, 'record', 2);
			assert.strictEqual(result, false, 'Active code with trailing prose comment must not be flagged as commented out');
		});

		it('does NOT flag as commented out when explanatory TODO/NOTE comment mentions the symbol', () => {
			const javaFile = [
				'// TODO: password length must be verified',
				'// Note: password is encrypted using bcrypt',
				'public void savePassword(String password) {',
				'    save(hash(password));',
				'}',
			].join('\n');

			const result = isCodeCommentedOut(javaFile, 4, 'password', 4);
			assert.strictEqual(result, false, 'TODO or Note comments must not be flagged as commented-out code');
		});

		it('does NOT flag as commented out when old line is commented above but new active code remediates it', () => {
			const tsFile = [
				'function run() {',
				'  // const res = executeQuery(userInput);',
				'  const res = safeExecute(userInput);',
				'  return res;',
				'}',
			].join('\n');

			// Finding on safe line
			const result = isCodeCommentedOut(tsFile, 3, 'safeExecute', 3);
			assert.strictEqual(result, false);
		});

		it('does NOT flag as commented out when Python docstring mentions the symbol', () => {
			const pyFile = [
				'def process_login(password):',
				'    """',
				'    Verify user password credentials securely.',
				'    """',
				'    return verify_hash(password)',
			].join('\n');

			const result = isCodeCommentedOut(pyFile, 5, 'password', 5);
			assert.strictEqual(result, false, 'Python docstrings must not be flagged as commented-out code');
		});
	});

	describe('Genuinely Commented-Out Code Detection', () => {
		it('detects single-line commented-out code (// const res = executeQuery(...))', () => {
			const tsFile = [
				'import db from "db";',
				'function run() {',
				'  // const res = executeQuery(userInput);',
				'  return null;',
				'}',
			].join('\n');

			const result = isCodeCommentedOut(tsFile, 3, 'executeQuery', 3);
			assert.strictEqual(result, true, 'Commented-out executeQuery must be detected as commented out');
		});

		it('detects single-line commented-out code with line shift', () => {
			const tsFile = [
				'import db from "db";',
				'function run() {',
				'',
				'  // const res = executeQuery(userInput);',
				'  return null;',
				'}',
			].join('\n');

			// Original was at line 3, now at line 4 (shifted by 1)
			const result = isCodeCommentedOut(tsFile, 3, 'executeQuery', 3);
			assert.strictEqual(result, true, 'Shifted commented-out code must be detected');
		});

		it('detects block-commented code (/* const res = executeQuery(...) */)', () => {
			const tsFile = [
				'import db from "db";',
				'function run() {',
				'  /* const res = executeQuery(userInput); */',
				'  return null;',
				'}',
			].join('\n');

			const result = isCodeCommentedOut(tsFile, 3, 'executeQuery', 3);
			assert.strictEqual(result, true, 'Block-commented code must be detected');
		});

		it('detects multi-line block-commented code', () => {
			const javaFile = [
				'/* ',
				'@Override',
				'public String toString() {',
				'    return "password=" + password;',
				'}',
				'*/',
			].join('\n');

			const result = isCodeCommentedOut(javaFile, 4, 'password', 4);
			assert.strictEqual(result, true, 'Multi-line block commented code must be detected');
		});

		it('detects commented-out variable declaration (// private String dbPassword = "admin123";)', () => {
			const javaFile = [
				'public class Config {',
				'    // private String dbPassword = "admin123";',
				'}',
			].join('\n');

			const result = isCodeCommentedOut(javaFile, 2, 'dbPassword', 2);
			assert.strictEqual(result, true, 'Commented-out credential variable must be detected');
		});

		it('detects commented-out call without instanceName (// vulnSink();)', () => {
			const jsFile = [
				'function test() {',
				'    // vulnSink();',
				'}',
			].join('\n');

			const result = isCodeCommentedOut(jsFile, 2, undefined, 2);
			assert.strictEqual(result, true, 'Commented-out code statement on target line without instanceName must be detected');
		});
	});

	describe('Clean / Deleted Code', () => {
		it('returns false when code is genuinely deleted and replaced with clean code', () => {
			const cleanFile = [
				'import db from "db";',
				'function run() {',
				'  return safeExecute(userInput);',
				'}',
			].join('\n');

			const result = isCodeCommentedOut(cleanFile, 3, 'executeQuery', 3);
			assert.strictEqual(result, false, 'Clean deleted code must not be detected as commented out');
		});

		it('returns false for empty or non-string input', () => {
			assert.strictEqual(isCodeCommentedOut(''), false);
			assert.strictEqual(isCodeCommentedOut(null as unknown as string), false);
			assert.strictEqual(isCodeCommentedOut(undefined as unknown as string), false);
		});
	});
});

