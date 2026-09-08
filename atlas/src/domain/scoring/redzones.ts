import { cellsToMultiPolygon, cellToLatLng, gridDisk } from "h3-js";
import type { Feature, MultiPolygon } from "geojson";
import type { ScoringConfig } from "../config.js";
import type { Dimension } from "../dimensions.js";
import { dimension as dimensionMeta } from "../dimensions.js";
import type { CellScore } from "./cell.js";
import type { RupturePoint } from "../types.js";

export interface RedZone {
  id: string;
  cells: string[];
  geometry: Feature<MultiPolygon>;
  /** Composite rank: mean deficit x area x ruptures. Higher is worse. */
  severityIndex: number;
  meanDeficit: number;
  areaCells: number;
  ruptureIds: string[];
  blockingRuptureIds: string[];
  dominantDimensions: Dimension[];
  topContributions: { observationId: string; title: string; score: number }[];
  meanConfidence: number;
  summary: string;
}

/** Cells that qualify: low global score, or a hard block, and enough evidence. */
export function selectRedCells(cells: CellScore[], config: ScoringConfig): CellScore[] {
  return cells.filter((cell) => {
    if (!cell.sufficient) return false;
    if (cell.global !== null && cell.global <= config.redZoneThreshold) return true;
    return Object.values(cell.dimensions).some(
      (d) =>
        d.ruptures.blockingIds.length > 0 &&
        d.score !== null &&
        d.score <= config.scaleMax - config.redZoneBlockingSeverity,
    );
  });
}

/** Groups selected cells into contiguous clusters using h3 adjacency. */
export function clusterCells(cells: string[]): string[][] {
  const remaining = new Set(cells);
  const clusters: string[][] = [];

  while (remaining.size > 0) {
    const seed = remaining.values().next().value as string;
    remaining.delete(seed);
    const cluster = [seed];
    const queue = [seed];

    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const neighbour of gridDisk(current, 1)) {
        if (remaining.has(neighbour)) {
          remaining.delete(neighbour);
          cluster.push(neighbour);
          queue.push(neighbour);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function detectRedZones(
  cells: CellScore[],
  ruptures: RupturePoint[],
  config: ScoringConfig,
): RedZone[] {
  const red = selectRedCells(cells, config);
  const byCell = new Map(red.map((c) => [c.cell, c]));
  const ruptureById = new Map(ruptures.map((r) => [r.id, r]));

  const zones = clusterCells(red.map((c) => c.cell)).map((cluster, index) => {
    const scores = cluster.map((c) => byCell.get(c)!);

    const deficits = scores.filter((s) => s.global !== null).map((s) => config.scaleMax - s.global!);
    const meanDeficit = deficits.length ? deficits.reduce((a, b) => a + b, 0) / deficits.length : 0;

    const ruptureIds = new Set<string>();
    const blockingIds = new Set<string>();
    const dimensionDeficits = new Map<Dimension, number[]>();
    const contributions = new Map<string, { observationId: string; title: string; score: number }>();

    for (const score of scores) {
      for (const entry of Object.values(score.dimensions)) {
        entry.ruptures.blockingIds.forEach((id) => {
          ruptureIds.add(id);
          blockingIds.add(id);
        });
        entry.ruptures.frictionIds.forEach((id) => ruptureIds.add(id));
        if (entry.score !== null) {
          const list = dimensionDeficits.get(entry.dimension) ?? [];
          list.push(config.scaleMax - entry.score);
          dimensionDeficits.set(entry.dimension, list);
        }
        for (const c of entry.contributions.slice(0, 3)) {
          contributions.set(c.observationId, { observationId: c.observationId, title: c.title, score: c.score });
        }
      }
    }

    const dominantDimensions = [...dimensionDeficits]
      .map(([dim, list]) => ({ dim, mean: list.reduce((a, b) => a + b, 0) / list.length }))
      .filter((entry) => entry.mean > 0)
      .sort((a, b) => b.mean - a.mean)
      .slice(0, 3)
      .map((entry) => entry.dim);

    const meanConfidence = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;

    // Area and rupture count use log/sqrt damping so one enormous thin zone does
    // not automatically outrank a small, severe, well-evidenced one.
    const severityIndex =
      meanDeficit * Math.sqrt(cluster.length) * (1 + 0.5 * blockingIds.size + 0.2 * (ruptureIds.size - blockingIds.size));

    const zone: RedZone = {
      id: `zone_${index + 1}`,
      cells: cluster,
      geometry: cellsToFeature(cluster),
      severityIndex,
      meanDeficit,
      areaCells: cluster.length,
      ruptureIds: [...ruptureIds],
      blockingRuptureIds: [...blockingIds],
      dominantDimensions,
      topContributions: [...contributions.values()].sort((a, b) => a.score - b.score).slice(0, 5),
      meanConfidence,
      summary: "",
    };
    zone.summary = summarise(zone, ruptureById, config);
    return zone;
  });

  return zones.sort((a, b) => b.severityIndex - a.severityIndex);
}

function summarise(
  zone: RedZone,
  ruptureById: Map<string, RupturePoint>,
  config: ScoringConfig,
): string {
  const parts: string[] = [];
  const dims = zone.dominantDimensions.map((d) => dimensionMeta(d).label);
  parts.push(
    dims.length
      ? `Deficit dominant sur : ${dims.join(", ")}.`
      : "Deficit reparti sans dimension dominante.",
  );
  parts.push(`${zone.areaCells} cellule(s), deficit moyen ${zone.meanDeficit.toFixed(2)} / ${config.scaleMax}.`);

  if (zone.blockingRuptureIds.length > 0) {
    const labels = zone.blockingRuptureIds
      .map((id) => ruptureById.get(id)?.comment ?? id)
      .slice(0, 3);
    parts.push(`${zone.blockingRuptureIds.length} rupture(s) bloquante(s) : ${labels.join(" ; ")}.`);
  }
  if (zone.meanConfidence < 0.5) {
    parts.push(`Confiance faible (${zone.meanConfidence.toFixed(2)}) : a confirmer sur le terrain.`);
  }
  return parts.join(" ");
}

function cellsToFeature(cells: string[]): Feature<MultiPolygon> {
  let coordinates: number[][][][] = [];
  try {
    // h3 returns [lng, lat] rings when asked for GeoJSON order.
    coordinates = cellsToMultiPolygon(cells, true) as unknown as number[][][][];
  } catch {
    coordinates = [];
  }
  if (coordinates.length === 0 && cells.length > 0) {
    const [lat, lng] = cellToLatLng(cells[0]!);
    coordinates = [[[[lng, lat], [lng, lat], [lng, lat], [lng, lat]]]];
  }
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates } };
}
