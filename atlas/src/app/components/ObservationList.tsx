import { useAppStore } from "../state.js";
import { CLASS_COLOURS, observationClass, observationScore } from "../observationStyle.js";
import { DEFAULT_CONFIG } from "../../domain/config.js";
import { IconTrash, IconUndo } from "./icons.js";

export function ObservationList() {
  const observations = useAppStore((s) => s.observations);
  const selected = useAppStore((s) => s.selectedObservationId);
  const select = useAppStore((s) => s.selectObservation);
  const remove = useAppStore((s) => s.removeObservation);
  const undo = useAppStore((s) => s.undo);
  const undoLast = useAppStore((s) => s.undoLast);

  return (
    <section aria-labelledby="obs-heading" className="card">
      <h2 id="obs-heading" className="card-title">
        Observations ({observations.length})
      </h2>

      {undo && (
        <div className="callout-info mb-2 flex items-center justify-between gap-2">
          <p>{undo.label}</p>
          <button type="button" onClick={() => void undoLast()} className="btn btn-ghost btn-sm shrink-0">
            <IconUndo />
            Annuler
          </button>
        </div>
      )}

      {observations.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
          Aucune observation. Importe un GeoJSON, ou active « Ajouter un point » et clique sur la carte.
        </p>
      )}

      <ul className="space-y-1.5">
        {observations.map((observation) => {
          const score = observationScore(observation);
          const klass = observationClass(observation);
          const isSelected = selected === observation.id;
          return (
            <li key={observation.id}>
              <div
                className="rounded-md border p-2 pl-2.5 transition-colors"
                style={{
                  borderColor: isSelected ? "var(--brand)" : "var(--line)",
                  background: isSelected ? "var(--brand-tint)" : "var(--surface)",
                  borderLeftWidth: "3px",
                  borderLeftColor: CLASS_COLOURS[klass],
                }}
              >
                <button
                  type="button"
                  onClick={() => select(isSelected ? null : observation.id)}
                  aria-expanded={isSelected}
                  className="block w-full text-left text-sm font-semibold text-slate-900"
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
                  className="btn btn-danger btn-sm mt-1.5"
                >
                  <IconTrash />
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
