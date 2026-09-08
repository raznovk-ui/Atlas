import type { Dimension } from "./dimensions.js";
import { DIMENSION_KEYS } from "./dimensions.js";

export type GlobalMode = "weakest_link" | "weighted_average";
export type DecayKernel = "gaussian" | "linear";

/**
 * Every constant in the scoring engine lives here. Nothing downstream hardcodes
 * a threshold, a weight or a scale bound.
 */
export interface ScoringConfig {
  /** Top of the rating scale. MJSL uses 0..3; the spec's 0..5 is one edit away. */
  scaleMax: number;
  /** Allowed increment when validating ratings (0.5 permits half-steps). */
  scaleStep: number;

  h3Resolution: number;
  /** Influence radius of a point observation, in metres. */
  decayRadiusM: number;
  decayKernel: DecayKernel;
  /** Spacing used to densify lines into samples before cell assignment. */
  lineSampleSpacingM: number;

  /** Reliability multiplier per evidence source. OSM is an indice, not a proof. */
  sourceReliability: Record<SourceKind, number>;
  /** Age at which an observation's recency weight halves. */
  recencyHalfLifeDays: number;
  /** Recency weight never falls below this, so old evidence still counts. */
  recencyFloor: number;

  /** Worst penalty a non-blocking rupture can apply, at maximum severity. */
  frictionPenaltyMax: number;

  globalMode: GlobalMode;
  dimensionWeights: Record<Dimension, number>;

  /** Observation count at which the count component of confidence reaches ~63%. */
  confidenceCountScale: number;
  /** Cells below this confidence render as "insufficient data", not as a score. */
  minConfidence: number;

  /** Cells at or below this global score are candidate red zones. */
  redZoneThreshold: number;
  /** A blocking rupture at or above this severity marks a red zone on its own. */
  redZoneBlockingSeverity: number;
}

export type SourceKind = "osm" | "imported_geojson" | "photo" | "manual_note";

export const DEFAULT_CONFIG: ScoringConfig = {
  scaleMax: 3,
  scaleStep: 0.5,

  // res 10 is ~65 m across, matching the 25-50 m segments the MJSL protocol asks
  // for. The spec's default of res 9 (~170 m) would swallow whole sequences of
  // the Corniche into a single cell.
  h3Resolution: 10,
  decayRadiusM: 100,
  decayKernel: "gaussian",
  lineSampleSpacingM: 10,

  sourceReliability: {
    photo: 1.0,
    manual_note: 0.9,
    imported_geojson: 0.7,
    // "OSM fournit des indices, pas une preuve definitive." - doc/README_WEBAPP.md
    osm: 0.4,
  },
  recencyHalfLifeDays: 365,
  recencyFloor: 0.3,

  frictionPenaltyMax: 1.0,

  globalMode: "weakest_link",
  dimensionWeights: Object.fromEntries(DIMENSION_KEYS.map((k) => [k, 1])) as Record<Dimension, number>,

  confidenceCountScale: 3,
  minConfidence: 0.25,

  redZoneThreshold: 2.0,
  redZoneBlockingSeverity: 2,
};

export function withConfig(overrides: Partial<ScoringConfig> = {}): ScoringConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
