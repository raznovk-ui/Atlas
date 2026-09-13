import { useId, useState } from "react";
import { parseGeojson, toObservations, type FieldMapping, type ParsedImport } from "../import/parseGeojson.js";
import { parseCsv } from "../import/parseCsv.js";
import { MJSL_LAYERS, MJSL_LAYER_NAMES } from "../import/mjslLayers.js";
import { importMjslProject } from "../../domain/mjsl/import.js";
import { DEFAULT_CONFIG } from "../../domain/config.js";
import type { Rating } from "../../domain/types.js";
import { RatingForm } from "./RatingForm.js";
import { IconLayers, IconUpload } from "./icons.js";
import { useAppStore } from "../state.js";

type Stage = "choose" | "map";
const field = "w-full rounded-md border p-1.5 text-sm";
const fieldStyle = { borderColor: "var(--line-strong)" };

export function ImportWizard() {
  const addObservations = useAppStore((s) => s.addObservations);
  const addRuptures = useAppStore((s) => s.addRuptures);
  const setStatus = useAppStore((s) => s.setStatus);

  const [stage, setStage] = useState<Stage>("choose");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [observedAt, setObservedAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  async function onFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const result = file.name.toLowerCase().endsWith(".csv") ? parseCsv(text) : parseGeojson(text);
      setParsed(result);
      setFileName(file.name);
      // Pre-select the likeliest title column rather than making them hunt.
      const guess = result.propertyKeys.find((k) => /nom|name|titre|title|type/i.test(k));
      setMapping({ title: guess });
      setRatings([]);
      setStage("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function commit() {
    if (!parsed) return;
    const observations = toObservations(parsed, {
      mapping,
      ratings,
      layerId: `import_${Date.now()}`,
      fileName,
      observedAt: observedAt || undefined,
    });
    await addObservations(observations);
    setStage("choose");
    setParsed(null);
  }

  async function importExistingMjsl() {
    const result = importMjslProject(MJSL_LAYERS, DEFAULT_CONFIG);
    await addObservations(result.observations);
    await addRuptures(result.ruptures);
    setStatus(
      `${result.observations.length} observations et ${result.ruptures.length} ruptures MJSL importees.`,
    );
  }

  if (stage === "map" && parsed) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          {fileName} — {parsed.features.length} objet(s)
        </h3>

        {parsed.rejected.length > 0 && (
          <div className="callout-warning">
            <p className="font-semibold">{parsed.rejected.length} objet(s) rejete(s) :</p>
            <ul className="mt-0.5 list-disc pl-4">
              {parsed.rejected.slice(0, 5).map((r) => (
                <li key={r.index}>
                  #{r.index + 1} — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[300px] border-collapse text-left text-xs">
            <caption className="p-2 text-left text-xs text-slate-500">Apercu des 5 premiers objets</caption>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface-alt)" }}>
                <th scope="col" className="px-2 py-1.5 font-semibold text-slate-700">Geometrie</th>
                {parsed.propertyKeys.slice(0, 3).map((key) => (
                  <th scope="col" key={key} className="px-2 py-1.5 font-semibold text-slate-700">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.features.slice(0, 5).map((entry, index) => (
                <tr key={index} className="border-b" style={{ borderColor: "var(--line)" }}>
                  <td className="px-2 py-1 text-slate-600">{entry.geometry.type}</td>
                  {parsed.propertyKeys.slice(0, 3).map((key) => (
                    <td key={key} className="px-2 py-1 text-slate-600">{String(entry.properties[key] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <fieldset className="border-0 p-0">
          <legend className="mb-1.5 text-xs font-semibold text-slate-700">Correspondance des colonnes</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["title", "description", "tags"] as const).map((f) => (
              <div key={f}>
                <label htmlFor={`${ids}-${f}`} className="block text-xs font-medium text-slate-600">
                  {f === "title" ? "Titre" : f === "description" ? "Description" : "Tags"}
                </label>
                <select
                  id={`${ids}-${f}`}
                  value={mapping[f] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}
                  className={field}
                  style={fieldStyle}
                >
                  <option value="">— aucune —</option>
                  {parsed.propertyKeys.map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${ids}-observed`} className="block text-xs font-medium text-slate-700">
            Date d&apos;observation (facultative)
          </label>
          <input
            id={`${ids}-observed`}
            type="date"
            value={observedAt}
            onChange={(e) => setObservedAt(e.target.value)}
            className={`${field} w-auto`}
            style={fieldStyle}
          />
          <p className="mt-1 text-xs text-slate-500">
            Laissee vide, l&apos;import compte comme non date : la confiance restera basse.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-700">Notes appliquees a tous les objets</p>
          <RatingForm ratings={ratings} onChange={setRatings} idPrefix={`${ids}-bulk`} />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => void commit()} className="btn btn-primary flex-1">
            Importer {parsed.features.length} objet(s)
          </button>
          <button
            type="button"
            onClick={() => { setStage("choose"); setParsed(null); }}
            className="btn btn-secondary"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-md border-2 border-dashed p-3 text-center text-xs"
        style={{ borderColor: "var(--line-strong)", background: "var(--surface-alt)" }}
      >
        <IconUpload className="mx-auto mb-1 h-6 w-6 text-slate-400" />
        <label htmlFor={`${ids}-file`} className="cursor-pointer font-semibold" style={{ color: "var(--brand-dark)" }}>
          Importer un fichier GeoJSON ou CSV
        </label>
        <input
          id={`${ids}-file`}
          type="file"
          accept=".geojson,.json,.csv,application/geo+json,application/json,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
          className="sr-only"
        />
        <p className="mt-1 text-slate-500">
          Colonnes lat/lon, latitude/longitude, coord_y/coord_x ou y/x. KML, GPX et shapefile ne sont
          pas encore acceptes. Coordonnees en EPSG:4326.
        </p>
      </div>

      {error && (
        <p className="rounded-md p-2 text-xs" style={{ background: "var(--danger-tint)", color: "var(--danger-dark)", border: "1px solid var(--danger-border)" }}>
          {error}
        </p>
      )}

      <div className="border-t pt-3" style={{ borderColor: "var(--line)" }}>
        <button type="button" onClick={() => void importExistingMjsl()} className="btn btn-secondary btn-block">
          <IconLayers />
          Charger les {MJSL_LAYER_NAMES.length} couches MJSL existantes
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Les couches QGIS deja produites, lues directement depuis site/data.
        </p>
      </div>
    </div>
  );
}
