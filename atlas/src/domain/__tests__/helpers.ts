import type { Observation, RupturePoint } from "../types.js";
import type { SourceKind } from "../config.js";
import type { Dimension } from "../dimensions.js";

export const ORIGIN: [number, number] = [5.3609, 43.2707]; // Corniche Kennedy
export const NOW = Date.parse("2026-09-08T00:00:00Z");

let counter = 0;
const nextId = () => `id_${(counter += 1)}`;

export function obs(
  ratings: Partial<Record<Dimension, number | null>>,
  options: {
    at?: [number, number];
    source?: SourceKind;
    observedAt?: string;
    raterConfidence?: number;
  } = {},
): Observation {
  return {
    id: nextId(),
    geometry: { type: "Point", coordinates: options.at ?? ORIGIN },
    source: options.source ?? "manual_note",
    title: "obs",
    ratings: Object.entries(ratings).map(([dimension, score]) => ({
      dimension: dimension as Dimension,
      score: score ?? null,
      confidence: options.raterConfidence,
    })),
    createdAt: "2026-09-01T00:00:00Z",
    observedAt: options.observedAt ?? "2026-09-01T00:00:00Z",
  };
}

export function rupture(
  dimensions: Dimension[],
  severity: number,
  blocking: boolean,
  at: [number, number] = ORIGIN,
): RupturePoint {
  return {
    id: nextId(),
    geometry: { type: "Point", coordinates: at },
    dimensions,
    severity,
    blocking,
    comment: blocking ? "blocage dur" : "friction",
    createdAt: "2026-09-01T00:00:00Z",
    observedAt: "2026-09-01T00:00:00Z",
  };
}

/** Offsets a lon/lat pair by roughly `metres` eastward. */
export function eastOf(point: [number, number], metres: number): [number, number] {
  const degPerMetre = 1 / (111_320 * Math.cos((point[1] * Math.PI) / 180));
  return [point[0] + metres * degPerMetre, point[1]];
}
