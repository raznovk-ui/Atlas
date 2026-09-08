import type { FeatureCollection } from "geojson";
import { CACHE_TTL_MS, readCache, writeCache } from "./cache.js";
import { osmToGeojson } from "./osmToGeojson.js";
import type { OverpassPreset } from "./presets.js";

const ENDPOINT = "https://overpass-api.de/api/interpreter";

export interface OverpassResult {
  geojson: FeatureCollection;
  fromCache: boolean;
  timestamp: number;
}

/**
 * Concurrent callers share one request. Without this, React StrictMode's double
 * effect invocation alone sent the same corridor-wide query to Overpass several
 * times per page load.
 */
const inFlight = new Map<string, Promise<OverpassResult>>();

/**
 * Overpass is volunteer-run and rate-limits noisy clients, so a cached response
 * is used until it expires and the network is only touched on a miss or an
 * explicit refresh.
 */
export function loadPreset(
  preset: OverpassPreset,
  options: { forceRefresh?: boolean } = {},
): Promise<OverpassResult> {
  const dedupeKey = `${preset.id}:${options.forceRefresh ? "refresh" : "normal"}`;
  const pending = inFlight.get(dedupeKey);
  if (pending) return pending;

  const request = fetchPreset(preset, options).finally(() => inFlight.delete(dedupeKey));
  inFlight.set(dedupeKey, request);
  return request;
}

async function fetchPreset(
  preset: OverpassPreset,
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
): Promise<OverpassResult> {
  const key = `preset:${preset.id}`;
  const cached = await readCache<FeatureCollection>(key);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { geojson: cached.payload, fromCache: true, timestamp: cached.timestamp };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(preset.query)}`,
    });
    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    const geojson = osmToGeojson(await response.json());
    await writeCache(key, geojson);
    return { geojson, fromCache: false, timestamp: Date.now() };
  } catch (error) {
    // A stale cache beats an empty map when Overpass is down or throttling.
    if (cached) return { geojson: cached.payload, fromCache: true, timestamp: cached.timestamp };
    throw error;
  }
}
