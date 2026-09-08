import { describe, expect, it } from "vitest";
import { parseGeojson, toObservations } from "./parseGeojson.js";

const point = (lng: number, lat: number, properties: Record<string, unknown> = {}) => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates: [lng, lat] },
});

const collection = (features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });

describe("parseGeojson", () => {
  it("accepts a FeatureCollection, a bare Feature and a bare geometry", () => {
    expect(parseGeojson(collection([point(5.36, 43.28)])).features).toHaveLength(1);
    expect(parseGeojson(JSON.stringify(point(5.36, 43.28))).features).toHaveLength(1);
    expect(parseGeojson(JSON.stringify({ type: "Point", coordinates: [5.36, 43.28] })).features).toHaveLength(1);
  });

  it("throws a readable error on invalid JSON and on non-GeoJSON", () => {
    expect(() => parseGeojson("{oops")).toThrow(/illisible/);
    expect(() => parseGeojson(JSON.stringify({ hello: "world" }))).toThrow(/pas du GeoJSON/);
  });

  it("rejects unsupported geometries but keeps the good ones", () => {
    const result = parseGeojson(
      collection([
        point(5.36, 43.28),
        { type: "Feature", properties: {}, geometry: { type: "GeometryCollection", geometries: [] } },
      ]),
    );
    expect(result.features).toHaveLength(1);
    expect(result.rejected).toEqual([{ index: 1, reason: "geometrie non supportee : GeometryCollection" }]);
  });

  it("rejects projected coordinates instead of putting them in the wrong place", () => {
    // Lambert-93 metres, the usual QGIS default for France.
    const result = parseGeojson(collection([point(892000, 6247000)]));
    expect(result.features).toHaveLength(0);
    expect(result.rejected[0]!.reason).toMatch(/EPSG:4326/);
  });

  it("collects every property key for the mapping wizard", () => {
    const result = parseGeojson(
      collection([point(5.36, 43.28, { nom: "a", secteur: "x" }), point(5.37, 43.29, { note: "b" })]),
    );
    expect(result.propertyKeys).toEqual(["nom", "note", "secteur"]);
  });

  it("keeps features that have no properties at all", () => {
    const result = parseGeojson(collection([{ type: "Feature", geometry: { type: "Point", coordinates: [5.36, 43.28] } }]));
    expect(result.features).toHaveLength(1);
    expect(result.propertyKeys).toEqual([]);
  });
});

describe("toObservations", () => {
  const parsed = parseGeojson(
    collection([
      point(5.36, 43.28, { nom: "Escalier", note: "raide", secteur: "Vallon; Corniche" }),
      point(5.37, 43.29, {}),
    ]),
  );

  const build = (overrides = {}) =>
    toObservations(parsed, {
      mapping: { title: "nom", description: "note", tags: "secteur" },
      ratings: [{ dimension: "physical", score: 1 }],
      layerId: "layer_1",
      fileName: "test.geojson",
      now: () => "2026-09-09T00:00:00Z",
      id: (i) => `obs_${i}`,
      ...overrides,
    });

  it("maps chosen properties onto title, description and tags", () => {
    const [first] = build();
    expect(first!.title).toBe("Escalier");
    expect(first!.description).toBe("raide");
    expect(first!.tags).toEqual(["Vallon", "Corniche"]);
  });

  it("falls back to a numbered title when the mapped property is empty", () => {
    expect(build()[1]!.title).toBe("test.geojson #2");
  });

  it("leaves observedAt unset unless stated, so an import is not read as fresh", () => {
    expect(build()[0]!.observedAt).toBeUndefined();
    expect(build({ observedAt: "2026-06-01" })[0]!.observedAt).toBe("2026-06-01");
  });

  it("copies ratings per feature so later edits do not alias", () => {
    const observations = build();
    observations[0]!.ratings[0]!.score = 3;
    expect(observations[1]!.ratings[0]!.score).toBe(1);
  });
});
