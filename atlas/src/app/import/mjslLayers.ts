import type { FeatureCollection } from "geojson";

/**
 * The seven existing QGIS layers, pulled straight from ../site/data at build
 * time. Deliberately not duplicated into this package: two copies of the same
 * GeoJSON drift apart, which is the problem the old site/data.js created.
 *
 * Imported as raw text and parsed here because Vite only treats `.json` as a
 * JSON module; a `.geojson` import is served as JavaScript and dies on the
 * first colon.
 */
const modules = import.meta.glob("../../../../site/data/*.geojson", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const MJSL_LAYERS: Record<string, FeatureCollection> = Object.fromEntries(
  Object.entries(modules).map(([path, text]) => [
    path.split("/").pop()!.replace(".geojson", ""),
    JSON.parse(text) as FeatureCollection,
  ]),
);

export const MJSL_LAYER_NAMES = Object.keys(MJSL_LAYERS).sort();
