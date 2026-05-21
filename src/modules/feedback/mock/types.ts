/**
 * Re-export FeedbackFinding from the canonical types module.
 * The interface now lives in feedback/types.ts since it's the real
 * output format, not a mock-only type.
 */
export type { FeedbackFinding } from '../types.js';
