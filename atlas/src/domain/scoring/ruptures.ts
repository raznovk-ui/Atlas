import type { ScoringConfig } from "../config.js";
import type { Dimension } from "../dimensions.js";
import type { RupturePoint } from "../types.js";

/**
 * Severity runs 0..scaleMax with HIGHER meaning WORSE (the `gravite` convention
 * already in mjsl_points_rupture). A blocking rupture caps the dimension at the
 * score its severity leaves standing: severity == scaleMax means a hard zero.
 */
export function severityCeiling(severity: number, config: ScoringConfig): number {
  return clamp(config.scaleMax - severity, 0, config.scaleMax);
}

/** Non-blocking friction subtracts, scaled linearly to `frictionPenaltyMax`. */
export function frictionPenalty(severity: number, config: ScoringConfig): number {
  if (config.scaleMax <= 0) return 0;
  return (clamp(severity, 0, config.scaleMax) / config.scaleMax) * config.frictionPenaltyMax;
}

export interface RuptureEffect {
  ceiling: number | null;
  penalty: number;
  blockingIds: string[];
  frictionIds: string[];
}

/**
 * Combines every rupture touching a cell for one dimension.
 *
 * A single hard block dominates an otherwise good average -- that is the point,
 * and it is why the ceiling is applied after the weighted mean rather than as
 * one more sample in it.
 */
export function ruptureEffect(
  ruptures: RupturePoint[],
  dimension: Dimension,
  config: ScoringConfig,
): RuptureEffect {
  const relevant = ruptures.filter((r) => r.dimensions.includes(dimension));
  const blocking = relevant.filter((r) => r.blocking);
  const friction = relevant.filter((r) => !r.blocking);

  const ceiling = blocking.length
    ? Math.min(...blocking.map((r) => severityCeiling(r.severity, config)))
    : null;

  // Friction does not stack linearly; the worst one sets the penalty.
  const penalty = friction.length
    ? Math.max(...friction.map((r) => frictionPenalty(r.severity, config)))
    : 0;

  return {
    ceiling,
    penalty,
    blockingIds: blocking.map((r) => r.id),
    frictionIds: friction.map((r) => r.id),
  };
}

export function applyRuptures(score: number, effect: RuptureEffect, config: ScoringConfig): number {
  let result = score;
  if (effect.ceiling !== null) result = Math.min(result, effect.ceiling);
  result -= effect.penalty;
  return clamp(result, 0, config.scaleMax);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
