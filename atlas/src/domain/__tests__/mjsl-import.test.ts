import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import { withConfig } from "../config.js";
import { importMjslProject } from "../mjsl/import.js";
import { scoreAllCells } from "../scoring/cell.js";
import { detectRedZones } from "../scoring/redzones.js";

const DATA_DIR = join(process.cwd(), "..", "site", "data");
const config = withConfig();

function loadLayers(): Record<string, FeatureCollection> {
  const layers: Record<string, FeatureCollection> = {};
  for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".geojson"))) {
    layers[file.replace(".geojson", "")] = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  }
  return layers;
}

describe("importing the existing MJSL layers", () => {
  const layers = loadLayers();
  const result = importMjslProject(layers, config);

  it("reads all seven layers", () => {
    expect(Object.keys(layers)).toHaveLength(7);
  });

  it("converts every feature without rejects", () => {
    expect(result.rejected).toHaveLength(0);
    expect(result.observations.length + result.ruptures.length).toBe(14);
  });

  it("turns mjsl_points_rupture into ruptures, not observations", () => {
    expect(result.ruptures.map((r) => r.id).sort()).toEqual(["RUP_CO_001", "RUP_VA_001"]);
    expect(result.observations.some((o) => o.layerId === "mjsl_points_rupture")).toBe(false);
  });

  it("treats the worst rupture as blocking and the lesser one as friction", () => {
    const stairs = result.ruptures.find((r) => r.id === "RUP_VA_001")!;
    const narrowing = result.ruptures.find((r) => r.id === "RUP_CO_001")!;
    expect(stairs.severity).toBe(3);
    expect(stairs.blocking).toBe(true);
    expect(narrowing.severity).toBe(2);
    expect(narrowing.blocking).toBe(false);
  });

  it("carries the six dimensions across from the segment layer", () => {
    const segment = result.observations.find((o) => o.id === "CO_001")!;
    expect(segment.ratings).toHaveLength(6);
    expect(segment.ratings.find((r) => r.dimension === "economic")!.score).toBe(2);
    expect(segment.ratings.find((r) => r.dimension === "political")!.score).toBe(0);
  });

  it("never invents a rating for a layer that has none", () => {
    for (const observation of result.observations) {
      expect(observation.ratings.every((r) => r.score !== null)).toBe(true);
      expect(observation.ratings.length).toBeGreaterThan(0);
    }
  });
});

describe("scoring the real corridor end to end", () => {
  const result = importMjslProject(loadLayers(), config);
  const cells = scoreAllCells(result.observations, result.ruptures, config);

  it("produces cells along the corridor", () => {
    expect(cells.length).toBeGreaterThan(20);
  });

  it("leaves unrated dimensions null instead of scoring them zero", () => {
    const anyNull = cells.some((c) => Object.values(c.dimensions).some((d) => d.score === null));
    expect(anyNull).toBe(true);
  });

  it("reports every cell as insufficiently evidenced, because date_obs is empty", () => {
    // The placeholder layers carry no observation dates, so recency sits at the
    // floor and confidence stays low. Surfacing that is the point.
    expect(cells.every((c) => c.sufficient === false)).toBe(true);
    expect(detectRedZones(cells, result.ruptures, config)).toHaveLength(0);
  });

  it("still shows the hard block once confidence is not required", () => {
    const permissive = withConfig({ minConfidence: 0 });
    const scored = scoreAllCells(result.observations, result.ruptures, permissive);
    const zones = detectRedZones(scored, result.ruptures, permissive);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones[0]!.summary.length).toBeGreaterThan(0);
  });

  it("weakest-link is never more generous than weighted average", () => {
    const min = scoreAllCells(result.observations, result.ruptures, withConfig({ globalMode: "weakest_link" }));
    const avg = scoreAllCells(result.observations, result.ruptures, withConfig({ globalMode: "weighted_average" }));
    const byCell = new Map(avg.map((c) => [c.cell, c]));
    for (const cell of min) {
      const other = byCell.get(cell.cell);
      if (cell.global === null || !other || other.global === null) continue;
      expect(cell.global).toBeLessThanOrEqual(other.global + 1e-9);
    }
  });
});
