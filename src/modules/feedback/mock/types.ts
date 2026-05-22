export interface FeedbackFinding {
	type: string;
	cwe: string;
	owasp: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	path: string;
	line: number;
	vulnerability: string;
	impact: string;
	suggestion: string;
}
