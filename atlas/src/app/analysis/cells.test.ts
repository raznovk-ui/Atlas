import { describe, expect, it } from "vitest";
import { withConfig } from "../../domain/config.js";
import { scoreAllCells } from "../../domain/scoring/cell.js";
import type { Observation } from "../../domain/types.js";
import { cellsToGeojson, confidenceFor, scoreFor } from "./cells.js";
import { INSUFFICIENT_FILL, rampColour, scoreColour, legendEntries } from "./palette.js";

const config = withConfig();
const NOW = Date.parse("2026-09-09T00:00:00Z");

let n = 0;
const obs = (ratings: Record<string, number>, source: Observation["source"] = "photo"): Observation => ({
  id: `o${(n += 1)}`,
  geometry: { type: "Point", coordinates: [5.3609, 43.2707] },
  source,
  title: "obs",
  ratings: Object.entries(ratings).map(([dimension, score]) => ({ dimension: dimension as never, score })),
  createdAt: "2026-09-01T00:00:00Z",
  observedAt: "2026-09-01T00:00:00Z",
});

describe("rampColour", () => {
  it("is monotonic in luminance, so the ramp survives greyscale print", () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const samples = [0, 0.25, 0.5, 0.75, 1].map((t) => luminance(rampColour(t)));
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]!).toBeGreaterThan(samples[i - 1]!);
    }
  });

  it("clamps out-of-range and non-finite input", () => {
    expect(rampColour(-1)).toBe(rampColour(0));
    expect(rampColour(2)).toBe(rampColour(1));
    expect(rampColour(NaN)).toBe(INSUFFICIENT_FILL);
  });

  it("maps a null score to the insufficient-data fill, not to the worst colour", () => {
    expect(scoreColour(null, config)).toBe(INSUFFICIENT_FILL);
    expect(scoreColour(0, config)).not.toBe(INSUFFICIENT_FILL);
  });

  it("labels the legend with the MJSL class vocabulary", () => {
    expect(legendEntries(config).map((e) => e.label)).toEqual([
      "0 – excluant",
      "1.0 – faible",
      "2.0 – acceptable",
      "3 – capacitant",
    ]);
  });
});

describe("cellsToGeojson", () => {
  const wellEvidenced = [
    obs({ physical: 0 }, "photo"),
    obs({ physical: 0 }, "manual_note"),
    obs({ physical: 1 }, "imported_geojson"),
  ];

  it("returns closed polygons carrying score and confidence", () => {
    const cells = scoreAllCells(wellEvidenced, [], config, NOW);
    const collection = cellsToGeojson(cells, "global", config);
    expect(collection.features.length).toBeGreaterThan(0);

    const geometry = collection.features[0]!.geometry as { type: string; coordinates: number[][][] };
    const ring = geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(collection.features[0]!.properties).toHaveProperty("confidence");
  });

  it("keeps thin-evidence cells but marks them insufficient rather than dropping them", () => {
    const thin = scoreAllCells([obs({ physical: 0 }, "osm")], [], config, NOW);
    const collection = cellsToGeojson(thin, "global", config);
    expect(collection.features.length).toBeGreaterThan(0);
    expect(collection.features.every((f) => f.properties!.sufficient === false)).toBe(true);
    // No colour is assigned, so a thin cell can never be mistaken for a scored one.
    expect(collection.features.every((f) => f.properties!.colour === undefined)).toBe(true);
  });

  it("shows nothing for a dimension that was never rated", () => {
    const cells = scoreAllCells(wellEvidenced, [], config, NOW);
    const collection = cellsToGeojson(cells, "political", config);
    expect(collection.features.every((f) => f.properties!.score === null)).toBe(true);
  });

  it("returns an empty collection for no cells", () => {
    expect(cellsToGeojson([], "global", config).features).toHaveLength(0);
  });
});

describe("scoreFor / confidenceFor", () => {
  it("reads the global score or one dimension", () => {
    const cells = scoreAllCells([obs({ physical: 1, economic: 3 })], [], withConfig({ globalMode: "weakest_link" }), NOW);
    const cell = cells.find((c) => c.global !== null)!;
    expect(scoreFor(cell, "global")).toBe(1);
    expect(scoreFor(cell, "economic")).toBe(3);
    expect(scoreFor(cell, "political")).toBeNull();
    expect(confidenceFor(cell, "political")).toBe(0);
  });
});
