import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../state.js";
import { Lightbox } from "./Lightbox.js";

/** Object URLs for the stored blobs, revoked when the set changes. */
function useBlobUrls(blobs: { id: string; blob: Blob }[]) {
  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const { id, blob } of blobs) map.set(id, URL.createObjectURL(blob));
    return map;
  }, [blobs]);

  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  return urls;
}

export function PhotoGallery() {
  const photos = useAppStore((s) => s.photos);
  const observations = useAppStore((s) => s.observations);
  const select = useAppStore((s) => s.selectObservation);
  const [openId, setOpenId] = useState<string | null>(null);

  const thumbs = useMemo(() => photos.map((p) => ({ id: p.id, blob: p.thumbnail })), [photos]);
  const thumbUrls = useBlobUrls(thumbs);

  const open = photos.find((p) => p.id === openId) ?? null;
  const fullBlobs = useMemo(() => (open ? [{ id: open.id, blob: open.original }] : []), [open]);
  const fullUrls = useBlobUrls(fullBlobs);

  if (photos.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">Aucune photo importee.</p>;
  }

  const observationFor = (photoId: string) =>
    observations.find((o) => (o.media ?? []).some((m) => m.id === photoId));

  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((photo) => {
          const observation = observationFor(photo.id);
          const media = observation?.media?.[0];
          return (
            <li key={photo.id}>
              <button
                type="button"
                data-photo-trigger={photo.id}
                onClick={() => { setOpenId(photo.id); if (observation) select(observation.id); }}
                className="group block w-full overflow-hidden rounded-lg border border-slate-200 transition-shadow hover:shadow-md"
              >
                <img
                  src={thumbUrls.get(photo.id)}
                  alt={`Photo : ${photo.filename}${media?.takenAt ? `, prise le ${media.takenAt.slice(0, 10)}` : ""}`}
                  className="h-20 w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="block truncate bg-slate-50 px-1.5 py-1 text-left text-[10px] text-slate-600">{photo.filename}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <Lightbox
          src={fullUrls.get(open.id) ?? ""}
          caption={open.filename}
          details={(() => {
            const media = observationFor(open.id)?.media?.[0];
            const parts = [
              media?.takenAt ? `Prise le ${media.takenAt.slice(0, 10)}` : "Date inconnue",
              media?.coordinates ? `GPS ${media.coordinates[1].toFixed(5)}, ${media.coordinates[0].toFixed(5)}` : "GPS absent (placee a la main)",
              media?.bearing !== undefined ? `Orientation ${Math.round(media.bearing)}°` : "Orientation inconnue",
              `${(open.size / 1024).toFixed(0)} ko`,
            ];
            return parts.join(" · ");
          })()}
          onClose={() => {
            const trigger = open.id;
            setOpenId(null);
            // Looked up after the close so the current element is focused, not
            // a stale one from before the re-render.
            requestAnimationFrame(() =>
              document.querySelector<HTMLButtonElement>(`[data-photo-trigger="${trigger}"]`)?.focus(),
            );
          }}
        />
      )}
    </>
  );
}
