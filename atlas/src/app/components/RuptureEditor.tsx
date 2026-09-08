import { useEffect, useId, useState } from "react";
import { DEFAULT_CONFIG } from "../../domain/config.js";
import { DIMENSIONS, type Dimension } from "../../domain/dimensions.js";
import type { RupturePoint } from "../../domain/types.js";
import { describeRupture } from "../ruptureStyle.js";
import { useAppStore } from "../state.js";

export function RuptureEditor() {
  const selectedId = useAppStore((s) => s.selectedRuptureId);
  const ruptures = useAppStore((s) => s.ruptures);
  const update = useAppStore((s) => s.updateRupture);
  const remove = useAppStore((s) => s.removeRupture);
  const ids = useId();

  const selected = ruptures.find((r) => r.id === selectedId) ?? null;
  const [draft, setDraft] = useState<RupturePoint | null>(selected);

  useEffect(() => setDraft(selected), [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(selected);
  const toggleDimension = (dimension: Dimension) =>
    setDraft({
      ...draft,
      dimensions: draft.dimensions.includes(dimension)
        ? draft.dimensions.filter((d) => d !== dimension)
        : [...draft.dimensions, dimension],
    });

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-sm font-semibold">Point de rupture</h2>

      <fieldset className="border-0 p-0">
        <legend className="mb-1 text-xs font-medium">Type de rupture</legend>
        {/* Radios, not a checkbox: a hard block and friction score in entirely
            different ways, so the choice should read as two named options. */}
        {[
          { value: true, label: "Blocage dur", hint: "Infranchissable : impose un plafond de note." },
          { value: false, label: "Friction", hint: "Franchissable avec effort : retire des points." },
        ].map((option) => (
          <label key={String(option.value)} className="mb-1 flex gap-2 text-sm">
            <input
              type="radio"
              name={`${ids}-blocking`}
              checked={draft.blocking === option.value}
              onChange={() => setDraft({ ...draft, blocking: option.value })}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-slate-600">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor={`${ids}-severity`} className="block text-xs font-medium">
          Gravite : {draft.severity} / {DEFAULT_CONFIG.scaleMax}
        </label>
        <input
          id={`${ids}-severity`}
          type="range"
          min={0}
          max={DEFAULT_CONFIG.scaleMax}
          step={DEFAULT_CONFIG.scaleStep}
          value={draft.severity}
          onChange={(e) => setDraft({ ...draft, severity: Number(e.target.value) })}
          aria-describedby={`${ids}-effect`}
          className="w-full"
        />
        <p className="text-xs text-slate-600">Plus la valeur est haute, plus la rupture est grave.</p>
        <p id={`${ids}-effect`} className="mt-1 rounded bg-slate-100 p-2 text-xs">
          {describeRupture(draft)}
        </p>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-1 text-xs font-medium">Dimensions touchees</legend>
        <div className="flex flex-wrap gap-2">
          {DIMENSIONS.map((meta) => {
            const active = draft.dimensions.includes(meta.key);
            return (
              <label
                key={meta.key}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={active} onChange={() => toggleDimension(meta.key)} />
                {meta.mjslCode} · {meta.label}
              </label>
            );
          })}
        </div>
        {draft.dimensions.length === 0 && (
          <p className="mt-1 text-xs text-amber-800">
            Sans dimension, cette rupture n&apos;affecte aucune note.
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={`${ids}-comment`} className="block text-xs font-medium">
          Commentaire
        </label>
        <textarea
          id={`${ids}-comment`}
          rows={3}
          value={draft.comment ?? ""}
          onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          className="w-full rounded border border-slate-300 p-1 text-sm"
        />
      </div>

      <div>
        <label htmlFor={`${ids}-fix`} className="block text-xs font-medium">
          Correction suggeree
        </label>
        <textarea
          id={`${ids}-fix`}
          rows={2}
          value={draft.suggestedFix ?? ""}
          onChange={(e) => setDraft({ ...draft, suggestedFix: e.target.value })}
          className="w-full rounded border border-slate-300 p-1 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => void update(draft)}
          className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
        >
          {dirty ? "Enregistrer" : "Enregistre"}
        </button>
        <button
          type="button"
          onClick={() => void remove(draft.id)}
          className="rounded border border-slate-300 px-3 py-1 text-sm text-red-800"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
