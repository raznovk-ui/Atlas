import { describe, expect, it } from "vitest";
import { withConfig } from "../config.js";
import { cellsForGeometry, cellsForPoint, decayFactor, sampleLine } from "../scoring/assign.js";
import { ORIGIN, eastOf } from "./helpers.js";

const config = withConfig();

describe("decayFactor", () => {
  it("is 1 at the sample point and 0 at or beyond the radius", () => {
    expect(decayFactor(0, config)).toBe(1);
    expect(decayFactor(config.decayRadiusM, config)).toBe(0);
    expect(decayFactor(config.decayRadiusM + 1, config)).toBe(0);
  });

  it("decreases monotonically for both kernels", () => {
    for (const decayKernel of ["gaussian", "linear"] as const) {
      const cfg = withConfig({ decayKernel });
      const samples = [10, 30, 50, 70, 90].map((d) => decayFactor(d, cfg));
      for (let i = 1; i < samples.length; i += 1) {
        expect(samples[i]!).toBeLessThan(samples[i - 1]!);
      }
    }
  });
});

describe("cellsForPoint", () => {
  it("always includes its own cell at full weight", () => {
    const shares = cellsForPoint(ORIGIN[0], ORIGIN[1], config);
    expect(shares[0]!.k).toBe(1);
    expect(new Set(shares.map((s) => s.cell)).size).toBe(shares.length);
  });

  it("reaches fewer cells with a smaller radius", () => {
    const wide = cellsForPoint(ORIGIN[0], ORIGIN[1], withConfig({ decayRadiusM: 200 }));
    const narrow = cellsForPoint(ORIGIN[0], ORIGIN[1], withConfig({ decayRadiusM: 20 }));
    expect(wide.length).toBeGreaterThan(narrow.length);
  });
});

describe("sampleLine", () => {
  it("densifies to roughly the configured spacing", () => {
    const samples = sampleLine([ORIGIN, eastOf(ORIGIN, 100)], config);
    // 100 m at 10 m spacing -> 10 steps plus the start point.
    expect(samples.length).toBe(11);
  });

  it("handles a degenerate single-vertex line without throwing", () => {
    expect(sampleLine([ORIGIN], config)).toHaveLength(1);
    expect(sampleLine([], config)).toHaveLength(0);
  });
});

describe("cellsForGeometry", () => {
  it("spreads a line across more cells than a point", () => {
    const point = cellsForGeometry({ type: "Point", coordinates: ORIGIN }, config);
    const line = cellsForGeometry(
      { type: "LineString", coordinates: [ORIGIN, eastOf(ORIGIN, 600)] },
      config,
    );
    expect(line.length).toBeGreaterThan(point.length);
    expect(Math.max(...line.map((s) => s.k))).toBeCloseTo(1, 6);
  });

  it("falls back to the centroid for a polygon smaller than one cell", () => {
    const tiny = eastOf(ORIGIN, 5);
    const shares = cellsForGeometry(
      {
        type: "Polygon",
        coordinates: [[ORIGIN, tiny, [tiny[0], tiny[1] + 0.00002], ORIGIN]],
      },
      config,
    );
    expect(shares.length).toBeGreaterThan(0);
  });

  it("covers a large polygon with many cells", () => {
    const far = eastOf(ORIGIN, 800);
    const shares = cellsForGeometry(
      {
        type: "Polygon",
        coordinates: [[ORIGIN, far, [far[0], far[1] + 0.007], [ORIGIN[0], ORIGIN[1] + 0.007], ORIGIN]],
      },
      config,
    );
    expect(shares.length).toBeGreaterThan(5);
    expect(shares.every((s) => s.k === 1)).toBe(true);
  });
});
