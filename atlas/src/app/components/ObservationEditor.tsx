import { useEffect, useId, useState } from "react";
import { useAppStore } from "../state.js";
import { RatingForm } from "./RatingForm.js";
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
      <p className="p-4 text-sm text-slate-600">
        Selectionne une observation dans la liste, ou clique sur la carte apres avoir active « Ajouter un point ».
      </p>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(selected);

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-sm font-semibold">Fiche d'observation</h2>

      <div>
        <label htmlFor={`${ids}-title`} className="block text-xs font-medium">Titre</label>
        <input
          id={`${ids}-title`}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="w-full rounded border border-slate-300 p-1 text-sm"
        />
      </div>

      <div>
        <label htmlFor={`${ids}-desc`} className="block text-xs font-medium">Description</label>
        <textarea
          id={`${ids}-desc`}
          rows={3}
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="w-full rounded border border-slate-300 p-1 text-sm"
        />
      </div>

      <div>
        <label htmlFor={`${ids}-observed`} className="block text-xs font-medium">Date d'observation</label>
        <input
          id={`${ids}-observed`}
          type="date"
          value={(draft.observedAt ?? "").slice(0, 10)}
          onChange={(e) => setDraft({ ...draft, observedAt: e.target.value || undefined })}
          className="rounded border border-slate-300 p-1 text-sm"
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
        className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
      >
        {dirty ? "Enregistrer" : "Enregistre"}
      </button>
    </div>
  );
}
