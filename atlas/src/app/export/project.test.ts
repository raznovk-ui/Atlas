import { describe, expect, it } from "vitest";
import { withConfig } from "../../domain/config.js";
import type { Observation, RupturePoint } from "../../domain/types.js";
import { buildProject, observationsCsv, parseProject, toGeojson } from "./project.js";

const config = withConfig();
const NEWLINE = String.fromCharCode(10);

const observation: Observation = {
  id: "o1",
  geometry: { type: "Point", coordinates: [5.3528, 43.2864] },
  source: "photo",
  title: 'Escalier "raide", Vallon',
  description: `Ligne 1${NEWLINE}Ligne 2`,
  ratings: [
    { dimension: "physical", score: 0 },
    { dimension: "economic", score: null },
  ],
  tags: ["Vallon", "test"],
  createdAt: "2026-09-09T00:00:00Z",
  observedAt: "2026-06-14T09:30:00Z",
};

const rupture: RupturePoint = {
  id: "r1",
  geometry: { type: "Point", coordinates: [5.3528, 43.2864] },
  dimensions: ["physical", "cognitive"],
  severity: 3,
  blocking: true,
  comment: "Escaliers concentres",
  suggestedFix: "Rampe alternative",
  createdAt: "2026-09-09T00:00:00Z",
};

describe("project round trip", () => {
  it("survives export and re-import unchanged", () => {
    const project = buildProject({
      config,
      observations: [observation],
      ruptures: [rupture],
      photoIds: ["photo_1"],
      now: "2026-09-09T12:00:00Z",
    });
    const { project: back, warnings } = parseProject(JSON.stringify(project));

    expect(warnings).toHaveLength(0);
    expect(back.observations).toEqual([observation]);
    expect(back.ruptures).toEqual([rupture]);
    expect(back.photoIds).toEqual(["photo_1"]);
    expect(back.exportedAt).toBe("2026-09-09T12:00:00Z");
  });

  it("preserves a null rating as null rather than dropping or zeroing it", () => {
    const project = buildProject({ config, observations: [observation], ruptures: [], photoIds: [] });
    const back = parseProject(JSON.stringify(project)).project;
    expect(back.observations[0]!.ratings.find((r) => r.dimension === "economic")!.score).toBeNull();
  });

  it("refuses a file that is not a project", () => {
    expect(() => parseProject(JSON.stringify({ type: "FeatureCollection" }))).toThrow(/pas un projet/);
    expect(() => parseProject("{broken")).toThrow(/illisible/);
  });

  it("warns rather than throws on a newer file version", () => {
    const project = { ...buildProject({ config, observations: [], ruptures: [], photoIds: [] }), version: 99 };
    const { warnings } = parseProject(JSON.stringify(project));
    expect(warnings.join(" ")).toMatch(/version 99/);
  });
});

describe("toGeojson", () => {
  it("emits one flat collection with a kind discriminator", () => {
    const collection = toGeojson([observation], [rupture]);
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0]!.properties!.kind).toBe("observation");
    expect(collection.features[1]!.properties!.kind).toBe("rupture");
  });

  it("writes an unrated dimension as null, never as 0", () => {
    const properties = toGeojson([observation], []).features[0]!.properties!;
    expect(properties.physical).toBe(0);
    expect(properties.economic).toBeNull();
    expect(properties.sensory).toBeNull();
  });
});

describe("observationsCsv", () => {
  // Never split the CSV on a newline: a quoted field may legally contain one,
  // and this fixture does, so naive line-splitting cuts the row in half.
  const headerOf = (csv: string) => csv.slice(0, csv.indexOf(NEWLINE));
  const bodyOf = (csv: string) => csv.slice(csv.indexOf(NEWLINE) + 1);

  it("has one header naming all six dimensions", () => {
    const header = headerOf(observationsCsv([observation]));
    for (const key of ["physical", "sensory", "cognitive", "economic", "socio_cultural", "political"]) {
      expect(header).toContain(key);
    }
  });

  it("quotes fields containing commas, quotes or newlines", () => {
    const csv = observationsCsv([observation]);
    expect(csv).toContain('"Escalier ""raide"", Vallon"');
    expect(csv).toContain(`"Ligne 1${NEWLINE}Ligne 2"`);
  });

  it("leaves an unrated dimension empty rather than writing 0", () => {
    const row = bodyOf(observationsCsv([{ ...observation, description: "" }]));
    const cells = row.split(",");
    // physical = 0 is written; economic and the four never-touched ones stay empty.
    expect(cells.slice(-6)).toEqual(["0", "", "", "", "", ""]);
  });

  it("records the geometry type alongside the first vertex", () => {
    const row = bodyOf(observationsCsv([{ ...observation, description: "" }]));
    expect(row).toContain("Point");
    expect(row).toContain("5.3528");
    expect(row).toContain("43.2864");
  });
});
