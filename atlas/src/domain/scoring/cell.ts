import type { ScoringConfig } from "../config.js";
import type { Dimension } from "../dimensions.js";
import { DIMENSION_KEYS } from "../dimensions.js";
import type { Observation, RupturePoint } from "../types.js";
import { cellsForGeometry } from "./assign.js";
import { confidence, type ConfidenceBreakdown } from "./confidence.js";
import { applyRuptures, ruptureEffect, type RuptureEffect } from "./ruptures.js";
import { observationWeight, recencyWeight } from "./weights.js";

export interface Contribution {
  observationId: string;
  title: string;
  score: number;
  /** w = source x recency x rater confidence. */
  w: number;
  /** k = distance decay. */
  k: number;
  /** Share of the cell's weighted mean this observation accounts for, 0..1. */
  share: number;
}

export interface DimensionScore {
  dimension: Dimension;
  /** Weighted mean before ruptures, null when no rating exists. */
  raw: number | null;
  /** Final score after rupture ceiling and friction penalty. */
  score: number | null;
  confidence: ConfidenceBreakdown;
  ruptures: RuptureEffect;
  /** Spread of the underlying ratings; disagreement is shown, never smoothed. */
  min: number | null;
  max: number | null;
  contributions: Contribution[];
}

export interface CellScore {
  cell: string;
  dimensions: Record<Dimension, DimensionScore>;
  global: number | null;
  globalMode: ScoringConfig["globalMode"];
  /** Dimension that set the global score in weakest-link mode. */
  limitingDimension: Dimension | null;
  confidence: number;
  sufficient: boolean;
}

interface IndexedRupture {
  rupture: RupturePoint;
  recency: number;
}

interface Sample {
  observation: Observation;
  score: number;
  w: number;
  k: number;
  recency: number;
}

/** Indexes observations and ruptures onto cells once, for reuse across dimensions. */
export function indexByCell(
  observations: Observation[],
  ruptures: RupturePoint[],
  config: ScoringConfig,
  now = Date.now(),
) {
  const samples = new Map<string, Sample[]>();
  const cellRuptures = new Map<string, IndexedRupture[]>();

  for (const observation of observations) {
    const shares = cellsForGeometry(observation.geometry, config);
    if (shares.length === 0) continue;

    for (const rating of observation.ratings) {
      if (rating.score === null || rating.score === undefined) continue;
      const { weight, recency } = observationWeight(observation, config, rating.confidence ?? 1, now);
      for (const { cell, k } of shares) {
        const key = `${cell}|${rating.dimension}`;
        const list = samples.get(key) ?? [];
        list.push({ observation, score: rating.score, w: weight, k, recency });
        samples.set(key, list);
      }
    }
  }

  for (const rupture of ruptures) {
    // A rupture carries a date like any other evidence; an undated one is as
    // stale as an undated observation and must not inflate confidence.
    const recency = recencyWeight(rupture.observedAt, config, now);
    for (const { cell } of cellsForGeometry(rupture.geometry, config)) {
      const list = cellRuptures.get(cell) ?? [];
      list.push({ rupture, recency });
      cellRuptures.set(cell, list);
    }
  }

  return { samples, cellRuptures };
}

export function scoreCell(
  cell: string,
  index: ReturnType<typeof indexByCell>,
  config: ScoringConfig,
): CellScore {
  const dimensions = {} as Record<Dimension, DimensionScore>;
  const indexedRuptures = index.cellRuptures.get(cell) ?? [];
  const cellRuptures = indexedRuptures.map((entry) => entry.rupture);

  for (const dimension of DIMENSION_KEYS) {
    const samples = index.samples.get(`${cell}|${dimension}`) ?? [];
    const effect = ruptureEffect(cellRuptures, dimension, config);

    let raw: number | null = null;
    let contributions: Contribution[] = [];
    let min: number | null = null;
    let max: number | null = null;
    let effectiveCount = 0;
    let meanRecency = 0;

    const denominator = samples.reduce((sum, s) => sum + s.w * s.k, 0);
    if (samples.length > 0 && denominator > 0) {
      raw = samples.reduce((sum, s) => sum + s.score * s.w * s.k, 0) / denominator;
      min = Math.min(...samples.map((s) => s.score));
      max = Math.max(...samples.map((s) => s.score));
      effectiveCount = samples.reduce((sum, s) => sum + s.k, 0);
      meanRecency = samples.reduce((sum, s) => sum + s.recency, 0) / samples.length;
      contributions = samples
        .map((s) => ({
          observationId: s.observation.id,
          title: s.observation.title,
          score: s.score,
          w: s.w,
          k: s.k,
          share: (s.w * s.k) / denominator,
        }))
        .sort((a, b) => b.share - a.share);
    }

    // A rupture is evidence in its own right: it can score a cell that has no
    // observations at all, which is how a hard block shows up on an unsurveyed
    // stretch.
    let score: number | null = null;
    if (raw !== null) {
      score = applyRuptures(raw, effect, config);
    } else if (effect.ceiling !== null) {
      score = effect.ceiling;
    }

    const affectingRuptures = indexedRuptures.filter((entry) => entry.rupture.dimensions.includes(dimension));
    const recencies = [...samples.map((s) => s.recency), ...affectingRuptures.map((entry) => entry.recency)];
    const distinctSources = new Set(samples.map((s) => s.observation.source)).size;
    const conf = confidence(
      {
        effectiveCount: effectiveCount + affectingRuptures.length,
        distinctSources: distinctSources + (effect.blockingIds.length > 0 ? 1 : 0),
        meanRecency: recencies.length > 0 ? recencies.reduce((a, b) => a + b, 0) / recencies.length : 0,
      },
      config,
    );

    dimensions[dimension] = { dimension, raw, score, confidence: conf, ruptures: effect, min, max, contributions };
  }

  const scored = DIMENSION_KEYS.map((d) => dimensions[d]).filter((d) => d.score !== null);

  let global: number | null = null;
  let limitingDimension: Dimension | null = null;

  if (scored.length > 0) {
    if (config.globalMode === "weakest_link") {
      let worst = scored[0]!;
      for (const entry of scored) if (entry.score! < worst.score!) worst = entry;
      global = worst.score;
      limitingDimension = worst.dimension;
    } else {
      const weightSum = scored.reduce((sum, d) => sum + (config.dimensionWeights[d.dimension] ?? 1), 0);
      global =
        weightSum > 0
          ? scored.reduce((sum, d) => sum + d.score! * (config.dimensionWeights[d.dimension] ?? 1), 0) / weightSum
          : null;
      let worst = scored[0]!;
      for (const entry of scored) if (entry.score! < worst.score!) worst = entry;
      limitingDimension = worst.dimension;
    }
  }

  const cellConfidence = scored.length
    ? scored.reduce((sum, d) => sum + d.confidence.value, 0) / scored.length
    : 0;

  return {
    cell,
    dimensions,
    global,
    globalMode: config.globalMode,
    limitingDimension,
    confidence: cellConfidence,
    sufficient: cellConfidence >= config.minConfidence,
  };
}

export function scoreAllCells(
  observations: Observation[],
  ruptures: RupturePoint[],
  config: ScoringConfig,
  now = Date.now(),
): CellScore[] {
  const index = indexByCell(observations, ruptures, config, now);
  const cells = new Set<string>();
  for (const key of index.samples.keys()) cells.add(key.slice(0, key.indexOf("|")));
  for (const cell of index.cellRuptures.keys()) cells.add(cell);
  return [...cells].map((cell) => scoreCell(cell, index, config));
}
