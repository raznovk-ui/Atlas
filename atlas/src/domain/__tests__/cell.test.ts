import { describe, expect, it } from "vitest";
import { withConfig } from "../config.js";
import { indexByCell, scoreAllCells, scoreCell } from "../scoring/cell.js";
import { latLngToCell } from "h3-js";
import { NOW, ORIGIN, obs, rupture } from "./helpers.js";

const config = withConfig();
const originCell = () => latLngToCell(ORIGIN[1], ORIGIN[0], config.h3Resolution);

function score(observations = [] as any[], ruptures = [] as any[], overrides = {}) {
  const cfg = withConfig(overrides);
  const index = indexByCell(observations, ruptures, cfg, NOW);
  return scoreCell(latLngToCell(ORIGIN[1], ORIGIN[0], cfg.h3Resolution), index, cfg);
}

describe("absence of data is never a bad score", () => {
  it("leaves an unrated dimension null rather than zero", () => {
    const result = score([obs({ physical: 3 })]);
    expect(result.dimensions.physical.score).toBe(3);
    expect(result.dimensions.sensory.score).toBeNull();
    expect(result.dimensions.economic.score).toBeNull();
  });

  it("ignores a rating explicitly left null", () => {
    const result = score([obs({ physical: 3, sensory: null })]);
    expect(result.dimensions.sensory.score).toBeNull();
    expect(result.dimensions.sensory.contributions).toHaveLength(0);
  });

  it("gives no global score at all when nothing is rated", () => {
    const result = score([obs({})]);
    expect(result.global).toBeNull();
    expect(result.sufficient).toBe(false);
  });

  it("computes the global score only over dimensions that have data", () => {
    const result = score([obs({ physical: 0, sensory: 3 })], [], { globalMode: "weighted_average" });
    // Mean of 0 and 3, not of 0,3,null,null,null,null.
    expect(result.global).toBeCloseTo(1.5, 6);
  });
});

describe("weighted mean", () => {
  it("weights a photo above an OSM indice when they disagree", () => {
    const result = score([
      obs({ physical: 3 }, { source: "photo" }),
      obs({ physical: 0 }, { source: "osm" }),
    ]);
    expect(result.dimensions.physical.score!).toBeGreaterThan(1.5);
  });

  it("records the spread so disagreement is visible, not smoothed", () => {
    const entry = score([obs({ physical: 3 }), obs({ physical: 0 })]).dimensions.physical;
    expect(entry.min).toBe(0);
    expect(entry.max).toBe(3);
  });

  it("attributes contributions that sum to one", () => {
    const entry = score([obs({ physical: 3 }), obs({ physical: 1 })]).dimensions.physical;
    const total = entry.contributions.reduce((sum, c) => sum + c.share, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("influences neighbouring cells with a decayed weight", () => {
    const results = scoreAllCells([obs({ physical: 0 })], [], config, NOW);
    const own = results.find((r) => r.cell === originCell())!;
    const neighbours = results.filter((r) => r.cell !== originCell());

    expect(own.dimensions.physical.contributions[0]!.k).toBe(1);
    expect(neighbours.length).toBeGreaterThan(0);
    for (const neighbour of neighbours) {
      const k = neighbour.dimensions.physical.contributions[0]!.k;
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThan(1);
    }
  });
});

describe("ruptures dominate", () => {
  it("caps an otherwise good score with a hard block", () => {
    const result = score([obs({ physical: 3 })], [rupture(["physical"], 3, true)]);
    expect(result.dimensions.physical.raw).toBe(3);
    expect(result.dimensions.physical.score).toBe(0);
  });

  it("applies a subtractive penalty for non-blocking friction", () => {
    const result = score([obs({ physical: 3 })], [rupture(["physical"], 3, false)]);
    expect(result.dimensions.physical.score).toBeCloseTo(3 - config.frictionPenaltyMax, 6);
  });

  it("scores a cell that has a rupture but no observations", () => {
    const result = score([], [rupture(["physical"], 3, true)]);
    expect(result.dimensions.physical.raw).toBeNull();
    expect(result.dimensions.physical.score).toBe(0);
  });

  it("only touches the dimensions the rupture is tagged with", () => {
    const result = score([obs({ physical: 3, economic: 3 })], [rupture(["physical"], 3, true)]);
    expect(result.dimensions.physical.score).toBe(0);
    expect(result.dimensions.economic.score).toBe(3);
  });

  it("takes the lowest ceiling when several blocks overlap", () => {
    const result = score([obs({ physical: 3 })], [
      rupture(["physical"], 1, true),
      rupture(["physical"], 3, true),
    ]);
    expect(result.dimensions.physical.score).toBe(0);
  });
});

describe("global modes", () => {
  const observations = [obs({ physical: 0, sensory: 3, cognitive: 3, economic: 3, socio_cultural: 3, political: 3 })];

  it("weakest-link reports the worst dimension", () => {
    const result = score(observations, [], { globalMode: "weakest_link" });
    expect(result.global).toBe(0);
    expect(result.limitingDimension).toBe("physical");
  });

  it("weighted average dilutes the same failure", () => {
    const result = score(observations, [], { globalMode: "weighted_average" });
    expect(result.global).toBeCloseTo(15 / 6, 6);
  });

  it("honours per-dimension weights in average mode", () => {
    const result = score(observations, [], {
      globalMode: "weighted_average",
      dimensionWeights: { physical: 5, sensory: 1, cognitive: 1, economic: 1, socio_cultural: 1, political: 1 },
    });
    expect(result.global!).toBeLessThan(15 / 6);
  });
});

describe("scoreAllCells", () => {
  it("returns one entry per touched cell and no others", () => {
    const results = scoreAllCells([obs({ physical: 2 })], [], config, NOW);
    expect(results.some((r) => r.cell === originCell())).toBe(true);
    expect(results.every((r) => r.global !== undefined)).toBe(true);
  });
});
