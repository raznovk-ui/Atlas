import { useId, useState } from "react";
import { useAppStore } from "../state.js";
import { IconCamera } from "./icons.js";

const ACCEPTED = /^image\/(jpeg|png|webp)$/;

export function PhotoImport() {
  const importPhotos = useAppStore((s) => s.importPhotos);
  const pending = useAppStore((s) => s.pendingPhotos);
  const placingPhotoId = useAppStore((s) => s.placingPhotoId);
  const startPlacing = useAppStore((s) => s.startPlacingPhoto);
  const [dragging, setDragging] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const ids = useId();

  function accept(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    const usable = files.filter((f) => ACCEPTED.test(f.type));
    setSkipped(files.filter((f) => !ACCEPTED.test(f.type)).map((f) => f.name));
    if (usable.length) void importPhotos(usable);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files); }}
        className="rounded-md border-2 border-dashed p-3 text-center text-xs transition-colors"
        style={{
          borderColor: dragging ? "var(--brand)" : "var(--line-strong)",
          background: dragging ? "var(--brand-tint)" : "var(--surface-alt)",
        }}
      >
        <IconCamera className="mx-auto mb-1 h-6 w-6 text-slate-400" />
        <p className="mb-1 text-slate-600">Depose des photos ici</p>
        {/* The drop zone is a convenience; the input is the accessible path. */}
        <label htmlFor={`${ids}-photos`} className="cursor-pointer font-semibold" style={{ color: "var(--brand-dark)" }}>
          ou choisis des fichiers
        </label>
        <input
          id={`${ids}-photos`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => accept(e.target.files)}
          className="sr-only"
        />
      </div>

      <p className="callout-warning">
        <strong>Les photos peuvent montrer des personnes.</strong> Les metadonnees (lieu, heure,
        appareil) sont lues ici mais retirees des images a l'export. Evite les visages
        identifiables quand ce n'est pas necessaire au diagnostic.
      </p>

      {skipped.length > 0 && (
        <p className="text-xs text-slate-600">
          Ignore(s) : {skipped.join(", ")}. Formats acceptes : JPEG, PNG, WebP. HEIC non pris en charge.
        </p>
      )}

      {pending.length > 0 && (
        <div className="rounded-md border p-2" style={{ borderColor: "var(--line)" }}>
          <p className="text-xs font-semibold text-slate-700">{pending.length} photo(s) sans GPS a placer :</p>
          <ul className="mt-1 space-y-1">
            {pending.map((entry) => (
              <li key={entry.photoId} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{entry.filename}</span>
                <button
                  type="button"
                  onClick={() => startPlacing(placingPhotoId === entry.photoId ? null : entry.photoId)}
                  aria-pressed={placingPhotoId === entry.photoId}
                  className="btn btn-toggle btn-sm shrink-0"
                >
                  {placingPhotoId === entry.photoId ? "Clique la carte…" : "Placer"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
