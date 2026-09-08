import { cellToBoundary } from "h3-js";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { ScoringConfig } from "../../domain/config.js";
import type { Dimension } from "../../domain/dimensions.js";
import type { CellScore } from "../../domain/scoring/cell.js";
import type { RedZone } from "../../domain/scoring/redzones.js";
import { scoreColour } from "./palette.js";

/** "global" shows the aggregated score; a Dimension shows that dimension alone. */
export type ActiveLayer = "global" | Dimension;

export function scoreFor(cell: CellScore, active: ActiveLayer): number | null {
  return active === "global" ? cell.global : cell.dimensions[active].score;
}

export function confidenceFor(cell: CellScore, active: ActiveLayer): number {
  return active === "global" ? cell.confidence : cell.dimensions[active].confidence.value;
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * H3 cells as polygons ready for the choropleth.
 *
 * `sufficient` is carried as a property rather than filtered out here: a cell
 * with too little evidence must be drawn differently from a cell that scored
 * badly, never omitted as though it had been surveyed and found fine.
 */
export function cellsToGeojson(
  cells: CellScore[],
  active: ActiveLayer,
  config: ScoringConfig,
): FeatureCollection {
  if (cells.length === 0) return EMPTY;

  const features: Feature<Polygon>[] = [];
  for (const cell of cells) {
    const score = scoreFor(cell, active);
    const confidence = confidenceFor(cell, active);
    const sufficient = confidence >= config.minConfidence && score !== null;

    // A cell with neither a score nor evidence is not drawn at all; there is
    // nothing to say about it.
    if (score === null && confidence === 0) continue;

    features.push({
      type: "Feature",
      id: cell.cell,
      properties: {
        cell: cell.cell,
        score,
        confidence,
        sufficient,
        colour: sufficient ? scoreColour(score, config) : undefined,
        limiting: cell.limitingDimension ?? "",
      },
      geometry: { type: "Polygon", coordinates: [cellToBoundary(cell.cell, true)] },
    });
  }
  return { type: "FeatureCollection", features };
}

export function redZonesToGeojson(zones: RedZone[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => ({
      type: "Feature",
      id: zone.id,
      properties: {
        id: zone.id,
        rank: zone.severityIndex,
        cells: zone.areaCells,
        blocking: zone.blockingRuptureIds.length,
      },
      geometry: zone.geometry.geometry,
    })),
  };
}
