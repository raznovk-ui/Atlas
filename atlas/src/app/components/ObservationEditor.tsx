import { useEffect, useId, useState } from "react";
import { useAppStore } from "../state.js";
import { RatingForm } from "./RatingForm.js";
import { IconPin } from "./icons.js";
import type { Observation } from "../../domain/types.js";

export function ObservationEditor() {
  const selectedId = useAppStore((s) => s.selectedObservationId);
  const observations = useAppStore((s) => s.observations);
  const update = useAppStore((s) => s.updateObservation);
  const ids = useId();

  const selected = observations.find((o) => o.id === selectedId) ?? null;
  const [draft, setDraft] = useState<Observation | null>(selected);

  // Reset the draft when a different observation is selected.
  useEffect(() => {
    setDraft(selected);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <IconPin className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">
          Selectionne une observation dans la liste, ou clique sur la carte apres avoir active « Ajouter un point ».
        </p>
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(selected);
  const field = "w-full rounded-md border p-1.5 text-sm";
  const fieldStyle = { borderColor: "var(--line-strong)" };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--line)" }}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
          style={{ background: "var(--brand)" }}
        >
          <IconPin className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-slate-900">Fiche d&apos;observation</h2>
      </div>

      <div>
        <label htmlFor={`${ids}-title`} className="block text-xs font-medium text-slate-700">Titre</label>
        <input
          id={`${ids}-title`}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className={field}
          style={fieldStyle}
        />
      </div>

      <div>
        <label htmlFor={`${ids}-desc`} className="block text-xs font-medium text-slate-700">Description</label>
        <textarea
          id={`${ids}-desc`}
          rows={3}
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className={field}
          style={fieldStyle}
        />
      </div>

      <div>
        <label htmlFor={`${ids}-observed`} className="block text-xs font-medium text-slate-700">Date d&apos;observation</label>
        <input
          id={`${ids}-observed`}
          type="date"
          value={(draft.observedAt ?? "").slice(0, 10)}
          onChange={(e) => setDraft({ ...draft, observedAt: e.target.value || undefined })}
          className={`${field} w-auto`}
          style={fieldStyle}
        />
      </div>

      <RatingForm
        ratings={draft.ratings}
        onChange={(ratings) => setDraft({ ...draft, ratings })}
        idPrefix={`${ids}-edit`}
      />

      <button
        type="button"
        disabled={!dirty}
        onClick={() => void update(draft)}
        className={`btn btn-block ${dirty ? "btn-primary" : "btn-secondary"}`}
      >
        {dirty ? "Enregistrer" : "Enregistre"}
      </button>
    </div>
  );
}
