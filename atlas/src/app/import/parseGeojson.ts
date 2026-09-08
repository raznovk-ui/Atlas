import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Observation, ObservationGeometry, Rating } from "../../domain/types.js";
import { isObservationGeometry } from "../../domain/types.js";

export interface RejectedFeature {
  index: number;
  reason: string;
}

export interface ParsedImport {
  features: { feature: Feature; geometry: ObservationGeometry; properties: Record<string, unknown> }[];
  rejected: RejectedFeature[];
  /** Every property key seen, for the mapping wizard's dropdowns. */
  propertyKeys: string[];
}

/** Accepts a FeatureCollection, a bare Feature, or a bare geometry. */
function toFeatures(input: unknown): Feature[] | null {
  if (!input || typeof input !== "object") return null;
  const value = input as { type?: string; features?: unknown; geometry?: unknown };

  if (value.type === "FeatureCollection" && Array.isArray(value.features)) return value.features as Feature[];
  if (value.type === "Feature") return [input as Feature];
  if (typeof value.type === "string" && "coordinates" in value) {
    return [{ type: "Feature", properties: {}, geometry: input as Geometry }];
  }
  return null;
}

/**
 * Coordinates must already be EPSG:4326: the GeoJSON spec mandates it, and a
 * file in another CRS is rejected rather than silently misplaced on the map.
 */
function looksLikeLngLat(geometry: Geometry): boolean {
  const coordinates = flatten(geometry);
  if (coordinates.length === 0) return false;
  return coordinates.every(([lng, lat]) => Math.abs(lng) <= 180 && Math.abs(lat) <= 90);
}

function flatten(geometry: Geometry): [number, number][] {
  const out: [number, number][] = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      out.push([value[0], value[1]]);
      return;
    }
    for (const entry of value) walk(entry);
  };
  if ("coordinates" in geometry) walk((geometry as { coordinates: unknown }).coordinates);
  return out;
}

export function parseGeojson(text: string): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`Fichier illisible : ${error instanceof Error ? error.message : "JSON invalide"}`);
  }

  const features = toFeatures(raw);
  if (!features) throw new Error("Ce fichier n'est pas du GeoJSON (ni FeatureCollection, ni Feature, ni geometrie).");

  const parsed: ParsedImport = { features: [], rejected: [], propertyKeys: [] };
  const keys = new Set<string>();

  features.forEach((feature, index) => {
    if (!feature || feature.type !== "Feature" || !feature.geometry) {
      parsed.rejected.push({ index, reason: "objet sans geometrie" });
      return;
    }
    if (!isObservationGeometry(feature.geometry)) {
      parsed.rejected.push({ index, reason: `geometrie non supportee : ${feature.geometry.type}` });
      return;
    }
    if (!looksLikeLngLat(feature.geometry)) {
      parsed.rejected.push({
        index,
        reason: "coordonnees hors EPSG:4326 - reprojeter le fichier avant import",
      });
      return;
    }

    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(properties)) keys.add(key);
    parsed.features.push({ feature, geometry: feature.geometry, properties });
  });

  parsed.propertyKeys = [...keys].sort();
  return parsed;
}

export interface FieldMapping {
  title?: string;
  description?: string;
  tags?: string;
}

function readString(properties: Record<string, unknown>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const value = properties[key];
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

/** Turns parsed features into observations using the wizard's choices. */
export function toObservations(
  parsed: ParsedImport,
  options: {
    mapping: FieldMapping;
    ratings: Rating[];
    layerId: string;
    fileName: string;
    observedAt?: string;
    now?: () => string;
    id?: (index: number) => string;
  },
): Observation[] {
  const createdAt = (options.now ?? (() => new Date().toISOString()))();

  return parsed.features.map((entry, index) => {
    const tagValue = readString(entry.properties, options.mapping.tags);
    return {
      id: options.id ? options.id(index) : `imp_${createdAt}_${index}`,
      geometry: entry.geometry,
      source: "imported_geojson",
      title: readString(entry.properties, options.mapping.title) ?? `${options.fileName} #${index + 1}`,
      description: readString(entry.properties, options.mapping.description),
      // Ratings are copied per feature so later per-feature edits do not alias.
      ratings: options.ratings.map((rating) => ({ ...rating })),
      tags: tagValue ? tagValue.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [],
      createdAt,
      // Left undefined unless the user states it: an import date is not an
      // observation date, and pretending otherwise inflates recency.
      observedAt: options.observedAt,
      layerId: options.layerId,
    };
  });
}
