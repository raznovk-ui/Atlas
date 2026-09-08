import { describe, expect, it } from "vitest";
import { withConfig } from "../config.js";
import { recencyWeight, observationWeight } from "../scoring/weights.js";
import { obs, NOW } from "./helpers.js";

const config = withConfig();

describe("recencyWeight", () => {
  it("is 1 for an observation made today", () => {
    expect(recencyWeight("2026-09-08T00:00:00Z", config, NOW)).toBeCloseTo(1, 5);
  });

  it("halves at the configured half-life", () => {
    const oneYearAgo = "2025-09-08T00:00:00Z";
    expect(recencyWeight(oneYearAgo, config, NOW)).toBeCloseTo(0.5, 2);
  });

  it("never falls below the floor, so old evidence still counts", () => {
    expect(recencyWeight("1990-01-01T00:00:00Z", config, NOW)).toBe(config.recencyFloor);
  });

  it("treats a missing or unparseable date as the floor, not as fresh", () => {
    expect(recencyWeight(undefined, config, NOW)).toBe(config.recencyFloor);
    expect(recencyWeight("", config, NOW)).toBe(config.recencyFloor);
    expect(recencyWeight("pas une date", config, NOW)).toBe(config.recencyFloor);
  });
});

describe("observationWeight", () => {
  it("ranks a field photo above an OSM indice", () => {
    const photo = observationWeight(obs({ physical: 2 }, { source: "photo" }), config, 1, NOW);
    const osm = observationWeight(obs({ physical: 2 }, { source: "osm" }), config, 1, NOW);
    expect(photo.weight).toBeGreaterThan(osm.weight);
  });

  it("exposes its parts so an aggregate can be explained", () => {
    const result = observationWeight(obs({ physical: 2 }, { source: "photo" }), config, 0.5, NOW);
    expect(result.weight).toBeCloseTo(result.source * result.recency * result.rater, 10);
    expect(result.rater).toBe(0.5);
  });
});
