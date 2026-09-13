import { useEffect, useId, useState } from "react";
import { DEFAULT_CONFIG } from "../../domain/config.js";
import { DIMENSIONS, type Dimension } from "../../domain/dimensions.js";
import type { RupturePoint } from "../../domain/types.js";
import { describeRupture } from "../ruptureStyle.js";
import { useAppStore } from "../state.js";
import { IconAlertTriangle, IconTrash } from "./icons.js";

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
  const field = "w-full rounded-md border p-1.5 text-sm";
  const fieldStyle = { borderColor: "var(--line-strong)" };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--line)" }}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
          style={{ background: "var(--danger-dark)" }}
        >
          <IconAlertTriangle className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-slate-900">Point de rupture</h2>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-1.5 text-xs font-semibold text-slate-700">Type de rupture</legend>
        {/* Two selectable cards, not a checkbox: a hard block and friction
            score in entirely different ways, so the choice should read as two
            named options rather than one switch flipped. */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: "Blocage dur", hint: "Impose un plafond de note." },
            { value: false, label: "Friction", hint: "Retire des points." },
          ].map((option) => {
            const active = draft.blocking === option.value;
            return (
              <label
                key={String(option.value)}
                className="cursor-pointer rounded-md border p-2 text-xs transition-colors"
                style={{
                  borderColor: active ? "var(--danger-dark)" : "var(--line-strong)",
                  background: active ? "var(--danger-tint)" : "var(--surface)",
                }}
              >
                <input
                  type="radio"
                  name={`${ids}-blocking`}
                  checked={active}
                  onChange={() => setDraft({ ...draft, blocking: option.value })}
                  className="sr-only"
                />
                <span className="block font-semibold text-slate-900">{option.label}</span>
                <span className="block text-slate-600">{option.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${ids}-severity`} className="block text-xs font-medium text-slate-700">
          Gravite : <span className="font-semibold text-slate-900">{draft.severity} / {DEFAULT_CONFIG.scaleMax}</span>
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
          style={{ accentColor: "var(--danger-dark)" }}
        />
        <p className="text-xs text-slate-500">Plus la valeur est haute, plus la rupture est grave.</p>
        <p
          id={`${ids}-effect`}
          className="mt-1 rounded-md p-2 text-xs font-medium"
          style={{ background: "var(--surface-alt)", color: "var(--ink-soft)" }}
        >
          {describeRupture(draft)}
        </p>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-1.5 text-xs font-semibold text-slate-700">Dimensions touchees</legend>
        <div className="flex flex-wrap gap-1.5">
          {DIMENSIONS.map((meta) => {
            const active = draft.dimensions.includes(meta.key);
            return (
              <label key={meta.key} className={`chip ${active ? "chip-active" : ""}`}>
                <input type="checkbox" className="sr-only" checked={active} onChange={() => toggleDimension(meta.key)} />
                <span className="chip-dot" aria-hidden="true" style={{ background: active ? "#ffffff" : meta.colour }} />
                {meta.mjslCode} · {meta.label}
              </label>
            );
          })}
        </div>
        {draft.dimensions.length === 0 && (
          <p className="callout-warning mt-1.5">Sans dimension, cette rupture n&apos;affecte aucune note.</p>
        )}
      </fieldset>

      <div>
        <label htmlFor={`${ids}-comment`} className="block text-xs font-medium text-slate-700">
          Commentaire
        </label>
        <textarea
          id={`${ids}-comment`}
          rows={3}
          value={draft.comment ?? ""}
          onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          className={field}
          style={fieldStyle}
        />
      </div>

      <div>
        <label htmlFor={`${ids}-fix`} className="block text-xs font-medium text-slate-700">
          Correction suggeree
        </label>
        <textarea
          id={`${ids}-fix`}
          rows={2}
          value={draft.suggestedFix ?? ""}
          onChange={(e) => setDraft({ ...draft, suggestedFix: e.target.value })}
          className={field}
          style={fieldStyle}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => void update(draft)}
          className={`btn flex-1 ${dirty ? "btn-primary" : "btn-secondary"}`}
        >
          {dirty ? "Enregistrer" : "Enregistre"}
        </button>
        <button type="button" onClick={() => void remove(draft.id)} className="btn btn-danger">
          <IconTrash />
          Supprimer
        </button>
      </div>
    </div>
  );
}
