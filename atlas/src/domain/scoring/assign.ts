import {
  cellToLatLng,
  getHexagonEdgeLengthAvg,
  greatCircleDistance,
  gridDisk,
  latLngToCell,
  polygonToCells,
  UNITS,
} from "h3-js";
import type { ScoringConfig } from "../config.js";
import type { ObservationGeometry } from "../types.js";

export interface CellShare {
  cell: string;
  /** Distance-decay factor k in 0..1. */
  k: number;
}

/** k for a sample at `distanceM` from a cell centre. Zero at or beyond the radius. */
export function decayFactor(distanceM: number, config: ScoringConfig): number {
  const r = config.decayRadiusM;
  if (r <= 0) return distanceM === 0 ? 1 : 0;
  if (distanceM >= r) return 0;
  if (config.decayKernel === "linear") return 1 - distanceM / r;
  const sigma = r / 2;
  return Math.exp(-(distanceM * distanceM) / (2 * sigma * sigma));
}

/** Rings of neighbours needed to reach `decayRadiusM`, capped to keep this cheap. */
export function ringsToCover(config: ScoringConfig): number {
  const edgeM = getHexagonEdgeLengthAvg(config.h3Resolution, UNITS.m);
  if (!Number.isFinite(edgeM) || edgeM <= 0) return 0;
  return Math.min(8, Math.ceil(config.decayRadiusM / edgeM));
}

/**
 * Cells a point influences: its own cell at k=1, plus every neighbour whose
 * centre falls inside the decay radius.
 */
export function cellsForPoint(lng: number, lat: number, config: ScoringConfig): CellShare[] {
  const origin = latLngToCell(lat, lng, config.h3Resolution);
  const shares: CellShare[] = [{ cell: origin, k: 1 }];

  const rings = ringsToCover(config);
  if (rings === 0) return shares;

  for (const cell of gridDisk(origin, rings)) {
    if (cell === origin) continue;
    const [cellLat, cellLng] = cellToLatLng(cell);
    const k = decayFactor(greatCircleDistance([lat, lng], [cellLat, cellLng], UNITS.m), config);
    if (k > 0) shares.push({ cell, k });
  }
  return shares;
}

/** Samples along a line at `lineSampleSpacingM`, so a cell's share tracks length. */
export function sampleLine(coordinates: number[][], config: ScoringConfig): [number, number][] {
  const samples: [number, number][] = [];
  if (coordinates.length === 0) return samples;

  const first = coordinates[0]!;
  samples.push([first[0]!, first[1]!]);

  for (let i = 1; i < coordinates.length; i += 1) {
    const a = coordinates[i - 1]!;
    const b = coordinates[i]!;
    const segmentM = greatCircleDistance([a[1]!, a[0]!], [b[1]!, b[0]!], UNITS.m);
    const steps = Math.max(1, Math.round(segmentM / config.lineSampleSpacingM));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      samples.push([a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t]);
    }
  }
  return samples;
}

/**
 * Distributes any geometry across cells. Points use the decay kernel; lines are
 * densified so a cell's share tracks intersected length.
 *
 * APPROXIMATION: polygons use h3 polygonToCells (cells whose centre is inside
 * the ring) and fall back to the centroid for polygons smaller than one cell,
 * rather than computing exact intersection areas with turf. Accurate to roughly
 * one cell at the boundary; revisit if polygon observations become common.
 */
export function cellsForGeometry(geometry: ObservationGeometry, config: ScoringConfig): CellShare[] {
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates as [number, number];
    return cellsForPoint(lng, lat, config);
  }

  if (geometry.type === "LineString") {
    return accumulate(sampleLine(geometry.coordinates as number[][], config), config);
  }

  const ring = (geometry.coordinates as number[][][])[0] ?? [];
  let cells: string[] = [];
  try {
    cells = polygonToCells([ring], config.h3Resolution, true);
  } catch {
    cells = [];
  }
  if (cells.length > 0) return cells.map((cell) => ({ cell, k: 1 }));

  const centroid = ringCentroid(ring);
  return centroid ? cellsForPoint(centroid[0], centroid[1], config) : [];
}

function accumulate(samples: [number, number][], config: ScoringConfig): CellShare[] {
  const totals = new Map<string, number>();
  for (const [lng, lat] of samples) {
    for (const share of cellsForPoint(lng, lat, config)) {
      totals.set(share.cell, (totals.get(share.cell) ?? 0) + share.k);
    }
  }
  const max = Math.max(...totals.values(), 0);
  if (max === 0) return [];
  return [...totals].map(([cell, total]) => ({ cell, k: total / max }));
}

function ringCentroid(ring: number[][]): [number, number] | null {
  if (ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const point of ring) {
    lng += point[0]!;
    lat += point[1]!;
  }
  return [lng / ring.length, lat / ring.length];
}
