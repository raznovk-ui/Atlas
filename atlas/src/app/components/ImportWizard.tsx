import { useId, useState } from "react";
import { parseGeojson, toObservations, type FieldMapping, type ParsedImport } from "../import/parseGeojson.js";
import { MJSL_LAYERS, MJSL_LAYER_NAMES } from "../import/mjslLayers.js";
import { importMjslProject } from "../../domain/mjsl/import.js";
import { DEFAULT_CONFIG } from "../../domain/config.js";
import type { Rating } from "../../domain/types.js";
import { RatingForm } from "./RatingForm.js";
import { useAppStore } from "../state.js";

type Stage = "choose" | "map";

export function ImportWizard() {
  const addObservations = useAppStore((s) => s.addObservations);
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
      const result = parseGeojson(await file.text());
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
    setStatus(
      `${result.observations.length} observations MJSL importees ` +
        `(${result.ruptures.length} ruptures reconnues, affichage a l'etape 5).`,
    );
  }

  if (stage === "map" && parsed) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">
          {fileName} — {parsed.features.length} objet(s)
        </h3>

        {parsed.rejected.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs">
            <p className="font-medium">{parsed.rejected.length} objet(s) rejete(s) :</p>
            <ul className="list-disc pl-4">
              {parsed.rejected.slice(0, 5).map((r) => (
                <li key={r.index}>
                  #{r.index + 1} — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <table className="w-full border-collapse text-left text-xs">
          <caption className="mb-1 text-left text-xs text-slate-600">Apercu des 5 premiers objets</caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-1 pr-2">Geometrie</th>
              {parsed.propertyKeys.slice(0, 3).map((key) => (
                <th scope="col" key={key} className="py-1 pr-2">{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.features.slice(0, 5).map((entry, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="py-1 pr-2">{entry.geometry.type}</td>
                {parsed.propertyKeys.slice(0, 3).map((key) => (
                  <td key={key} className="py-1 pr-2">{String(entry.properties[key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <fieldset className="border-0 p-0">
          <legend className="mb-1 text-sm font-semibold">Correspondance des colonnes</legend>
          {(["title", "description", "tags"] as const).map((field) => (
            <div key={field} className="mb-2">
              <label htmlFor={`${ids}-${field}`} className="block text-xs font-medium">
                {field === "title" ? "Titre" : field === "description" ? "Description" : "Tags"}
              </label>
              <select
                id={`${ids}-${field}`}
                value={mapping[field] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))}
                className="w-full rounded border border-slate-300 p-1 text-sm"
              >
                <option value="">— aucune —</option>
                {parsed.propertyKeys.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
          ))}
        </fieldset>

        <div>
          <label htmlFor={`${ids}-observed`} className="block text-xs font-medium">
            Date d'observation (facultative)
          </label>
          <input
            id={`${ids}-observed`}
            type="date"
            value={observedAt}
            onChange={(e) => setObservedAt(e.target.value)}
            className="rounded border border-slate-300 p-1 text-sm"
          />
          <p className="text-xs text-slate-600">
            Laissee vide, l'import compte comme non date : la confiance restera basse.
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold">Notes appliquees a tous les objets</p>
          <RatingForm ratings={ratings} onChange={setRatings} idPrefix={`${ids}-bulk`} />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={commit} className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white">
            Importer {parsed.features.length} objet(s)
          </button>
          <button
            type="button"
            onClick={() => { setStage("choose"); setParsed(null); }}
            className="rounded border border-slate-300 px-3 py-1 text-sm"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${ids}-file`} className="block text-sm font-medium">
          Importer un fichier GeoJSON
        </label>
        <input
          id={`${ids}-file`}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
          className="mt-1 w-full text-sm"
        />
        <p className="mt-1 text-xs text-slate-600">
          KML, GPX et shapefile ne sont pas encore acceptes. Les coordonnees doivent etre en EPSG:4326.
        </p>
      </div>

      {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p>}

      <div className="border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => void importExistingMjsl()}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Charger les {MJSL_LAYER_NAMES.length} couches MJSL existantes
        </button>
        <p className="mt-1 text-xs text-slate-600">
          Les couches QGIS deja produites, lues directement depuis site/data.
        </p>
      </div>
    </div>
  );
}
