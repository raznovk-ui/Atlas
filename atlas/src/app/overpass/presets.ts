import { OVERPASS_BBOX } from "../studyArea.js";
import type { Dimension } from "../../domain/dimensions.js";

export interface OverpassPreset {
  id: string;
  label: string;
  description: string;
  /** Dimensions these features are indices for. */
  dimensions: Dimension[];
  query: string;
}

/**
 * Step 2 ships one preset, per the delivery plan. The shape is what matters:
 * further presets from the spec's list drop straight in here.
 */
export const OVERPASS_PRESETS: OverpassPreset[] = [
  {
    id: "ruptures_physiques",
    label: "Ruptures physiques (OSM)",
    description:
      "Escaliers, ascenseurs, bordures et bandes podotactiles. Indices de continuite a verifier sur le terrain, pas des preuves.",
    dimensions: ["physical", "sensory"],
    query: `[out:json][timeout:30];
(
  node["highway"="steps"](${OVERPASS_BBOX});
  way["highway"="steps"](${OVERPASS_BBOX});
  node["highway"="elevator"](${OVERPASS_BBOX});
  node["kerb"](${OVERPASS_BBOX});
  node["tactile_paving"](${OVERPASS_BBOX});
  way["tactile_paving"](${OVERPASS_BBOX});
);
out body geom;`,
  },
];
