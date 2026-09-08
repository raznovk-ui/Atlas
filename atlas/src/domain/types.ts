import type { Feature, Geometry, LineString, Point, Polygon } from "geojson";
import type { Dimension } from "./dimensions.js";
import type { ScoringConfig, SourceKind } from "./config.js";

export type ObservationGeometry = Point | LineString | Polygon;

/**
 * A rating is a stated judgment, never a measurement. `score` is null when the
 * dimension was looked at and left unrated; an absent entry means it was never
 * considered. Neither is ever read as zero.
 */
export interface Rating {
  dimension: Dimension;
  score: number | null;
  comment?: string;
  /** Rater's own confidence, 0..1. Multiplies the derived source weight. */
  confidence?: number;
}

export interface MediaItem {
  id: string;
  filename: string;
  /** EXIF GPS, when present. */
  coordinates?: [number, number];
  /** EXIF compass bearing in degrees. */
  bearing?: number;
  takenAt?: string;
  /** Set once EXIF has been stripped for export. */
  exifStripped?: boolean;
}

export interface Observation {
  id: string;
  geometry: ObservationGeometry;
  source: SourceKind;
  title: string;
  description?: string;
  ratings: Rating[];
  media?: MediaItem[];
  tags?: string[];
  author?: string;
  createdAt: string;
  observedAt?: string;
  layerId?: string;
}

/**
 * A discontinuity that breaks a path or excludes a group.
 *
 * NOTE ON SEVERITY DIRECTION: severity runs 0..scaleMax with HIGHER meaning
 * WORSE, matching the `gravite` field already used in mjsl_points_rupture.
 * The build spec wrote severity as if it were score-like (low = worse); we take
 * the existing data's convention instead and convert to a score ceiling
 * internally. See ruptures.ts.
 */
export interface RupturePoint {
  id: string;
  geometry: ObservationGeometry;
  dimensions: Dimension[];
  severity: number;
  /** true = hard barrier (imposes a ceiling), false = friction (subtractive). */
  blocking: boolean;
  comment?: string;
  linkedObservationIds?: string[];
  suggestedFix?: string;
  author?: string;
  createdAt: string;
  observedAt?: string;
  layerId?: string;
}

export interface Layer {
  id: string;
  name: string;
  colour?: string;
  opacity?: number;
  visible: boolean;
  createdAt: string;
}

export interface StudyArea {
  id: string;
  name: string;
  boundary: Feature<Polygon>;
  config: ScoringConfig;
}

export interface Project {
  studyArea: StudyArea;
  layers: Layer[];
  observations: Observation[];
  ruptures: RupturePoint[];
}

export function isObservationGeometry(g: Geometry): g is ObservationGeometry {
  return g.type === "Point" || g.type === "LineString" || g.type === "Polygon";
}
