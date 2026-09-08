import type { ScoringConfig } from "../config.js";
import { clamp01 } from "./weights.js";

export interface ConfidenceInput {
  /** Effective sample count (sum of k), not a raw row count. */
  effectiveCount: number;
  distinctSources: number;
  /** Mean recency weight of the contributing observations, 0..1. */
  meanRecency: number;
}

export interface ConfidenceBreakdown {
  count: number;
  diversity: number;
  recency: number;
  value: number;
  sufficient: boolean;
}

/**
 * Confidence is deliberately separate from score: a lone unreliable 4 and a
 * well-evidenced 4 must never render alike.
 */
export function confidence(input: ConfidenceInput, config: ScoringConfig): ConfidenceBreakdown {
  const count = 1 - Math.exp(-Math.max(0, input.effectiveCount) / Math.max(1e-9, config.confidenceCountScale));
  // One source is not disqualifying, but corroboration across sources helps.
  const diversity = 0.6 + 0.4 * clamp01((Math.max(0, input.distinctSources) - 1) / 2);
  const recency = clamp01(input.meanRecency);

  const value = clamp01(count * diversity * recency);
  return { count, diversity, recency, value, sufficient: value >= config.minConfidence };
}
