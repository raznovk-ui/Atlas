import type { ScoringConfig } from "../config.js";
import type { Observation } from "../types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Exponential decay to `recencyHalfLifeDays`, floored so old evidence still counts. */
export function recencyWeight(observedAt: string | undefined, config: ScoringConfig, now = Date.now()): number {
  if (!observedAt) return config.recencyFloor;
  const timestamp = Date.parse(observedAt);
  if (Number.isNaN(timestamp)) return config.recencyFloor;

  const ageDays = Math.max(0, (now - timestamp) / MS_PER_DAY);
  const decayed = Math.pow(0.5, ageDays / config.recencyHalfLifeDays);
  return Math.max(config.recencyFloor, Math.min(1, decayed));
}

export function sourceWeight(observation: Observation, config: ScoringConfig): number {
  return config.sourceReliability[observation.source] ?? 0.5;
}

/**
 * w = source reliability x recency x rater confidence.
 * Returned alongside its parts so the UI can explain any aggregate.
 *
 * Recency reads `observedAt` ONLY. `createdAt` is when the record was typed in,
 * which says nothing about when the place was looked at -- falling back to it
 * would let an undated import date itself to the moment of import and score as
 * fresh evidence.
 */
export function observationWeight(
  observation: Observation,
  config: ScoringConfig,
  raterConfidence = 1,
  now = Date.now(),
) {
  const source = sourceWeight(observation, config);
  const recency = recencyWeight(observation.observedAt, config, now);
  const rater = clamp01(raterConfidence);
  return { source, recency, rater, weight: source * recency * rater };
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
