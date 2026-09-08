import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { BASEMAPS } from "./basemaps.js";
import { STUDY_AREA } from "../studyArea.js";
import { OVERPASS_PRESETS } from "../overpass/presets.js";
import { useAppStore } from "../state.js";
import { CLASS_COLOURS, observationClass } from "../observationStyle.js";
import type { FeatureCollection } from "geojson";

const EMPTY = { type: "FeatureCollection" as const, features: [] };

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const basemap = useAppStore((s) => s.basemap);
  const presets = useAppStore((s) => s.presets);
  // Sources may only be added once the style is fully parsed. Adding them on a
  // "styledata" event that fires mid-parse leaves them registered but never
  // wired up, so nothing ever renders.
  const [styleReady, setStyleReady] = useState(false);
  const observations = useAppStore((s) => s.observations);
  const addPointMode = useAppStore((s) => s.addPointMode);
  const addPointAt = useAppStore((s) => s.addPointAt);

  useEffect(() => {
    if (!container.current || map.current) return;
    const style = BASEMAPS.find((b) => b.id === basemap)?.style ?? BASEMAPS[0]!.style;

    const instance = new maplibregl.Map({
      container: container.current,
      style,
      center: STUDY_AREA.centre,
      zoom: STUDY_AREA.zoom,
      attributionControl: {
        compact: false,
        // Stated explicitly rather than relying on tile metadata: every source
        // the app touches has to be credited, Overpass included.
        customAttribution: [
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          'Donnees interrogees via <a href="https://overpass-api.de/">Overpass API</a>',
        ],
      },
    });
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    instance.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.current = instance;
    // Dev-only handle, so the rendered state can be inspected from the console.
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__map = instance;

    instance.on("load", () => setStyleReady(true));
    instance.on("click", (event) => {
      // Read the flag at click time: registering this once avoids rebinding on
      // every state change, and the store is the source of truth anyway.
      if (!useAppStore.getState().addPointMode) return;
      void useAppStore.getState().addPointAt(event.lngLat.lng, event.lngLat.lat);
    });
    return () => {
      instance.remove();
      map.current = null;
    };
    // Basemap changes are handled by the effect below, not by rebuilding the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swapping the style drops custom sources, so they are re-added afterwards.
  // Tracked by value rather than a "first run" flag: StrictMode invokes effects
  // twice, and a one-shot flag let the second pass call setStyle mid-load, which
  // rebuilt the style from scratch and stranded every source empty.
  const appliedBasemap = useRef(basemap);
  useEffect(() => {
    const instance = map.current;
    if (!instance || appliedBasemap.current === basemap) return;

    const style = BASEMAPS.find((b) => b.id === basemap)?.style;
    if (!style) return;
    appliedBasemap.current = basemap;
    setStyleReady(false);
    instance.setStyle(style);
    instance.once("idle", () => setStyleReady(true));
  }, [basemap]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    instance.getCanvas().style.cursor = addPointMode ? "crosshair" : "";
  }, [addPointMode]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !styleReady) return;
    const source = instance.getSource(OBSERVATION_SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(observationsToGeojson(observations));
  }, [observations, styleReady]);

  // Re-runs whenever the data changes or the style becomes ready again, so the
  // two can arrive in either order.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !styleReady) return;
    syncPresetLayers(instance);
  }, [presets, styleReady]);

  return (
    <div
      ref={container}
      className="h-full w-full"
      // The map is decorative to a screen reader; the table view carries the data.
      role="application"
      aria-label="Carte du littoral marseillais. Les memes donnees sont disponibles en tableau."
    />
  );
}

function sourceId(presetId: string) {
  return `preset-${presetId}`;
}

function layerIds(presetId: string) {
  return [`preset-${presetId}-line`, `preset-${presetId}-point`];
}

/**
 * Idempotent: creates sources and layers if they are missing, and always pushes
 * the current data and visibility. Safe to call on style load and on every data
 * change, in either order.
 */
export const OBSERVATION_SOURCE = "observations";

function observationsToGeojson(observations: ReturnType<typeof useAppStore.getState>["observations"]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: observations.map((observation) => ({
      type: "Feature",
      id: observation.id,
      properties: {
        id: observation.id,
        title: observation.title,
        colour: CLASS_COLOURS[observationClass(observation)],
      },
      geometry: observation.geometry,
    })),
  };
}

function syncPresetLayers(instance: MapLibreMap) {
  const { presets, observations } = useAppStore.getState();

  for (const preset of OVERPASS_PRESETS) {
    const id = sourceId(preset.id);
    const layer = presets[preset.id];
    const data = layer?.geojson ?? EMPTY;

    const existing = instance.getSource(id) as GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else instance.addSource(id, { type: "geojson", data });

    const [lineId, pointId] = layerIds(preset.id);
    const visibility = layer?.visible ? "visible" : "none";

    if (!instance.getLayer(lineId!)) {
      instance.addLayer({
        id: lineId!,
        type: "line",
        source: id,
        filter: ["!=", ["geometry-type"], "Point"],
        layout: { visibility, "line-cap": "round" },
        paint: { "line-color": "#9e2f2f", "line-width": 4, "line-opacity": 0.85 },
      });
    }
    if (!instance.getLayer(pointId!)) {
      instance.addLayer({
        id: pointId!,
        type: "circle",
        source: id,
        filter: ["==", ["geometry-type"], "Point"],
        layout: { visibility },
        paint: {
          "circle-radius": 5,
          "circle-color": "#9e2f2f",
          // Shape and outline carry meaning too, never colour alone.
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
    }

    for (const layerId of layerIds(preset.id)) {
      if (instance.getLayer(layerId)) instance.setLayoutProperty(layerId, "visibility", visibility);
    }
  }

  // User observations sit above the OSM indices: they are the evidence, the OSM
  // layer is only context.
  const data = observationsToGeojson(observations);
  const existingObs = instance.getSource(OBSERVATION_SOURCE) as GeoJSONSource | undefined;
  if (existingObs) existingObs.setData(data);
  else instance.addSource(OBSERVATION_SOURCE, { type: "geojson", data });

  if (!instance.getLayer("observations-line")) {
    instance.addLayer({
      id: "observations-line",
      type: "line",
      source: OBSERVATION_SOURCE,
      filter: ["!=", ["geometry-type"], "Point"],
      paint: { "line-color": ["get", "colour"], "line-width": 5, "line-opacity": 0.9 },
    });
  }
  if (!instance.getLayer("observations-point")) {
    instance.addLayer({
      id: "observations-point",
      type: "circle",
      source: OBSERVATION_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 8,
        "circle-color": ["get", "colour"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }
}
