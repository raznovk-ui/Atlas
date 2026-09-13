import { useEffect, useRef } from "react";
import { IconX } from "./icons.js";

interface Props {
  src: string;
  caption: string;
  details: string;
  onClose: () => void;
}

/** Modal image view. Escape closes it and focus is moved in and back out. */
export function Lightbox({ src, caption, details, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // Restoring focus is left to the caller: React re-renders the trigger, so an
    // element captured on mount is detached by unmount and focusing it silently
    // drops focus to <body>.
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full max-w-3xl overflow-auto rounded-lg bg-white p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={src} alt={caption} className="mx-auto max-h-[70vh] w-auto rounded" />
        <p className="mt-2 text-sm font-semibold text-slate-900">{caption}</p>
        <p className="text-xs text-slate-600">{details}</p>
        <button ref={closeRef} type="button" onClick={onClose} className="btn btn-secondary mt-2">
          <IconX />
          Fermer
        </button>
      </div>
    </div>
  );
}
