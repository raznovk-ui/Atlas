import { useMemo, useState } from "react";
import { OVERPASS_PRESETS } from "../overpass/presets.js";
import { useAppStore } from "../state.js";

const PAGE = 50;

/**
 * The non-map view the accessibility requirement calls for: everything on the
 * map is reachable here without a pointer or a visual channel.
 */
export function DataTable() {
  const presets = useAppStore((s) => s.presets);
  const observations = useAppStore((s) => s.observations);
  const ruptures = useAppStore((s) => s.ruptures);
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(
    () => [
      // Contributed evidence first: the OSM indices are only context.
      ...ruptures.map((rupture) => ({
        preset: "Rupture",
        id: rupture.id,
        label: rupture.comment || "Rupture sans description",
        type: `${rupture.blocking ? "Blocage dur" : "Friction"} · gravite ${rupture.severity}`,
        wheelchair: rupture.dimensions.join(", "),
      })),
      ...observations.map((observation) => ({
        preset: "Observation",
        id: observation.id,
        label: observation.title,
        type: observation.geometry.type,
        wheelchair: observation.ratings
          .map((r) => `${r.dimension}=${r.score ?? "?"}`)
          .join(", "),
      })),
      ...OVERPASS_PRESETS.flatMap((preset) =>
        (presets[preset.id]?.geojson?.features ?? []).map((feature) => ({
          preset: preset.label,
          id: String(feature.properties?.osm_id ?? feature.id ?? ""),
          label: String(feature.properties?.label ?? ""),
          type: feature.geometry.type,
          wheelchair: String(feature.properties?.wheelchair ?? ""),
        })),
      ),
    ],
    [presets, observations, ruptures],
  );

  if (rows.length === 0) {
    return <p className="p-4 text-sm text-slate-600">Aucune donnee chargee pour l'instant.</p>;
  }

  return (
    <div className="p-4">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="mb-2 text-left text-sm text-slate-700">
          {rows.length} objets charges. Memes donnees que la carte.
        </caption>
        <thead>
          <tr className="border-b border-slate-300">
            <th scope="col" className="py-1 pr-3 font-semibold">Type</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Objet</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Geometrie</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Dimensions / wheelchair</th>
            <th scope="col" className="py-1 font-semibold">Identifiant</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-1 pr-3">{row.preset}</td>
              <td className="py-1 pr-3">{row.label}</td>
              <td className="py-1 pr-3">{row.type}</td>
              <td className="py-1 pr-3">{row.wheelchair || "-"}</td>
              <td className="py-1 font-mono text-xs">{row.id}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {limit < rows.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="mt-3 rounded border border-slate-300 px-3 py-1 text-sm font-medium hover:bg-slate-100"
        >
          Afficher {Math.min(PAGE, rows.length - limit)} objets de plus
        </button>
      )}
    </div>
  );
}
