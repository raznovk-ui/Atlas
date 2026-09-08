import { DEFAULT_CONFIG, type ScoringConfig } from "../domain/config.js";
import { dimension as dimensionMeta } from "../domain/dimensions.js";
import { frictionPenalty, severityCeiling } from "../domain/scoring/ruptures.js";
import type { RupturePoint } from "../domain/types.js";

/**
 * Plain-language statement of what a rupture does to a score, so the effect is
 * legible in the form rather than only inside the engine.
 */
export function describeRupture(rupture: RupturePoint, config: ScoringConfig = DEFAULT_CONFIG): string {
  const names = rupture.dimensions.map((d) => dimensionMeta(d).label).join(", ") || "aucune dimension";

  if (rupture.blocking) {
    const ceiling = severityCeiling(rupture.severity, config);
    return ceiling === 0
      ? `Blocage dur : plafonne ${names} a 0 / ${config.scaleMax}, quelle que soit la moyenne.`
      : `Blocage dur : plafonne ${names} a ${ceiling} / ${config.scaleMax}.`;
  }

  const penalty = frictionPenalty(rupture.severity, config);
  return penalty === 0
    ? `Friction sans effet chiffre sur ${names}.`
    : `Friction : retire ${penalty.toFixed(2)} point(s) a ${names}.`;
}

export const RUPTURE_COLOURS = { blocking: "#450a0a", friction: "#b45309" };
