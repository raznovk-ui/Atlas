import { describe, expect, it } from "vitest";
import { withConfig } from "../config.js";
import { scoreAllCells } from "../scoring/cell.js";
import { clusterCells, detectRedZones, selectRedCells } from "../scoring/redzones.js";
import { gridDisk, latLngToCell } from "h3-js";
import { NOW, ORIGIN, eastOf, obs, rupture } from "./helpers.js";

const config = withConfig();

describe("clusterCells", () => {
  it("groups adjacent cells and separates distant ones", () => {
    const origin = latLngToCell(ORIGIN[1], ORIGIN[0], config.h3Resolution);
    const neighbours = gridDisk(origin, 1);
    const distant = latLngToCell(43.35, 5.42, config.h3Resolution);

    const clusters = clusterCells([...neighbours, distant]);
    expect(clusters).toHaveLength(2);
    expect(clusters.find((c) => c.includes(distant))).toHaveLength(1);
  });

  it("returns nothing for no input", () => {
    expect(clusterCells([])).toHaveLength(0);
  });
});

describe("selectRedCells", () => {
  it("excludes cells whose evidence is too thin, even when the score is bad", () => {
    const cells = scoreAllCells(
      [obs({ physical: 0 }, { source: "osm", observedAt: "2015-01-01T00:00:00Z" })],
      [],
      config,
      NOW,
    );
    expect(cells.some((c) => c.global === 0)).toBe(true);
    expect(selectRedCells(cells, config)).toHaveLength(0);
  });

  it("selects a well-evidenced bad cell", () => {
    const observations = [
      obs({ physical: 0 }, { source: "photo" }),
      obs({ physical: 0 }, { source: "manual_note" }),
      obs({ physical: 1 }, { source: "imported_geojson" }),
    ];
    const cells = scoreAllCells(observations, [], config, NOW);
    expect(selectRedCells(cells, config).length).toBeGreaterThan(0);
  });
});

describe("detectRedZones", () => {
  const observations = [
    obs({ physical: 0, economic: 1 }, { source: "photo" }),
    obs({ physical: 0, economic: 1 }, { source: "manual_note" }),
    obs({ physical: 1, economic: 1 }, { source: "imported_geojson" }),
  ];
  const ruptures = [rupture(["physical"], 3, true)];

  it("produces a ranked zone with geometry and a summary", () => {
    const cells = scoreAllCells(observations, ruptures, config, NOW);
    const zones = detectRedZones(cells, ruptures, config);

    expect(zones.length).toBeGreaterThan(0);
    const zone = zones[0]!;
    expect(zone.geometry.geometry.type).toBe("MultiPolygon");
    expect(zone.geometry.geometry.coordinates.length).toBeGreaterThan(0);
    expect(zone.dominantDimensions).toContain("physical");
    expect(zone.blockingRuptureIds).toHaveLength(1);
    expect(zone.summary).toMatch(/Physique/);
    expect(zone.summary).toMatch(/rupture\(s\) bloquante\(s\)/);
  });

  it("ranks zones worst-first", () => {
    const far = eastOf(ORIGIN, 5000);
    const mild = [
      obs({ physical: 2 }, { at: far, source: "photo" }),
      obs({ physical: 2 }, { at: far, source: "manual_note" }),
      obs({ physical: 2 }, { at: far, source: "imported_geojson" }),
    ];
    const cells = scoreAllCells([...observations, ...mild], ruptures, config, NOW);
    const zones = detectRedZones(cells, ruptures, config);
    for (let i = 1; i < zones.length; i += 1) {
      expect(zones[i - 1]!.severityIndex).toBeGreaterThanOrEqual(zones[i]!.severityIndex);
    }
  });

  it("finds nothing when everything scores well", () => {
    const good = [
      obs({ physical: 3, economic: 3 }, { source: "photo" }),
      obs({ physical: 3, economic: 3 }, { source: "manual_note" }),
    ];
    const cells = scoreAllCells(good, [], config, NOW);
    expect(detectRedZones(cells, [], config)).toHaveLength(0);
  });
});
