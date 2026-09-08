import { DEFAULT_CONFIG } from "../domain/config.js";
import type { Observation } from "../domain/types.js";

export const CLASS_COLOURS: Record<string, string> = {
  excluant: "#9e2f2f",
  faible: "#d9822b",
  acceptable: "#d7b84f",
  capacitant: "#3c8b5a",
  inconnu: "#6b7280",
};

/**
 * Weakest-link over the rated dimensions, matching the app's default global
 * mode. Unrated observations are "inconnu", never zero.
 */
export function observationScore(observation: Observation): number | null {
  const scores = observation.ratings.map((r) => r.score).filter((s): s is number => s !== null && s !== undefined);
  return scores.length ? Math.min(...scores) : null;
}

export function observationClass(observation: Observation): keyof typeof CLASS_COLOURS {
  const score = observationScore(observation);
  if (score === null) return "inconnu";
  const ratio = score / DEFAULT_CONFIG.scaleMax;
  if (ratio < 1 / 3) return "excluant";
  if (ratio < 2 / 3) return "faible";
  if (ratio < 0.867) return "acceptable";
  return "capacitant";
}
