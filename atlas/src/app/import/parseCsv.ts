import type { ParsedImport } from "./parseGeojson.js";

/**
 * RFC 4180-ish CSV parsing: quoted fields, escaped quotes ("") inside them,
 * CRLF or LF line endings. Ported from the legacy site/app.js parser, which
 * the new import wizard otherwise has no equivalent of -- CSV is how someone
 * fills in a field survey by hand or in a spreadsheet, and GeoJSON is not.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

const LAT_KEYS = ["lat", "latitude", "coord_y", "y"];
const LON_KEYS = ["lon", "lng", "longitude", "coord_x", "x"];

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(h.trim().toLowerCase()));
}

/**
 * A CSV row becomes a Point feature at its lat/lon columns; every other column
 * becomes a property, exactly like a GeoJSON feature's properties, so the rest
 * of the import pipeline (mapping wizard, bulk ratings) is unchanged.
 */
export function parseCsv(text: string): ParsedImport {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error("Fichier CSV vide ou sans ligne d'en-tete.");
  }

  const headers = rows[0]!.map((h) => h.trim());
  const latIndex = findColumn(headers, LAT_KEYS);
  const lonIndex = findColumn(headers, LON_KEYS);
  if (latIndex === -1 || lonIndex === -1) {
    throw new Error(
      "Colonnes de coordonnees introuvables. Attendu : lat/latitude/coord_y/y et lon/lng/longitude/coord_x/x.",
    );
  }

  const parsed: ParsedImport = { features: [], rejected: [], propertyKeys: [] };
  const keys = new Set<string>();

  rows.slice(1).forEach((cells, rowIndex) => {
    const lat = Number(cells[latIndex]?.trim());
    const lon = Number(cells[lonIndex]?.trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      parsed.rejected.push({ index: rowIndex, reason: "coordonnees manquantes ou illisibles" });
      return;
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      parsed.rejected.push({ index: rowIndex, reason: "coordonnees hors EPSG:4326 - lat/lon inversees ?" });
      return;
    }

    const properties: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (index === latIndex || index === lonIndex) return;
      const value = cells[index]?.trim() ?? "";
      if (value !== "") {
        properties[header] = value;
        keys.add(header);
      }
    });

    parsed.features.push({
      feature: {
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: [lon, lat] },
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties,
    });
  });

  parsed.propertyKeys = [...keys].sort();
  return parsed;
}
