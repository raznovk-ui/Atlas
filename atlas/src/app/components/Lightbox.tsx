import { useEffect, useRef } from "react";

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
      <div className="max-h-full max-w-3xl overflow-auto bg-white p-3" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={caption} className="mx-auto max-h-[70vh] w-auto" />
        <p className="mt-2 text-sm font-medium">{caption}</p>
        <p className="text-xs text-slate-600">{details}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-2 rounded border border-slate-300 px-3 py-1 text-sm font-medium"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
