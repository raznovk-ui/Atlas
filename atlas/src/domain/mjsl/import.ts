import type { Feature, FeatureCollection } from "geojson";
import type { Dimension } from "../dimensions.js";
import { MJSL_PROPERTY_TO_DIMENSION } from "../dimensions.js";
import type { ScoringConfig } from "../config.js";
import type { Observation, ObservationGeometry, Rating, RupturePoint } from "../types.js";
import { isObservationGeometry } from "../types.js";

/**
 * Per-layer mapping from the existing QGIS score columns onto dimensions.
 *
 * INTERPRETATION: the legacy layers declare loose dimension sets (e.g.
 * mjsl_amenites_repos is tagged D1/D4/D5) without saying which column feeds
 * which. This table is an explicit reading of that, and is the one thing in the
 * adapter that needs confirming against the memoire.
 */
export const LAYER_FIELD_DIMENSIONS: Record<string, Record<string, Dimension>> = {
  mjsl_amenites_repos: {
    score_confort: "physical",
    score_accessibilite: "physical",
    score_gratuite: "economic",
  },
  mjsl_ambiances: {
    score_sensoriel: "sensory",
    score_cognitif: "cognitive",
  },
  mjsl_seuils_legitimite: {
    score_social: "socio_cultural",
    score_economique: "economic",
  },
  mjsl_transport_metropolitain: {
    score_continuite: "physical",
    score_cout: "economic",
    score_lisibilite: "cognitive",
  },
  mjsl_participation: {
    score_accessibilite: "political",
    score_lisibilite: "political",
    score_reversibilite: "political",
  },
};

const MJSL_DIMENSION_CODES: Record<string, Dimension> = {
  D1: "physical",
  D2: "sensory",
  D3: "cognitive",
  D4: "economic",
  D5: "socio_cultural",
  D6: "political",
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Primary key per layer. `seg_id` is deliberately NOT in this table for anything
 * but the segment layer: on every other layer it is a FOREIGN key pointing at
 * the parent segment, so treating it as an id collapses distinct features onto
 * the same identity.
 */
const LAYER_ID_FIELD: Record<string, string> = {
  mjsl_segments_cheminement: "seg_id",
  mjsl_points_rupture: "pt_id",
  mjsl_amenites_repos: "amenite_id",
  mjsl_ambiances: "amb_id",
  mjsl_seuils_legitimite: "seuil_id",
  mjsl_transport_metropolitain: "tr_id",
  mjsl_participation: "part_id",
};

function featureId(properties: Record<string, unknown>, layer: string, index: number): string {
  const key = LAYER_ID_FIELD[layer];
  const value = key ? properties[key] : undefined;
  if (typeof value === "string" && value) return value;
  return `${layer}_${index}`;
}

/** The parent segment a feature refers to, kept as a link rather than an id. */
function parentSegment(properties: Record<string, unknown>, layer: string): string | undefined {
  if (layer === "mjsl_segments_cheminement") return undefined;
  const value = properties.seg_id;
  return typeof value === "string" && value ? value : undefined;
}

function title(properties: Record<string, unknown>, fallback: string): string {
  for (const key of ["nom_lieu", "type_rupture", "type_amenite", "type_ambiance", "type_seuil", "type_dispositif", "secteur"]) {
    const value = properties[key];
    if (typeof value === "string" && value) return value;
  }
  return fallback;
}

export interface ImportResult {
  observations: Observation[];
  ruptures: RupturePoint[];
  rejected: { layer: string; index: number; reason: string }[];
}

/**
 * Converts one legacy MJSL FeatureCollection. `mjsl_points_rupture` becomes
 * RupturePoints; everything else becomes Observations.
 */
export function importMjslLayer(
  layer: string,
  collection: FeatureCollection,
  config: ScoringConfig,
  createdAt = new Date().toISOString(),
): ImportResult {
  const observations: Observation[] = [];
  const ruptures: RupturePoint[] = [];
  const rejected: ImportResult["rejected"] = [];

  collection.features.forEach((feature: Feature, index) => {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    if (!feature.geometry || !isObservationGeometry(feature.geometry)) {
      rejected.push({ layer, index, reason: "unsupported or missing geometry" });
      return;
    }
    const geometry = feature.geometry as ObservationGeometry;
    const id = featureId(properties, layer, index);
    const observedAt = typeof properties.date_obs === "string" && properties.date_obs ? properties.date_obs : undefined;
    const parent = parentSegment(properties, layer);

    if (layer === "mjsl_points_rupture") {
      const severity = toNumber(properties.gravite);
      if (severity === null) {
        rejected.push({ layer, index, reason: "rupture without gravite" });
        return;
      }
      const code = typeof properties.dimension_principale === "string" ? properties.dimension_principale : "";
      const mapped = MJSL_DIMENSION_CODES[code];
      ruptures.push({
        id,
        geometry,
        dimensions: mapped ? [mapped] : ["physical"],
        severity,
        // A rupture at the top of the gravite scale is treated as a hard block.
        blocking: severity >= config.scaleMax,
        comment: title(properties, "Rupture"),
        linkedObservationIds: parent ? [parent] : undefined,
        suggestedFix: typeof properties.note_obs === "string" ? properties.note_obs : undefined,
        createdAt,
        observedAt,
        layerId: layer,
      });
      return;
    }

    const ratings: Rating[] = [];

    for (const [property, dimension] of Object.entries(MJSL_PROPERTY_TO_DIMENSION)) {
      const score = toNumber(properties[property]);
      if (score !== null) ratings.push({ dimension, score });
    }

    for (const [property, dimension] of Object.entries(LAYER_FIELD_DIMENSIONS[layer] ?? {})) {
      const score = toNumber(properties[property]);
      if (score !== null) ratings.push({ dimension, score, comment: property });
    }

    if (ratings.length === 0) {
      rejected.push({ layer, index, reason: "no readable dimension scores" });
      return;
    }

    observations.push({
      id,
      geometry,
      source: "imported_geojson",
      title: title(properties, layer),
      description: typeof properties.note_obs === "string" ? properties.note_obs : undefined,
      ratings,
      tags: [
        ...(typeof properties.secteur === "string" && properties.secteur ? [properties.secteur] : []),
        ...(parent ? [`seg:${parent}`] : []),
      ],
      createdAt,
      observedAt,
      layerId: layer,
    });
  });

  return { observations, ruptures, rejected };
}

export function importMjslProject(
  layers: Record<string, FeatureCollection>,
  config: ScoringConfig,
  createdAt?: string,
): ImportResult {
  const merged: ImportResult = { observations: [], ruptures: [], rejected: [] };
  for (const [layer, collection] of Object.entries(layers)) {
    const result = importMjslLayer(layer, collection, config, createdAt);
    merged.observations.push(...result.observations);
    merged.ruptures.push(...result.ruptures);
    merged.rejected.push(...result.rejected);
  }
  return merged;
}
