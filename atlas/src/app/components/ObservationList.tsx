import { useAppStore } from "../state.js";
import { observationClass, observationScore } from "../observationStyle.js";
import { DEFAULT_CONFIG } from "../../domain/config.js";

export function ObservationList() {
  const observations = useAppStore((s) => s.observations);
  const selected = useAppStore((s) => s.selectedObservationId);
  const select = useAppStore((s) => s.selectObservation);
  const remove = useAppStore((s) => s.removeObservation);
  const undo = useAppStore((s) => s.undo);
  const undoLast = useAppStore((s) => s.undoLast);

  return (
    <section aria-labelledby="obs-heading">
      <h2 id="obs-heading" className="mb-2 text-sm font-semibold">
        Observations ({observations.length})
      </h2>

      {undo && (
        <div className="mb-2 rounded border border-slate-300 bg-slate-50 p-2 text-xs">
          <p>{undo.label}</p>
          <button type="button" onClick={() => void undoLast()} className="mt-1 font-medium underline">
            Annuler la suppression
          </button>
        </div>
      )}

      {observations.length === 0 && (
        <p className="text-xs text-slate-600">
          Aucune observation. Importe un GeoJSON, ou active « Ajouter un point » et clique sur la carte.
        </p>
      )}

      <ul className="space-y-1">
        {observations.map((observation) => {
          const score = observationScore(observation);
          const klass = observationClass(observation);
          return (
            <li key={observation.id}>
              <div
                className={`rounded border p-2 ${
                  selected === observation.id ? "border-slate-900 bg-slate-50" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => select(selected === observation.id ? null : observation.id)}
                  aria-expanded={selected === observation.id}
                  className="block w-full text-left text-sm font-medium"
                >
                  {observation.title}
                </button>
                <p className="text-xs text-slate-600">
                  {observation.geometry.type} ·{" "}
                  {/* Class name in text, so the colour on the map is never the only cue. */}
                  {score === null ? "non renseignee" : `${score} / ${DEFAULT_CONFIG.scaleMax} · ${klass}`}
                  {observation.observedAt ? ` · observee le ${observation.observedAt}` : " · sans date"}
                </p>
                <button
                  type="button"
                  onClick={() => void remove(observation.id)}
                  className="mt-1 text-xs text-red-800 underline"
                >
                  Supprimer
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
